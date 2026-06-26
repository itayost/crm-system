import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'

export const POST = withAuth(async (_req: NextRequest, { params, userId }) => {
  const { id } = await params
  const result = await ClientsService.regenerateFormToken(userId, id)

  return createResponse(result)
})
