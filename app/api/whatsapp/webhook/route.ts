import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isWebhookAuthorized } from '@/lib/api/webhook-auth'
import { WahaService, botSessionName } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'
import { identifySender, type WhatsAppSender } from '@/lib/services/whatsapp-identity'
import {
  CLIENT_ACK_MESSAGE,
  PROCESSING_ERROR_MESSAGE,
  UNKNOWN_SENDER_HOLD_MESSAGE,
  unknownSenderOwnerNotice,
} from '@/lib/services/whatsapp-messages'
import { parseWahaMessageEvent } from '@/lib/validations/whatsapp'

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
      await handleOwnerMessage(sender.chatId, message.body)
      return NextResponse.json({ ok: true })
    }

    if (sender.kind === 'CLIENT') {
      // Placeholder until slice 2 puts the support agent behind this branch.
      await WahaService.sendMessage({ chatId: sender.chatId, text: CLIENT_ACK_MESSAGE })
      return NextResponse.json({ ok: true })
    }

    await handleUnknownSender(sender, message.body)

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
