import { prisma } from '@/lib/db/prisma'
import { NotificationType } from '@prisma/client'

export class NotificationsService {
  /**
   * Get notifications for a user.
   * Filters out future scheduled notifications (scheduledFor > now).
   */
  static async getNotifications(userId: string, options: {
    unreadOnly?: boolean
    limit?: number
  } = {}) {
    const { unreadOnly = false, limit = 50 } = options
    const now = new Date()

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: now } },
      ],
    }

    const notifications = await prisma.notification.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        entityType: true,
        entityId: true,
        scheduledFor: true,
        createdAt: true,
      },
      orderBy: [
        { isRead: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    return notifications
  }

  /**
   * Get unread notification count (excluding future scheduled).
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const now = new Date()

    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
    })
  }

  /**
   * Mark notifications as read. Only marks those owned by the user.
   */
  static async markAsRead(userId: string, ids: string[]): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId,
      },
      data: { isRead: true },
    })

    return result.count
  }

  /**
   * Create a scheduled reminder (stored as a notification with scheduledFor).
   */
  static async createReminder(userId: string, data: {
    entityType: string
    entityId: string
    title: string
    message: string
    scheduledFor: Date
  }) {
    return prisma.notification.create({
      data: {
        userId,
        type: 'DEADLINE_APPROACHING' as NotificationType,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        scheduledFor: data.scheduledFor,
      },
    })
  }

  /**
   * Get today's reminders (notifications with scheduledFor within today).
   */
  static async getTodayReminders(userId: string) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    return prisma.notification.findMany({
      where: {
        userId,
        scheduledFor: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { scheduledFor: 'asc' },
    })
  }
}
