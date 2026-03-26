import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { createTaskSchema } from '@/lib/validations/task'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const { searchParams } = new URL(req.url)

  const tasks = await TasksService.getAll(userId, {
    status: searchParams.get('status') || undefined,
    category: searchParams.get('category') || undefined,
    projectId: searchParams.get('projectId') || undefined,
    standalone: searchParams.get('standalone') === 'true' || undefined,
    search: searchParams.get('search') || undefined,
  })

  return createResponse(tasks)
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json()
  const data = createTaskSchema.parse(body)
  const task = await TasksService.create(userId, data)

  return createResponse(task, 201)
})
