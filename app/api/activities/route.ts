import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { prisma } from '@/lib/db/prisma'

const entityQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// GET /api/activities?entityType=Lead&entityId=xxx
// GET /api/activities?limit=10  (recent mode — no entity filter)
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const limitParam = searchParams.get('limit')

    // Entity-specific mode: requires both entityType and entityId
    if (entityType && entityId) {
      const params = entityQuerySchema.parse({
        entityType,
        entityId,
        limit: limitParam || 50,
      })

      const activities = await prisma.activity.findMany({
        where: {
          userId,
          entityType: params.entityType,
          entityId: params.entityId,
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
      })

      return createResponse(activities)
    }

    // Recent mode: return last N activities for the user
    const limit = Math.min(Math.max(Number(limitParam) || 10, 1), 50)
    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return createResponse(activities)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('פרמטרים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to fetch activities')
  }
})
