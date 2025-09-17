// app/api/projects/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { ProjectStage, Priority, ProjectType } from '@prisma/client'

const createProjectSchema = z.object({
  name: z.string().min(1, 'שם הפרויקט חובה'),
  description: z.string().optional(),
  type: z.enum(['LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION']),
  clientId: z.string().min(1, 'לקוח חובה'),
  budget: z.number().optional(),
  estimatedHours: z.number().optional(),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

// GET /api/projects - Get all projects
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const stage = searchParams.get('stage') as ProjectStage | null
    const priority = searchParams.get('priority') as Priority | null
    const type = searchParams.get('type') as ProjectType | null
    const clientId = searchParams.get('clientId') || undefined
    const search = searchParams.get('search') || undefined
    
    const projects = await ProjectsService.getAll(userId, {
      stage: stage || undefined,
      priority: priority || undefined,
      type: type || undefined,
      clientId,
      search
    })
    
    return createResponse(projects)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch projects')
  }
})

// POST /api/projects - Create new project
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createProjectSchema.parse(body)
    
    const project = await ProjectsService.create(userId, {
      ...validatedData,
      type: validatedData.type as ProjectType,
      priority: validatedData.priority as Priority | undefined
    })
    
    return createResponse(project, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create project')
  }
})