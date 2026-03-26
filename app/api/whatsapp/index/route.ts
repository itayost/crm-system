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

    const phoneNumber = WahaService.extractPhoneNumber(
      message.fromMe ? message.to : message.from
    )

    const normalized = phoneNumber.replace(/[-\s]/g, '')
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { phone: normalized },
          { phone: { endsWith: normalized.slice(-7) } },
        ],
      },
      select: { id: true },
    })

    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber,
        direction: message.fromMe ? 'OUTGOING' : 'INCOMING',
        content: message.body,
        contactId: contact?.id ?? null,
        sessionName: process.env.WAHA_PERSONAL_SESSION ?? 'personal',
        timestamp: new Date(message.timestamp * 1000),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp index webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
