// app/api/payments/overdue/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'

// GET /api/payments/overdue - Get overdue payments
export const GET = withAuth(async (req, { userId }) => {
  try {
    const payments = await PaymentsService.getOverdue(userId)
    return createResponse(payments)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch overdue payments')
  }
})