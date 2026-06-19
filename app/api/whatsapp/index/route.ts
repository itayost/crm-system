import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    if (body.event !== 'message') {
      return NextResponse.json({ ok: true })
    }

    const message = body.payload
    if (!message?.body || !message?.from) {
      return NextResponse.json({ ok: true })
    }

    const rawChatId = message.fromMe ? message.to : message.from
    const session = process.env.WAHA_PERSONAL_SESSION ?? 'personal'
    const resolvedPhone = await WahaService.getPhoneFromChatId(rawChatId, session)

    // Never drop a message: if the LID can't be resolved to a phone yet,
    // keep the raw chat id so a later pass can re-resolve and attribute it.
    const phoneNumber = resolvedPhone ?? rawChatId

    let contact: { id: string; clientId: string | null } | null = null
    if (resolvedPhone) {
      const normalized = resolvedPhone.replace(/[-\s]/g, '')
      contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { phone: normalized },
            { phone: { endsWith: normalized.slice(-7) } },
          ],
        },
        select: { id: true, clientId: true },
      })
    }

    // Store every message. Unknown numbers land with contactId=null (unattributed)
    // and wait for manual attribution; they are never auto-extracted.
    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber,
        rawChatId,
        direction: message.fromMe ? 'OUTGOING' : 'INCOMING',
        content: message.body,
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
