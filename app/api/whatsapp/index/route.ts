import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isWebhookAuthorized } from '@/lib/api/webhook-auth'
import { WahaService, personalSessionName } from '@/lib/services/waha.service'
import { findContactByPhone } from '@/lib/services/whatsapp-identity'
import { parseWahaMessageEvent } from '@/lib/validations/whatsapp'

export async function POST(req: Request) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const message = parseWahaMessageEvent(await req.json())
    // Text-only archive: media on the personal session stays out of scope, so a
    // bare voice note is skipped here exactly as it was before.
    if (!message?.body) {
      return NextResponse.json({ ok: true })
    }

    const content = message.body
    const rawChatId = message.fromMe ? message.to : message.from
    if (!rawChatId) {
      return NextResponse.json({ ok: true })
    }

    const session = personalSessionName()
    const resolvedPhone = await WahaService.getPhoneFromChatId(rawChatId, session)

    // Never drop a message: if the LID can't be resolved to a phone yet,
    // keep the raw chat id so a later pass can re-resolve and attribute it.
    const phoneNumber = resolvedPhone ?? rawChatId

    const contact = resolvedPhone ? await findContactByPhone(resolvedPhone) : null

    // Store every message. Unknown numbers land with contactId=null (unattributed)
    // and wait for manual attribution; they are never auto-extracted.
    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber,
        rawChatId,
        direction: message.fromMe ? 'OUTGOING' : 'INCOMING',
        content,
        contactId: contact?.id ?? null,
        clientId: contact?.clientId ?? null,
        sessionName: session,
        timestamp: new Date(message.timestamp * 1000),
      },
    })

    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastContactedAt: new Date() },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp index webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
