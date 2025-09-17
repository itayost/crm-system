// app/api/payments/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'
import { PaymentStatus, PaymentType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.enum(['PROJECT', 'MAINTENANCE', 'CONSULTATION', 'RECURRING', 'OTHER']).optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
  invoiceNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
})

// GET /api/payments/[id] - Get single payment
export const GET = withAuth(async (req, { params, userId }) => {
  try {
    const paymentId = params.id as string
    
    const payment = await prisma.payment.findFirst({
      where: { 
        id: paymentId,
        userId 
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        recurringPayment: {
          select: {
            id: true,
            name: true,
            frequency: true
          }
        }
      }
    })
    
    if (!payment) {
      return errorResponse('תשלום לא נמצא', 404)
    }
    
    return createResponse(payment)
  } catch (error) {
    return errorResponse((error as Error).message || 'Payment not found', 404)
  }
})

// PUT /api/payments/[id] - Update payment
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const paymentId = params.id as string
    const body = await req.json()
    const validatedData = updatePaymentSchema.parse(body)
    
    const payment = await PaymentsService.update(paymentId, userId, {
      ...validatedData,
      type: validatedData.type as PaymentType | undefined,
      status: validatedData.status as PaymentStatus | undefined
    })
    
    return createResponse(payment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update payment')
  }
})

// DELETE /api/payments/[id] - Delete payment
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const paymentId = params.id as string
    const result = await PaymentsService.delete(paymentId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete payment')
  }
})