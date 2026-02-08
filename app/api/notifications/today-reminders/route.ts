import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { NotificationsService } from '@/lib/services/notifications.service'

// GET /api/notifications/today-reminders
export const GET = withAuth(async (_req, { userId }) => {
  try {
    const reminders = await NotificationsService.getTodayReminders(userId)
    return createResponse({ reminders })
  } catch (error) {
    return errorResponse((error as Error).message || 'שגיאה בטעינת תזכורות')
  }
})
