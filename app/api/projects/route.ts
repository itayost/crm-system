import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { createProjectSchema } from '@/lib/validations/project'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const { searchParams } = new URL(req.url)

  const projects = await ProjectsService.getAll(userId, {
    status: searchParams.get('status') || undefined,
    contactId: searchParams.get('contactId') || undefined,
    search: searchParams.get('search') || undefined,
  })

  return createResponse(projects)
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json()
  const data = createProjectSchema.parse(body)
  const project = await ProjectsService.create(userId, data)

  return createResponse(project, 201)
})
