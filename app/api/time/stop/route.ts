// app/api/time/stop/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

// POST /api/time/stop - Stop active timer
export const POST = withAuth(async (req, { userId }) => {
  try {
    const timeEntry = await TimeService.stopTimer(userId)
    
    return createResponse(timeEntry)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to stop timer')
  }
})