import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { PaymentStatus, PaymentType, Frequency, Prisma } from '@prisma/client'
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
interface CreatePaymentInput {
  amount: number
  type: PaymentType
  status?: PaymentStatus
  dueDate: Date | string
  invoiceNumber?: string
  receiptNumber?: string
  notes?: string
  clientId: string
  projectId?: string
  recurringPaymentId?: string
}

interface UpdatePaymentInput {
  amount?: number
  type?: PaymentType
  status?: PaymentStatus
  dueDate?: Date | string
  paidAt?: Date | string
  invoiceNumber?: string
  receiptNumber?: string
  notes?: string
  clientId?: string
  projectId?: string
}

interface CreateRecurringPaymentInput {
  name: string
  amount: number
  frequency: Frequency
  nextDueDate: Date | string
  clientId: string
  serviceType?: string
  description?: string
  isActive?: boolean
}

interface UpdateRecurringPaymentInput {
  name?: string
  amount?: number
  frequency?: Frequency
  nextDueDate?: Date | string
  lastPaidDate?: Date | string
  isActive?: boolean
  serviceType?: string
  description?: string
}

interface PaymentFilters {
  status?: PaymentStatus
  type?: PaymentType
  clientId?: string
  projectId?: string
  startDate?: Date | string
  endDate?: Date | string
}

