// app/api/time/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TimeService } from '@/lib/services/time.service'

const updateTimeEntrySchema = z.object({
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.number().optional()
})

// PUT /api/time/[id] - Update time entry
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const { id: timeEntryId } = await params
    const body = await req.json()
    const validatedData = updateTimeEntrySchema.parse(body)
    
    const timeEntry = await TimeService.update(timeEntryId, userId, validatedData)
    
    return createResponse(timeEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update time entry')
  }
})

// DELETE /api/time/[id] - Delete time entry
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const { id: timeEntryId } = await params
    const result = await TimeService.delete(timeEntryId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete time entry')
  }
})