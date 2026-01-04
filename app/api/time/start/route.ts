// app/api/time/start/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

const startTimerSchema = z.object({
  taskId: z.string().optional(),
  projectId: z.string()
})

// POST /api/time/start - Start timer
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const { taskId, projectId } = startTimerSchema.parse(body)
    
    const timeEntry = await TimeService.startTimer(userId, taskId, projectId)
    
    return createResponse(timeEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to start timer')
  }
})