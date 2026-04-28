import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

const publicLeadSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string().min(9, 'טלפון חובה').regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).optional(),
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = publicLeadSchema.parse(body)

    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
    })

    if (!owner) {
      return NextResponse.json({ success: false, error: 'No owner user configured' }, { status: 500 })
    }

    const contact = await prisma.contact.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        source: data.source ?? 'WEBSITE',
        estimatedBudget: data.estimatedBudget,
        projectType: data.projectType,
        notes: data.notes,
        status: 'NEW',
        userId: owner.id,
      },
      select: { id: true, name: true, phone: true },
    })

    // Send WhatsApp notification to owner (fire and forget — don't block response)
    notifyOwnerOfNewLead(contact, data).catch((err) =>
      console.error('Failed to notify owner of new lead:', err)
    )

    return NextResponse.json({ success: true, contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    console.error('Public lead submission error:', error)
    return NextResponse.json(
      { success: false, error: 'שגיאה בשליחת הטופס' },
      { status: 500 }
    )
  }
}

type LeadData = z.infer<typeof publicLeadSchema>

async function notifyOwnerOfNewLead(
  contact: { id: string; name: string; phone: string },
  data: LeadData
) {
  const ownerChatId = await WhatsAppAgentService.getOwnerChatId()
  if (!ownerChatId) {
    console.log('No owner chatId set — skipping new lead notification')
    return
  }

  const lines = [
    '🔔 *ליד חדש מהאתר!*',
    '',
    `*שם:* ${contact.name}`,
    `*טלפון:* ${contact.phone}`,
  ]

  if (data.email) lines.push(`*אימייל:* ${data.email}`)
  if (data.company) lines.push(`*חברה:* ${data.company}`)
  if (data.projectType) lines.push(`*סוג פרויקט:* ${data.projectType}`)
  if (data.estimatedBudget) lines.push(`*תקציב משוער:* ${data.estimatedBudget.toLocaleString()} ₪`)
  if (data.notes) {
    lines.push('')
    lines.push(`*הודעה:*`)
    lines.push(data.notes)
  }

  await WahaService.sendMessage({
    chatId: ownerChatId,
    text: lines.join('\n'),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
