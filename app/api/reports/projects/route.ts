// app/api/reports/projects/route.ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ReportsService } from '@/lib/services/reports.service'

// GET /api/reports/projects - Project analytics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const [projectAnalytics, leadFunnelData] = await Promise.all([
      ReportsService.getProjectAnalytics(userId),
      ReportsService.getLeadFunnelData(userId)
    ])
    
    return createResponse({
      projectAnalytics,
      leadFunnelData
    })
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch project analytics')
  }
})