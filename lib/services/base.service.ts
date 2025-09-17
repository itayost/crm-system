import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export class BaseService {
  /**
   * Handle database errors and return user-friendly messages
   */
  protected static handleError(error): never {
    console.error('Database error:', error)
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new Error('הרשומה כבר קיימת במערכת')
      }
      if (error.code === 'P2025') {
        throw new Error('הרשומה לא נמצאה')
      }
      if (error.code === 'P2003') {
        throw new Error('לא ניתן למחוק רשומה זו - קיימות רשומות מקושרות')
      }
    }
    
    throw new Error('אירעה שגיאה בעת העבודה עם המסד נתונים')
  }

  /**
   * Log activity for audit trail
   */
  protected static async logActivity(params: {
    userId: string
    action: string
    entityType: string
    entityId: string
    metadata?: Record<string, unknown>
  }) {
    try {
      await prisma.activity.create({
        data: {
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata || {}
        }
      })
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to log activity:', error)
    }
  }

  /**
   * Create a notification
   */
  protected static async createNotification(params: {
    userId: string
    type: string
    title: string
    message?: string
    entityType?: string
    entityId?: string
  }) {
    try {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          entityType: params.entityType,
          entityId: params.entityId
        }
      })
    } catch (error) {
      console.error('Failed to create notification:', error)
    }
  }
}