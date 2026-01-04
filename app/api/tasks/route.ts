// app/api/tasks/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { PriorityScoringService } from '@/lib/services/priority-scoring.service'
import { TaskStatus, Priority } from '@prisma/client'

const createTaskSchema = z.object({
  title: z.string().min(1, 'כותרת חובה'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  assignedToId: z.string().optional(),
  tags: z.array(z.string()).optional()
})

// GET /api/tasks - Get all tasks
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as TaskStatus | null
    const priority = searchParams.get('priority') as Priority | null
    const projectId = searchParams.get('projectId') || undefined
    const clientId = searchParams.get('clientId') || undefined
    const overdue = searchParams.get('overdue') === 'true'
    const dueToday = searchParams.get('dueToday') === 'true'
    const dueThisWeek = searchParams.get('dueThisWeek') === 'true'

    const tasks = await TasksService.getAll(userId, {
      status: status || undefined,
      priority: priority || undefined,
      projectId,
      clientId,
      overdue,
      dueToday,
      dueThisWeek
    })

    return createResponse(tasks)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch tasks')
  }
})

// POST /api/tasks - Create new task
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createTaskSchema.parse(body)
    
    const task = await TasksService.create(userId, {
      ...validatedData,
      priority: validatedData.priority as Priority | undefined
    })
    
    // Calculate and update priority score
    try {
      await PriorityScoringService.updateTaskScore(task.id)
    } catch (error) {
      console.error('Error calculating priority score for new task:', error)
      // Don't fail the request if priority calculation fails
    }
    
    return createResponse(task, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create task')
  }
})