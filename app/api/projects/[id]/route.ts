// app/api/projects/[id]/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { ProjectType, ProjectStage, ProjectPriority } from '@prisma/client'

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  type: z.enum(['LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION']).optional(),
  stage: z.enum(['PLANNING', 'DEVELOPMENT', 'TESTING', 'REVIEW', 'DELIVERY']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  budget: z.number().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  completedAt: z.string().optional(),
})

// GET /api/projects/[id] - Get single project
export const GET = withAuth(async (req, { params, userId }) => {
  try {
    const projectId = params.id as string
    const project = await ProjectsService.getById(projectId, userId)
    return createResponse(project)
  } catch (error) {
    return errorResponse((error as Error).message || 'Project not found', 404)
  }
})

// PUT /api/projects/[id] - Update project
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const projectId = params.id as string
    const body = await req.json()
    const validatedData = updateProjectSchema.parse(body)
    
    const project = await ProjectsService.update(projectId, userId, {
      ...validatedData,
      type: validatedData.type as ProjectType | undefined,
      stage: validatedData.stage as ProjectStage | undefined,
      priority: validatedData.priority as ProjectPriority | undefined
    })
    
    return createResponse(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update project')
  }
})

// DELETE /api/projects/[id] - Delete project
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const projectId = params.id as string
    const result = await ProjectsService.delete(projectId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete project')
  }
})