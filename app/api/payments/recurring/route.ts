// app/api/payments/recurring/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'
import { Frequency } from '@prisma/client'

const createRecurringPaymentSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  amount: z.number().positive('הסכום חייב להיות חיובי'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  nextDueDate: z.string(),
  clientId: z.string().min(1, 'לקוח חובה'),
  serviceType: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/payments/recurring - Get all recurring payments
export const GET = withAuth(async (req, { userId }) => {
  try {
    const recurringPayments = await PaymentsService.getAllRecurring(userId)
    return createResponse(recurringPayments)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch recurring payments')
  }
})

// POST /api/payments/recurring - Create new recurring payment
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createRecurringPaymentSchema.parse(body)
    
    const recurringPayment = await PaymentsService.createRecurring(userId, {
      ...validatedData,
      frequency: validatedData.frequency as Frequency
    })
    
    return createResponse(recurringPayment, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create recurring payment')
  }
})