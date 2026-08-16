import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { RequestMetricsService } from '@/lib/services/request-metrics.service'

/**
 * The pipeline and the decision queues, in one call.
 *
 * Its own route rather than a field on /api/dashboard because the requests
 * screen needs it too, and the dashboard aggregate is already thirteen queries
 * that every page load pays for.
 */
export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const clientId = new URL(req.url).searchParams.get('clientId') || undefined

  return createResponse(await RequestMetricsService.get(userId, clientId))
})
