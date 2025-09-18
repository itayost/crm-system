// app/api/public/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { LeadsService } from '@/lib/services/leads.service'
import { LeadSource } from '@prisma/client'
import { prisma } from '@/lib/db'

const publicLeadSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().min(9, 'טלפון חובה'),
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
      return errorResponse('לא נמצא משתמש במערכת', 500, headers)
    }

    const lead = await LeadsService.create(owner.id, {
      ...validatedData,
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
    if (error instanceof z.ZodError) {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
      return errorResponse('נתונים לא תקינים: ' + error.errors[0].message, 400, headers)
    }
    return errorResponse('שגיאה ביצירת הליד. נסה שוב מאוחר יותר.', 500, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}