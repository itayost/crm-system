// app/api/time/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

const createTimeEntrySchema = z.object({
  taskId: z.string().optional(),
  projectId: z.string(),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.number().optional()
})

// GET /api/time - Get all time entries with filters
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const taskId = searchParams.get('taskId') || undefined
    const period = searchParams.get('period') as 'today' | 'week' | 'month' | undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const timeEntries = await TimeService.getAll(userId, {
      projectId,
      taskId,
      period,
      startDate,
      endDate
    })

    return createResponse(timeEntries)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch time entries')
  }
})

// POST /api/time - Create manual time entry
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createTimeEntrySchema.parse(body)
    
    const timeEntry = await TimeService.create(userId, validatedData)
    
    return createResponse(timeEntry, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create time entry')
  }
})