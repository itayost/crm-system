// app/api/public/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { LeadsService } from '@/lib/services/leads.service'
import { LeadSource } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

const publicLeadSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().nullable(),
  phone: z.string().min(1, 'טלפון חובה').transform(val => val.replace(/[-\s]/g, '')).refine(
    val => /^[0-9]{9,10}$/.test(val),
    'מספר טלפון חייב להיות 9-10 ספרות'
  ),
  company: z.string().optional(),
  projectType: z.string().optional(),
  estimatedBudget: z.number().optional(),
  notes: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).default('WEBSITE'),
})

// POST /api/public/leads - Create new lead from public form
export async function POST(req: NextRequest) {
  try {
    // Add CORS headers for cross-origin requests
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers })
    }

    const body = await req.json()
    const validatedData = publicLeadSchema.parse(body)

    // Get the first user (owner) to associate the lead with
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' }
    })

    if (!owner) {
      return NextResponse.json(
        { error: 'לא נמצא משתמש במערכת' },
        { status: 500, headers }
      )
    }

    const lead = await LeadsService.create(owner.id, {
      name: validatedData.name,
      phone: validatedData.phone,
      email: validatedData.email || undefined,
      company: validatedData.company,
      projectType: validatedData.projectType,
      estimatedBudget: validatedData.estimatedBudget,
      notes: validatedData.notes,
      source: validatedData.source as LeadSource
    })

    // TODO: Send WhatsApp notification to owner
    // TODO: Send email confirmation to lead

    return NextResponse.json(
      {
        success: true,
        message: 'הליד נוצר בהצלחה! ניצור איתך קשר בקרוב.',
        data: { id: lead.id }
      },
      { status: 201, headers }
    )
  } catch (error) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'נתונים לא תקינים: ' + error.issues[0].message },
        { status: 400, headers }
      )
    }

    return NextResponse.json(
      { error: 'שגיאה ביצירת הליד. נסה שוב מאוחר יותר.' },
      { status: 500, headers }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}