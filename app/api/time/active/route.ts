// app/api/time/active/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

// GET /api/time/active - Get active timer
export const GET = withAuth(async (req, { userId }) => {
  try {
    const activeTimer = await TimeService.getActiveTimer(userId)
    
    return createResponse(activeTimer)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to get active timer')
  }
})