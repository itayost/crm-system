import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isWebhookAuthorized } from '@/lib/api/webhook-auth'
import { WahaService, botSessionName } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'
import { identifySender, type WhatsAppSender } from '@/lib/services/whatsapp-identity'
import { SupportAgentService } from '@/lib/services/support-agent.service'
import { archiveBotMessage, releaseArchivedMessage } from '@/lib/services/whatsapp-archive'
import { processIncomingMedia } from '@/lib/services/support-media.service'
import {
  CLIENT_ACK_MESSAGE,
  MEDIA_ONLY_PLACEHOLDER,
  OWNER_MEDIA_UNSUPPORTED_MESSAGE,
  PROCESSING_ERROR_MESSAGE,
  UNKNOWN_SENDER_HOLD_MESSAGE,
  unknownSenderOwnerNotice,
} from '@/lib/services/whatsapp-messages'
import { parseWahaMessageEvent, type WahaMessage } from '@/lib/validations/whatsapp'

/**
 * Bot-session webhook. Every sender is classified before anything happens:
 * only the owner's own phone reaches the owner agent and its CRM tools.
 */
export async function POST(req: Request) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const message = parseWahaMessageEvent(await req.json())

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
      await handleClientMessage(sender, message)
      return NextResponse.json({ ok: true })
    }

    await handleUnknownSender(sender, message.body ?? MEDIA_ONLY_PLACEHOLDER)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp bot webhook error:', error)

    // Try to send error message back
    try {
      const body = await req.clone().json()
      if (body.payload?.from) {
        await WahaService.sendMessage({
          chatId: body.payload.from,
          text: PROCESSING_ERROR_MESSAGE,
        })
      }
    } catch {
      // Ignore error sending error message
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
        caption: message.body,
      })
    : null

  if (media?.failure) {
    console.warn(`Support media unusable for client ${contact.clientId}: ${media.failure}`)
  }

  const agentText = media ? media.agentText : (message.body ?? '')

  // Archived first, and already marked processed, so the batch extraction never
  // drafts a second ticket for a message the support agent is handling live.
  const sourceMessageId = await archiveBotMessage({
    chatId: sender.chatId,
    phone: sender.phone,
    content: message.body || agentText,
    contactId: contact.id,
    clientId: contact.clientId,
    timestamp: message.timestamp,
    mediaPath: media?.path,
    mediaMimeType: media?.path ? media.mimeType : null,
    transcript: media?.transcript,
  })

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
    })
  } catch (error) {
    console.error('Support agent error:', error)
    // Hand the message back to the batch extraction, which skips anything already
    // marked processed - otherwise a gateway outage would lose the request entirely.
    await releaseArchivedMessage(sourceMessageId).catch((releaseError) => {
      console.error('Failed to release archived message for extraction:', releaseError)
    })
    reply = CLIENT_ACK_MESSAGE
  }

  await WahaService.sendMessage({ chatId: sender.chatId, text: reply })
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
