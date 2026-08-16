import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'

/**
 * A client's recent WhatsApp traffic, across all their contacts.
 *
 * ClientsService.getMessages has sat unused since the client page's
 * "ציר זמן שיחות" card was stubbed out with "יתווסף בקרוב". This is the route
 * it was written for.
 */
export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const days = Number(new URL(req.url).searchParams.get('days') ?? 30)

  return createResponse(
    await ClientsService.getMessages(userId, id, Number.isFinite(days) ? days : 30),
  )
})
