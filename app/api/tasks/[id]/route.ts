import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { updateTaskSchema } from '@/lib/validations/task'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const task = await TasksService.getById(userId, id)

  return createResponse(task)
})

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateTaskSchema.parse(body)
  const task = await TasksService.update(userId, id, data)

  return createResponse(task)
})

export const DELETE = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  await TasksService.delete(userId, id)

  return createResponse({ success: true })
})
