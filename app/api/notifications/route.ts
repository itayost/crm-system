import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { NotificationsService } from '@/lib/services/notifications.service'

// GET /api/notifications?unread=true
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const countOnly = searchParams.get('countOnly') === 'true'

    // Lightweight path for sidebar badge polling
    if (countOnly) {
      const unreadCount = await NotificationsService.getUnreadCount(userId)
      return createResponse({ unreadCount })
    }

    const [notifications, unreadCount] = await Promise.all([
      NotificationsService.getNotifications(userId, { unreadOnly }),
      NotificationsService.getUnreadCount(userId),
    ])

    return createResponse({ notifications, unreadCount })
  } catch (error) {
    return errorResponse((error as Error).message || 'שגיאה בטעינת התראות')
  }
})

const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

// PUT /api/notifications — bulk mark as read
export const PUT = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const { ids } = markReadSchema.parse(body)

    const count = await NotificationsService.markAsRead(userId, ids)
    return createResponse({ success: true, count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('פרמטרים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'שגיאה בעדכון התראות')
  }
})
