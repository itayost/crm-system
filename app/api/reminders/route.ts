import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { NotificationsService } from '@/lib/services/notifications.service'

const reminderSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.coerce.date(),
})

// POST /api/reminders — create a scheduled reminder
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const data = reminderSchema.parse(body)

    if (data.scheduledFor <= new Date()) {
      return errorResponse('תאריך התזכורת חייב להיות בעתיד', 400)
    }

    const notification = await NotificationsService.createReminder(userId, {
      entityType: data.entityType,
      entityId: data.entityId,
      title: data.title,
      message: data.message,
      scheduledFor: data.scheduledFor,
    })

    return createResponse({ success: true, notification })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('פרמטרים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'שגיאה ביצירת תזכורת')
  }
})
