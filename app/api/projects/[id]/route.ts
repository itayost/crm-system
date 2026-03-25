import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { updateProjectSchema } from '@/lib/validations/project'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const project = await ProjectsService.getById(userId, id)

  return createResponse(project)
})

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateProjectSchema.parse(body)
  const project = await ProjectsService.update(userId, id, data)

  return createResponse(project)
})

export const DELETE = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  await ProjectsService.delete(userId, id)

  return createResponse({ success: true })
})
