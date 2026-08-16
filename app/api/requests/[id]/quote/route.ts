import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'
import { sendQuoteSchema } from '@/lib/validations/request'

/**
 * Put a price on a request and send it to the client.
 *
 * Its own route rather than a field on PUT /requests/[id] because it is a
 * transition with guards - a billable request needs a project to hang its
 * billing phase on - and because a price the client has already agreed to must
 * not be reachable from the generic update path.
 */
export const POST = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const input = sendQuoteSchema.parse(await req.json())

  return createResponse(await RequestsService.sendQuote(userId, id, input))
})
