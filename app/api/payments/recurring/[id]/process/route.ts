// app/api/payments/recurring/[id]/process/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'

// POST /api/payments/recurring/[id]/process - Process recurring payment
export const POST = withAuth(async (req, { params, userId }) => {
  try {
    const recurringPaymentId = params.id as string
    const payment = await PaymentsService.processRecurringPayment(recurringPaymentId, userId)
    return createResponse(payment)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to process recurring payment')
  }
})