import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'
import { createClientSchema } from '@/lib/validations/client'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const { searchParams } = new URL(req.url)

  const isVipParam = searchParams.get('isVip')

  const clients = await ClientsService.getAll(userId, {
    search: searchParams.get('search') || undefined,
    isVip: isVipParam === null ? undefined : isVipParam === 'true',
  })

  return createResponse(clients)
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json()
  const data = createClientSchema.parse(body)
  const client = await ClientsService.create(userId, data)

  return createResponse(client, 201)
})
