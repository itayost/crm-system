// app/api/leads/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { LeadsService } from '@/lib/services/leads.service'
import { LeadStatus } from '@prisma/client'

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(9).optional(),
  company: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CONVERTED', 'LOST']).optional(),
  projectType: z.string().optional(),
  estimatedBudget: z.number().optional(),
  notes: z.string().optional(),
})

// GET /api/leads/[id] - Get single lead
export const GET = withAuth(async (req, { params, userId }) => {
  try {
    const { id: leadId } = await params
    const lead = await LeadsService.getById(leadId, userId)
    return createResponse(lead)
  } catch (error) {
    return errorResponse((error as Error).message || 'Lead not found', 404)
  }
})

// PUT /api/leads/[id] - Update lead
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const { id: leadId } = await params
    const body = await req.json()
    const validatedData = updateLeadSchema.parse(body)
    
    const lead = await LeadsService.update(leadId, userId, {
      ...validatedData,
      status: validatedData.status as LeadStatus | undefined
    })
    
    return createResponse(lead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update lead')
  }
})

// DELETE /api/leads/[id] - Delete lead
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const { id: leadId } = await params
    const result = await LeadsService.delete(leadId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete lead')
  }
})