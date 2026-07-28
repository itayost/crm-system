import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { PhasesService } from '@/lib/services/phases.service'
import { updatePhaseSchema } from '@/lib/validations/phase'

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id: projectId, phaseId } = await params
  const data = updatePhaseSchema.parse(await req.json())

  // Reordering rewrites two rows, so it answers with the whole list rather
  // than the one phase the caller named.
  if (data.move) {
    const phases = await PhasesService.move(userId, projectId, phaseId, data.move)
    return createResponse(phases)
  }

  const phase = await PhasesService.update(userId, projectId, phaseId, data)
  return createResponse(phase)
})

export const DELETE = withAuth(async (_req: NextRequest, { params, userId }) => {
  const { id: projectId, phaseId } = await params
  await PhasesService.delete(userId, projectId, phaseId)
  return createResponse({ success: true })
})
