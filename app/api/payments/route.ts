// app/api/payments/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'
import { PaymentStatus, PaymentType } from '@prisma/client'

const createPaymentSchema = z.object({
  amount: z.number().positive('הסכום חייב להיות חיובי'),
  clientId: z.string().min(1, 'לקוח חובה'),
  projectId: z.string().optional(),
  type: z.enum(['PROJECT', 'MAINTENANCE', 'CONSULTATION', 'RECURRING', 'OTHER']),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  dueDate: z.string(),
  invoiceNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
  recurringPaymentId: z.string().optional(),
})

// GET /api/payments - Get all payments
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as PaymentStatus | null
    const type = searchParams.get('type') as PaymentType | null
    const clientId = searchParams.get('clientId') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    
    const payments = await PaymentsService.getAll(userId, {
      status: status || undefined,
      type: type || undefined,
      clientId,
      projectId,
      startDate,
      endDate
    })
    
    return createResponse(payments)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch payments')
  }
})

// POST /api/payments - Create new payment
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createPaymentSchema.parse(body)
    
    const payment = await PaymentsService.create(userId, {
      ...validatedData,
      type: validatedData.type as PaymentType,
      status: validatedData.status as PaymentStatus | undefined
    })
    
    return createResponse(payment, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create payment')
  }
})