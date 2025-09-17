// app/api/payments/recurring/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'
import { Frequency } from '@prisma/client'

const updateRecurringPaymentSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  nextDueDate: z.string().optional(),
  lastPaidDate: z.string().optional(),
  isActive: z.boolean().optional(),
  serviceType: z.string().optional(),
  description: z.string().optional(),
})

// PUT /api/payments/recurring/[id] - Update recurring payment
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const { id: recurringPaymentId } = await params
    const body = await req.json()
    const validatedData = updateRecurringPaymentSchema.parse(body)
    
    const recurringPayment = await PaymentsService.updateRecurring(
      recurringPaymentId,
      userId,
      {
        ...validatedData,
        frequency: validatedData.frequency as Frequency | undefined
      }
    )
    
    return createResponse(recurringPayment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update recurring payment')
  }
})

// POST /api/payments/recurring/[id]/process - Process recurring payment (create next payment)
export const POST = withAuth(async (req, { params, userId }) => {
  try {
    const { id: recurringPaymentId } = await params
    const payment = await PaymentsService.processRecurringPayment(recurringPaymentId, userId)
    return createResponse(payment)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to process recurring payment')
  }
})