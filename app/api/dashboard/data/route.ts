import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { DashboardService } from '@/lib/services/dashboard.service'

// GET /api/dashboard/data - Get dashboard data
export const GET = withAuth(async (req, { userId }) => {
  try {
    const data = await DashboardService.getDashboardData(userId)
    
    return createResponse(data)
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return errorResponse((error as Error).message || 'Failed to fetch dashboard data')
  }
})