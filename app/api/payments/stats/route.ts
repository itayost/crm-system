// app/api/payments/stats/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { PaymentsService } from '@/lib/services/payments.service'

// GET /api/payments/stats - Get payment statistics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const stats = await PaymentsService.getStatistics(userId)
    return createResponse(stats)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch payment statistics')
  }
})