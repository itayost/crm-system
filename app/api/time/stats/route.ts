// app/api/time/stats/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

// GET /api/time/stats - Get time statistics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') as 'day' | 'week' | 'month' || 'week'

    const stats = await TimeService.getStatistics(userId, period)
    
    return createResponse(stats)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to get time statistics')
  }
})