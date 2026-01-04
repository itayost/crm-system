// app/api/reports/revenue/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ReportsService } from '@/lib/services/reports.service'

// GET /api/reports/revenue - Revenue analytics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const months = parseInt(searchParams.get('months') || '12')
    
    const [revenueData, clientAnalytics] = await Promise.all([
      ReportsService.getRevenueAnalytics(userId, months),
      ReportsService.getClientAnalytics(userId)
    ])
    
    return createResponse({
      revenueData,
      clientAnalytics
    })
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch revenue analytics')
  }
})