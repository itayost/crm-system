// app/api/reports/dashboard/route.ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ReportsService } from '@/lib/services/reports.service'

// GET /api/reports/dashboard - Main dashboard metrics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const metrics = await ReportsService.getDashboardMetrics(userId)
    
    return createResponse(metrics)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch dashboard metrics')
  }
})