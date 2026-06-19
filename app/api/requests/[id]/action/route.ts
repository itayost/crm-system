import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'

const actionSchema = z.object({
  action: z.enum(['approve', 'dismiss']),
})

export const POST = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const { action } = actionSchema.parse(await req.json())

  const result =
    action === 'approve'
      ? await RequestsService.approve(userId, id)
      : await RequestsService.dismiss(userId, id)

  return createResponse(result)
})
