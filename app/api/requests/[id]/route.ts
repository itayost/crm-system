import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'
import { updateRequestSchema } from '@/lib/validations/request'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const request = await RequestsService.getById(userId, id)

  return createResponse(request)
})

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateRequestSchema.parse(body)
  const request = await RequestsService.update(userId, id, data)

  return createResponse(request)
})

export const DELETE = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  await RequestsService.delete(userId, id)

  return createResponse({ success: true })
})
