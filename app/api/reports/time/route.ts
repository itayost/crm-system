// app/api/reports/time/route.ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ReportsService } from '@/lib/services/reports.service'

// GET /api/reports/time - Time analytics
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    
    const timeData = await ReportsService.getTimeAnalytics(userId, days)
    
    return createResponse(timeData)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch time analytics')
  }
})