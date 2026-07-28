import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { PhasesService } from '@/lib/services/phases.service'
import { createPhaseSchema } from '@/lib/validations/phase'

export const GET = withAuth(async (_req: NextRequest, { params, userId }) => {
  const { id: projectId } = await params
  const phases = await PhasesService.listByProject(userId, projectId)
  return createResponse(phases)
})

export const POST = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id: projectId } = await params
  const data = createPhaseSchema.parse(await req.json())
  const phase = await PhasesService.create(userId, projectId, data)
  return createResponse(phase, 201)
})
