// app/api/leads/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { LeadsService } from '@/lib/services/leads.service'
import { LeadStatus, LeadSource } from '@prisma/client'

const createLeadSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().min(9, 'טלפון חובה'),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']),
  projectType: z.string().optional(),
  estimatedBudget: z.number().optional(),
  notes: z.string().optional(),
})

// GET /api/leads - Get all leads
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as LeadStatus | null
    const source = searchParams.get('source') as LeadSource | null
    const search = searchParams.get('search') || undefined
    
    const leads = await LeadsService.getAll(userId, {
      status: status || undefined,
      source: source || undefined,
      search
    })
    
    return createResponse(leads)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch leads')
  }
})

// POST /api/leads - Create new lead
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createLeadSchema.parse(body)
    
    const lead = await LeadsService.create(userId, {
      ...validatedData,
      source: validatedData.source as LeadSource
    })
    
    // TODO: Send WhatsApp notification here
    
    return createResponse(lead, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create lead')
  }
})