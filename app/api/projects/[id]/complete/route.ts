// app/api/projects/[id]/complete/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'

// POST /api/projects/[id]/complete - Mark project as completed
export const POST = withAuth(async (_req, { params, userId }) => {
  try {
    const { id: projectId } = await params
    const project = await ProjectsService.complete(projectId, userId)
    return createResponse(project)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to complete project')
  }
})
