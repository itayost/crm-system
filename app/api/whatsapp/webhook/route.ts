import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''
const OWNER_PHONE = process.env.WHATSAPP_OWNER_PHONE ?? ''

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
    console.log('Webhook payload:', JSON.stringify({ event: body.event, session: body.session, fromMe: message?.fromMe, body: message?.body?.substring(0, 50), from: message?.from }))

    if (!message?.body || message.fromMe) {
      return NextResponse.json({ ok: true })
    }

    const user = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
    })

    if (!user) {
      console.error('No OWNER user found in database')
      return NextResponse.json({ ok: true })
    }

    const reply = await WhatsAppAgentService.processMessage(user.id, message.body)

    await WahaService.sendMessage({
      chatId: message.from,
      text: reply,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp bot webhook error:', error)

    // Try to send error message back
    try {
      const body = await req.clone().json()
      if (body.payload?.from) {
        await WahaService.sendMessage({
          chatId: body.payload.from,
          text: 'שגיאה בעיבוד ההודעה. נסה שוב.',
        })
      }
    } catch {
      // Ignore error sending error message
    }

    return NextResponse.json({ ok: true })
  }
}
