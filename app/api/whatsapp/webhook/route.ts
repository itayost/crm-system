import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isWebhookAuthorized } from '@/lib/api/webhook-auth'
import { WahaService, botSessionName, withTyping } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'
import { identifySender, type WhatsAppSender } from '@/lib/services/whatsapp-identity'
import { SupportAgentService } from '@/lib/services/support-agent.service'
import { archiveBotMessage, releaseArchivedMessage } from '@/lib/services/whatsapp-archive'
import { processIncomingMedia } from '@/lib/services/support-media.service'
import { SupportConversationService } from '@/lib/services/support-conversation.service'
import {
  CHECKING_MESSAGE,
  CLIENT_ACK_MESSAGE,
  degradedTurnOwnerNotice,
  greetingMessage,
  MEDIA_ONLY_PLACEHOLDER,
  OWNER_MEDIA_UNSUPPORTED_MESSAGE,
  PROCESSING_ERROR_MESSAGE,
  UNKNOWN_SENDER_HOLD_MESSAGE,
  unknownSenderOwnerNotice,
} from '@/lib/services/whatsapp-messages'
import { degradedSupportReply, describeModelError } from '@/lib/ai/resilient-model'
import { parseWahaMessageEvent, type WahaMessage } from '@/lib/validations/whatsapp'

// The agent can spend half a minute on a repo search, and a degraded turn can
// spend two more waiting on the local model - all after the response.
export const maxDuration = 300

/**
 * Bot-session webhook. Every sender is classified before anything happens:
 * only the owner's own phone reaches the owner agent and its CRM tools.
 */
export async function POST(req: Request) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parsed once and kept: the error path needs the sender, and req.clone()
  // cannot help after the body has been read.
  let message: WahaMessage | null = null

  try {
    message = parseWahaMessageEvent(await req.json())

    if (!message || message.fromMe) {
      return NextResponse.json({ ok: true })
    }

    const sender = await identifySender({
      chatId: message.from,
      session: botSessionName(),
    })

    if (sender.kind === 'OWNER') {
      // The owner agent is text-only; a voice note from Itay is not this slice.
      if (message.body) {
        await handleOwnerMessage(sender.chatId, message.body)
      } else {
        await WahaService.sendMessage({
          chatId: sender.chatId,
          text: OWNER_MEDIA_UNSUPPORTED_MESSAGE,
        })
      }
      return NextResponse.json({ ok: true })
    }

    if (sender.kind === 'CLIENT') {
      // Answer WAHA now and do the work afterwards. Holding the webhook open for
      // the whole turn invites a delivery timeout and a retry, and leaves the
      // client with no sign anything is happening.
      const clientMessage = message
      after(async () => {
        try {
          await handleClientMessage(sender, clientMessage)
        } catch (error) {
          console.error('Support turn failed:', error)
          await WahaService.sendMessage({
            chatId: sender.chatId,
            text: PROCESSING_ERROR_MESSAGE,
          }).catch(() => {})
        }
      })
      return NextResponse.json({ ok: true })
    }

    await handleUnknownSender(sender, message.body ?? MEDIA_ONLY_PLACEHOLDER)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp bot webhook error:', error)

    // Whoever wrote in is left waiting otherwise.
    if (message?.from) {
      try {
        await WahaService.sendMessage({
          chatId: message.from,
          text: PROCESSING_ERROR_MESSAGE,
        })
      } catch (sendError) {
        console.error('Failed to send the processing-error reply:', sendError)
      }
    }

    return NextResponse.json({ ok: true })
  }
}

async function handleOwnerMessage(chatId: string, text: string) {
  const user = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    select: { id: true },
  })

  if (!user) {
    console.error('No OWNER user found in database')
    return
  }

  // Save owner's chatId (LID) for morning briefs and notifications
  await WhatsAppAgentService.saveOwnerChatId(chatId)

  const reply = await WhatsAppAgentService.processMessage(user.id, text)

  await WahaService.sendMessage({ chatId, text: reply })
}

async function handleClientMessage(
  sender: Extract<WhatsAppSender, { kind: 'CLIENT' }>,
  message: WahaMessage
) {
  const { contact } = sender
  const conversationContext = {
    chatId: sender.chatId,
    clientId: contact.clientId,
    contactId: contact.id,
    userId: contact.userId,
  }

  // Blue ticks first: the cheapest possible "your message arrived".
  await WahaService.sendSeen(sender.chatId)

  // At most one filler message per turn, whoever decides it is needed.
  let acknowledged = false
  const acknowledge = async (text: string) => {
    if (acknowledged) return
    acknowledged = true
    await WahaService.sendMessage({ chatId: sender.chatId, text }).catch((error) => {
      console.error('Failed to send the acknowledgement:', error)
    })
  }

  // A client writing for the first time has no reason to believe anyone is
  // there, so they get a greeting by name before any of the slow work starts.
  if (!(await SupportConversationService.exists(conversationContext))) {
    await acknowledge(greetingMessage(contact.name))
  } else if (message.media) {
    // Transcription is the slowest single step and it runs before the agent.
    await acknowledge(CHECKING_MESSAGE)
  }

  await withTyping(sender.chatId, () => runSupportTurn(sender, message, acknowledge))
}