export class PaymentsService extends BaseService {
  /**
   * Get all payments for a user with filters
   */
  static async getAll(userId: string, filters?: PaymentFilters) {
    try {
      const where: Prisma.PaymentWhereInput = {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
        ...(filters?.clientId && { clientId: filters.clientId }),
        ...(filters?.projectId && { projectId: filters.projectId }),
        ...(filters?.startDate && filters?.endDate && {
          dueDate: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate)
          }
        })
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              phone: true
            }
          },
          project: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          recurringPayment: {
            select: {
              id: true,
              name: true,
              frequency: true
            }
          }
        },
        orderBy: [
          { status: 'asc' }, // Pending first
          { dueDate: 'asc' }
        ]
      })

      return payments
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get overdue payments
   */
  static async getOverdue(userId: string) {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: new Date() }
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      })

      // Update status to OVERDUE if not already
      const overdueIds = payments
        .filter(p => p.status === 'PENDING')
        .map(p => p.id)

      if (overdueIds.length > 0) {
        await prisma.payment.updateMany({
          where: { id: { in: overdueIds } },
          data: { status: 'OVERDUE' }
        })
      }

      return payments
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a new payment
   */
  static async create(userId: string, data: CreatePaymentInput) {
    try {
      // Verify client exists and belongs to user
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, userId }
      })

      if (!client) {
        throw new Error('לקוח לא נמצא')
      }

      // Verify project if provided
      if (data.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: data.projectId, userId }
        })
        if (!project) {
          throw new Error('פרויקט לא נמצא')
        }
      }

      const payment = await prisma.payment.create({
        data: {
          ...data,
          userId,
          amount: new Prisma.Decimal(data.amount),
          dueDate: new Date(data.dueDate),
          status: data.status || 'PENDING'
        },
        include: {
          client: true,
          project: true
        }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'PAYMENT_CREATED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          amount: data.amount,
          clientName: client.name,
          type: data.type
        }
      })

      // Create notification for upcoming payment
      const daysUntilDue = Math.ceil((new Date(data.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        await this.createNotification({
          userId,
          type: 'PAYMENT_DUE',
          title: 'תשלום קרוב',
          message: `תשלום בסך ${data.amount}₪ מ${client.name} יגיע בעוד ${daysUntilDue} ימים`,
          entityType: 'Payment',
          entityId: payment.id
        })
      }

      return payment
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a payment
   */
  static async update(paymentId: string, userId: string, data: UpdatePaymentInput) {
    try {
      // First check if payment exists and belongs to user
      const existingPayment = await prisma.payment.findFirst({
        where: { id: paymentId, userId },
        include: { client: true }
      })

      if (!existingPayment) {
        throw new Error('תשלום לא נמצא')
      }

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          ...data,
          amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          paidAt: data.paidAt ? new Date(data.paidAt) : undefined
        },
        include: {
          client: true,
          project: true
        }
      })

      // Log status changes
      if (data.status && data.status !== existingPayment.status) {
        await this.logActivity({
          userId,
          action: 'PAYMENT_STATUS_CHANGED',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            from: existingPayment.status,
            to: data.status,
            amount: payment.amount,
            clientName: payment.client.name
          }
        })

        // If marked as paid, update client revenue
        if (data.status === 'PAID' && existingPayment.status !== 'PAID') {
          await prisma.client.update({
            where: { id: payment.clientId },
            data: {
              totalRevenue: {
                increment: payment.amount
              }
            }
          })

          // Create notification
          await this.createNotification({
            userId,
            type: 'PAYMENT_DUE',
            title: 'תשלום התקבל',
            message: `תשלום בסך ${payment.amount}₪ מ${payment.client.name} סומן כשולם`,
            entityType: 'Payment',
            entityId: payment.id
          })
        }
      }

      return payment
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete a payment
   */
  static async delete(paymentId: string, userId: string) {
    try {
      // Check if payment exists and belongs to user
      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, userId },
        include: { client: true }
      })

      if (!payment) {
        throw new Error('תשלום לא נמצא')
      }

      // Don't allow deleting paid payments
      if (payment.status === 'PAID') {
        throw new Error('לא ניתן למחוק תשלום ששולם')
      }

      await prisma.payment.delete({
        where: { id: paymentId }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'PAYMENT_DELETED',
        entityType: 'Payment',
        entityId: paymentId,
        metadata: {
          amount: payment.amount,
          clientName: payment.client.name
        }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get all recurring payments
   */
  static async getAllRecurring(userId: string) {
    try {
      const recurringPayments = await prisma.recurringPayment.findMany({
        where: { 
          client: {
            userId
          }
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              phone: true
            }
          },
          paymentHistory: {
            select: {
              id: true,
              status: true,
              paidAt: true,
              amount: true
            },
            orderBy: { dueDate: 'desc' },
            take: 5
          },
          _count: {
            select: {
              paymentHistory: true
            }
          }
        },
        orderBy: { nextDueDate: 'asc' }
      })

      return recurringPayments
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a recurring payment
   */
  static async createRecurring(userId: string, data: CreateRecurringPaymentInput) {
    try {
      // Verify client
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, userId }
      })

      if (!client) {
        throw new Error('לקוח לא נמצא')
      }

      const recurringPayment = await prisma.recurringPayment.create({
        data: {
          ...data,
          amount: new Prisma.Decimal(data.amount),
          nextDueDate: new Date(data.nextDueDate),
          isActive: data.isActive !== false
        },
        include: {
          client: true
        }
      })

      // Create the first payment
      await this.create(userId, {
        amount: data.amount,
        type: 'RECURRING',
        dueDate: data.nextDueDate,
        clientId: data.clientId,
        recurringPaymentId: recurringPayment.id,
        notes: `תשלום חוזר: ${data.name}`
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'RECURRING_PAYMENT_CREATED',
        entityType: 'RecurringPayment',
        entityId: recurringPayment.id,
        metadata: {
          name: data.name,
          amount: data.amount,
          frequency: data.frequency,
          clientName: client.name
        }
      })

      return recurringPayment
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a recurring payment
   */
  static async updateRecurring(recurringPaymentId: string, userId: string, data: UpdateRecurringPaymentInput) {
    try {
      const existingPayment = await prisma.recurringPayment.findFirst({
        where: { 
          id: recurringPaymentId,
          client: {
            userId
          }
        }
      })

      if (!existingPayment) {
        throw new Error('תשלום חוזר לא נמצא')
      }

      const recurringPayment = await prisma.recurringPayment.update({
        where: { id: recurringPaymentId },
        data: {
          ...data,
          amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
          nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
          lastPaidDate: data.lastPaidDate ? new Date(data.lastPaidDate) : undefined
        },
        include: {
          client: true
        }
      })

      return recurringPayment
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Process recurring payments (create next payment)
   */
  static async processRecurringPayment(recurringPaymentId: string, userId: string) {
    try {
      const recurringPayment = await prisma.recurringPayment.findFirst({
        where: { 
          id: recurringPaymentId,
          client: {
            userId
          },
          isActive: true 
        }
      })

      if (!recurringPayment) {
        throw new Error('תשלום חוזר לא נמצא או לא פעיל')
      }

      // Calculate next due date based on frequency
      let nextDueDate: Date
      const currentDueDate = new Date(recurringPayment.nextDueDate)

      switch (recurringPayment.frequency) {
        case 'DAILY':
          nextDueDate = addDays(currentDueDate, 1)
          break
        case 'WEEKLY':
          nextDueDate = addWeeks(currentDueDate, 1)
          break
        case 'MONTHLY':
          nextDueDate = addMonths(currentDueDate, 1)
          break
        case 'QUARTERLY':
          nextDueDate = addMonths(currentDueDate, 3)
          break
        case 'YEARLY':
          nextDueDate = addYears(currentDueDate, 1)
          break
        default:
          throw new Error('תדירות לא חוקית')
      }

      // Update recurring payment
      await prisma.recurringPayment.update({
        where: { id: recurringPaymentId },
        data: {
          lastPaidDate: currentDueDate,
          nextDueDate
        }
      })

      // Create next payment
      const newPayment = await this.create(userId, {
        amount: Number(recurringPayment.amount),
        type: 'RECURRING',
        dueDate: nextDueDate,
        clientId: recurringPayment.clientId,
        recurringPaymentId: recurringPayment.id,
        notes: `תשלום חוזר: ${recurringPayment.name}`
      })

      return newPayment
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get payment statistics
   */
  static async getStatistics(userId: string) {
    try {
      const currentMonth = new Date()
      currentMonth.setDate(1)
      currentMonth.setHours(0, 0, 0, 0)

      const nextMonth = new Date(currentMonth)
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      const [
        totalPending,
        totalPaid,
        totalOverdue,
        monthlyRevenue,
        recurringRevenue,
        upcomingPayments,
        recentPayments
      ] = await Promise.all([
        // Total pending
        prisma.payment.aggregate({
          where: { userId, status: 'PENDING' },
          _sum: { amount: true }
        }),

        // Total paid
        prisma.payment.aggregate({
          where: { userId, status: 'PAID' },
          _sum: { amount: true }
        }),

        // Total overdue
        prisma.payment.aggregate({
          where: {
            userId,
            status: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { lt: new Date() }
          },
          _sum: { amount: true }
        }),

        // Monthly revenue
        prisma.payment.aggregate({
          where: {
            userId,
            status: 'PAID',
            paidAt: {
              gte: currentMonth,
              lt: nextMonth
            }
          },
          _sum: { amount: true }
        }),

        // Recurring revenue (monthly equivalent)
        prisma.recurringPayment.aggregate({
          where: { 
            client: {
              userId
            },
            isActive: true 
          },
          _sum: { amount: true }
        }),

        // Upcoming payments (next 7 days)
        prisma.payment.findMany({
          where: {
            userId,
            status: 'PENDING',
            dueDate: {
              gte: new Date(),
              lte: addDays(new Date(), 7)
            }
          },
          include: {
            client: {
              select: { name: true }
            }
          },
          orderBy: { dueDate: 'asc' },
          take: 5
        }),

        // Recent payments
        prisma.payment.findMany({
          where: {
            userId,
            status: 'PAID'
          },
          include: {
            client: {
              select: { name: true }
            }
          },
          orderBy: { paidAt: 'desc' },
          take: 5
        })
      ])

      return {
        totalPending: totalPending._sum.amount || new Prisma.Decimal(0),
        totalPaid: totalPaid._sum.amount || new Prisma.Decimal(0),
        totalOverdue: totalOverdue._sum.amount || new Prisma.Decimal(0),
        monthlyRevenue: monthlyRevenue._sum.amount || new Prisma.Decimal(0),
        recurringRevenue: recurringRevenue._sum.amount || new Prisma.Decimal(0),
        upcomingPayments,
        recentPayments
      }
    } catch (error) {
      this.handleError(error)
    }
  }
}