// app/api/webhooks/lead/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { mockDb } from '@/lib/api/mock-db'
import { WhatsAppService } from '@/lib/services/whatsapp.service'

const webhookLeadSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string(),
  message: z.string().optional(),
  source: z.string().optional(),
})

// POST /api/webhooks/lead - Receive lead from external source
export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature (in production)
    const signature = req.headers.get('x-webhook-signature')
    // TODO: Verify signature with WEBHOOK_SECRET
    
    const body = await req.json()
    const validatedData = webhookLeadSchema.parse(body)
    
    const newLead = {
      id: Date.now().toString(),
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      company: '',
      source: 'WEBSITE' as const,
      status: 'NEW' as const,
      projectType: '',
      estimatedBudget: 0,
      notes: validatedData.message,
      userId: 'user_123', // Default user for webhooks
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    mockDb.leads.push(newLead)

    // Send WhatsApp notification
    try {
      await WhatsAppService.sendNewLeadNotification({
        name: newLead.name,
        phone: newLead.phone,
        source: newLead.source,
        estimatedBudget: newLead.estimatedBudget || undefined
      })
      console.log('WhatsApp notification sent for webhook lead:', newLead.name)
    } catch (whatsappError) {
      console.error('Failed to send WhatsApp notification:', whatsappError)
      // Don't fail the webhook if WhatsApp fails
    }

    console.log('New lead received via webhook:', newLead)

    return createResponse({
      success: true,
      leadId: newLead.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid webhook data', 400)
    }
    return errorResponse('Webhook processing failed', 500)
  }
}