async function runSupportTurn(
  sender: Extract<WhatsAppSender, { kind: 'CLIENT' }>,
  message: WahaMessage,
  acknowledge: (text: string) => Promise<void>
) {
  const { contact } = sender

  // Voice notes, screen recordings, and screenshots become text the agent can
  // reason about before anything else happens.
  const media = message.media
    ? await processIncomingMedia({
        clientId: contact.clientId,
        media: {
          url: message.media.url,
          mimeType: message.media.mimetype,
          filename: message.media.filename,
        },
        caption: message.body ?? undefined,
      })
    : null

  if (media?.failure) {
    console.warn(`Support media unusable for client ${contact.clientId}: ${media.failure}`)
  }

  const agentText = media ? media.agentText : (message.body ?? '')

  // Archived first, and already marked processed, so the batch extraction never
  // drafts a second ticket for a message the support agent is handling live.
  const { id: sourceMessageId, alreadySeen } = await archiveBotMessage({
    chatId: sender.chatId,
    phone: sender.phone,
    content: message.body || agentText,
    contactId: contact.id,
    clientId: contact.clientId,
    timestamp: message.timestamp,
    externalId: message.id,
    mediaPath: media?.path,
    mediaMimeType: media?.path ? media.mimeType : null,
    transcript: media?.transcript,
  })

  if (alreadySeen) {
    console.warn(`Ignoring redelivered WhatsApp message ${message.id}`)
    return
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastContactedAt: new Date() },
  })

  let reply: string
  try {
    reply = await SupportAgentService.handleMessage({
      userId: contact.userId,
      chatId: sender.chatId,
      clientId: contact.clientId,
      clientName: contact.clientName,
      contactId: contact.id,
      contactName: contact.name,
      sourceMessageId,
      text: agentText,
      // Recorded even when it could not be stored, so the ticket can say a file
      // arrived that nobody managed to read.
      media: media
        ? { path: media.path, mimeType: media.mimeType, transcribed: media.transcribed }
        : null,
      // The agent knows before it calls the model whether this turn means a repo
      // search. If it already greeted, this is a no-op.
      onAcknowledge: () => acknowledge(CHECKING_MESSAGE),
    })
  } catch (error) {
    console.error('Support agent error:', describeModelError(error), error)
    // Hand the message back to the batch extraction, which skips anything already
    // marked processed - otherwise a gateway outage would lose the request entirely.
    await releaseArchivedMessage(sourceMessageId).catch((releaseError) => {
      console.error('Failed to release archived message for extraction:', releaseError)
    })
    reply = await degradedTurn({ contact, chatId: sender.chatId, lastMessage: agentText })
  }

  try {
    await WahaService.sendMessage({ chatId: sender.chatId, text: reply })
  } catch (error) {
    // The agent may have answered, but the client never saw it. Hand the message
    // back so the batch pass still turns it into a ticket rather than losing it
    // to a processed marker nobody acted on.
    console.error('Failed to deliver the support reply:', error)
    await releaseArchivedMessage(sourceMessageId).catch(() => {})
    throw error
  }
}

/**
 * The degraded tier of a support turn: the agent (and with it the gateway) is
 * down, so a short local-model acknowledgement stands in - or the canned line
 * when the local model is unavailable too. Whatever the client hears, Itay is
 * told a turn went unfiled; WAHA does not depend on the gateway, so the ping
 * works precisely when everything else is failing.
 */
async function degradedTurn(params: {
  contact: Extract<WhatsAppSender, { kind: 'CLIENT' }>['contact']
  chatId: string
  lastMessage: string
}): Promise<string> {
  const { contact, chatId, lastMessage } = params

  const projectNames = await prisma.project
    .findMany({
      where: { clientId: contact.clientId, userId: contact.userId, status: 'ACTIVE' },
      select: { name: true },
    })
    .then((projects) => projects.map((p) => p.name))
    .catch(() => [] as string[])

  const degraded = await degradedSupportReply({
    contactName: contact.name,
    clientName: contact.clientName,
    projectNames,
    lastMessage,
  })
  const reply = degraded ?? CLIENT_ACK_MESSAGE

  // The conversation exists by now, so the record can stay truthful - but the
  // database may be the very thing that failed, so nothing here may throw.
  await SupportConversationService.appendHistory(
    { chatId, clientId: contact.clientId, contactId: contact.id, userId: contact.userId },
    [
      { role: 'user', content: lastMessage },
      { role: 'assistant', content: reply },
    ]
  ).catch(() => {})

  try {
    const ownerChatId = await WhatsAppAgentService.resolveOwnerChatId()
    if (ownerChatId && ownerChatId !== chatId) {
      await WahaService.sendMessage({
        chatId: ownerChatId,
        text: degradedTurnOwnerNotice({
          contactName: contact.name,
          clientName: contact.clientName,
          snippet: lastMessage,
        }),
      })
    }
  } catch (notifyError) {
    console.error('Failed to notify the owner about a degraded turn:', notifyError)
  }

  return reply
}

async function handleUnknownSender(
  sender: Extract<WhatsAppSender, { kind: 'UNKNOWN' }>,
  text: string
) {
  await WahaService.sendMessage({
    chatId: sender.chatId,
    text: UNKNOWN_SENDER_HOLD_MESSAGE,
  })

  const ownerChatId = await WhatsAppAgentService.resolveOwnerChatId()

  if (!ownerChatId) {
    console.warn('No owner chat id available - skipping unknown sender notification')
    return
  }

  // The owner reaches this branch only when his own number failed to resolve;
  // notifying him about himself would just be noise on top of the hold message.
  if (ownerChatId === sender.chatId) return

  await WahaService.sendMessage({
    chatId: ownerChatId,
    text: unknownSenderOwnerNotice({
      phone: sender.phone,
      chatId: sender.chatId,
      contactName: sender.contact?.name,
      message: text,
    }),
  })
}
