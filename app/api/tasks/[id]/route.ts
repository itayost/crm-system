// app/api/tasks/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { TaskStatus, Priority } from '@prisma/client'

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  assignedToId: z.string().optional(),
  tags: z.array(z.string()).optional()
})

// GET /api/tasks/[id] - Get single task
export const GET = withAuth(async (req, { params, userId }) => {
  try {
    const { id: taskId } = await params
    const task = await TasksService.getById(taskId, userId)
    return createResponse(task)
  } catch (error) {
    return errorResponse((error as Error).message || 'Task not found', 404)
  }
})

// PUT /api/tasks/[id] - Update task
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const { id: taskId } = await params
    const body = await req.json()
    const validatedData = updateTaskSchema.parse(body)
    
    const task = await TasksService.update(taskId, userId, {
      ...validatedData,
      status: validatedData.status as TaskStatus | undefined,
      priority: validatedData.priority as Priority | undefined
    })
    
    return createResponse(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update task')
  }
})

// DELETE /api/tasks/[id] - Delete task
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const { id: taskId } = await params
    const result = await TasksService.delete(taskId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete task')
  }
})