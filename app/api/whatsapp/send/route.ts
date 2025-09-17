import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { WhatsAppService } from '@/lib/services/whatsapp.service'
import { withAuth } from '@/lib/api/auth-handler'

const sendMessageSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['text', 'template']).default('text'),
  templateName: z.string().optional(),
  templateParams: z.record(z.string()).optional(),
})

// POST /api/whatsapp/send - Send WhatsApp message
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const body = await req.json()
    const validatedData = sendMessageSchema.parse(body)

    let result

    if (validatedData.type === 'template' && validatedData.templateName) {
      result = await WhatsAppService.sendTemplateMessage(
        validatedData.to,
        validatedData.templateName,
        validatedData.templateParams || {}
      )
    } else {
      result = await WhatsAppService.sendTextMessage(
        validatedData.to,
        validatedData.message
      )
    }

    // Log the activity
    console.log(`WhatsApp message sent by user ${userId} to ${validatedData.to}`)

    return createResponse({
      success: true,
      messageId: result.messages[0]?.id,
      to: result.contacts[0]?.wa_id,
    })
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)

    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }

    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }

    return errorResponse('Failed to send WhatsApp message', 500)
  }
})