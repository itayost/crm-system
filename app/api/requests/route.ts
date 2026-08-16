import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'
import { createRequestSchema } from '@/lib/validations/request'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const { searchParams } = new URL(req.url)

  const requests = await RequestsService.getAll(userId, {
    status: searchParams.get('status') || undefined,
    type: searchParams.get('type') || undefined,
    clientId: searchParams.get('clientId') || undefined,
    projectId: searchParams.get('projectId') || undefined,
    pendingReview: searchParams.get('pendingReview') === 'true' || undefined,
    excludePending: searchParams.get('excludePending') === 'true' || undefined,
    awaitingClient: searchParams.get('awaitingClient') === 'true' || undefined,
    queue: (searchParams.get('queue') as
      | 'needsPricing'
      | 'unclassified'
      | 'awaitingClient'
      | 'withoutTask'
      | null) || undefined,
    search: searchParams.get('search') || undefined,
  })

  return createResponse(requests)
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json()
  const data = createRequestSchema.parse(body)
  const request = await RequestsService.create(userId, data)

  return createResponse(request, 201)
})
