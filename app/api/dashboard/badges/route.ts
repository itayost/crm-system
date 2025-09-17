import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { DashboardService } from '@/lib/services/dashboard.service'

// GET /api/dashboard/badges - Get sidebar badge counts
export const GET = withAuth(async (req, { userId }) => {
  try {
    const badges = await DashboardService.getSidebarBadges(userId)
    
    return createResponse(badges)
  } catch (error) {
    console.error('Error fetching badges:', error)
    return errorResponse((error as Error).message || 'Failed to fetch dashboard badges')
  }
})