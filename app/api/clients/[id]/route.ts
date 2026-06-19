import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'
import { updateClientSchema } from '@/lib/validations/client'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const client = await ClientsService.getById(userId, id)

  return createResponse(client)
})

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateClientSchema.parse(body)
  const client = await ClientsService.update(userId, id, data)

  return createResponse(client)
})

export const DELETE = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  await ClientsService.delete(userId, id)

  return createResponse({ success: true })
})
