import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { NotificationsService } from '@/lib/services/notifications.service'

// PUT /api/notifications/:id — mark single as read
export const PUT = withAuth(async (_req, { params, userId }) => {
  try {
    const { id } = await params
    const count = await NotificationsService.markAsRead(userId, [id])

    if (count === 0) {
      return errorResponse('התראה לא נמצאה', 404)
    }

    return createResponse({ success: true })
  } catch (error) {
    return errorResponse((error as Error).message || 'שגיאה בעדכון התראה')
  }
})
