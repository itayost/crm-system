import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { ClientType, ClientStatus, Prisma } from '@prisma/client'

interface CreateClientInput {
  name: string
  email: string
  phone: string
  company?: string
  address?: string
  taxId?: string
  type?: ClientType
  notes?: string
}

interface UpdateClientInput {
  name?: string
  email?: string
  phone?: string
  company?: string
  address?: string
  taxId?: string
  type?: ClientType
  status?: ClientStatus
  notes?: string
}

interface ClientFilters {
  status?: ClientStatus
  type?: ClientType
  search?: string
}

export class ClientsService extends BaseService {
  /**
   * Get all clients for a user with filters
   */
  static async getAll(userId: string, filters?: ClientFilters) {
    try {
      const where: Prisma.ClientWhereInput = {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
            { company: { contains: filters.search, mode: 'insensitive' } }
          ]
        })
      }

      const clients = await prisma.client.findMany({
        where,
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              type: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              dueDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          recurringPayments: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              amount: true,
              frequency: true,
              nextDueDate: true
            }
          },
          _count: {
            select: {
              projects: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return clients
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get a single client by ID
   */
  static async getById(clientId: string, userId: string) {
    try {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          userId
        },
        include: {
          projects: {
            orderBy: { createdAt: 'desc' }
          },
          payments: {
            orderBy: { createdAt: 'desc' }
          },
          recurringPayments: true,
          leads: {
            select: {
              id: true,
              name: true,
              convertedAt: true
            }
          },
          _count: {
            select: {
              projects: true,
              payments: true
            }
          }
        }
      })

      if (!client) {
        throw new Error('לקוח לא נמצא')
      }

      return client
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a new client
   */
  static async create(userId: string, data: CreateClientInput) {
    try {
      const client = await prisma.client.create({
        data: {
          ...data,
          userId,
          type: data.type || 'REGULAR',
          status: 'ACTIVE',
          totalRevenue: new Prisma.Decimal(0)
        },
        include: {
          _count: {
            select: {
              projects: true,
              payments: true
            }
          }
        }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'CLIENT_CREATED',
        entityType: 'Client',
        entityId: client.id,
        metadata: { clientName: client.name, clientType: client.type }
      })

      // Create notification
      await this.createNotification({
        userId,
        type: 'SYSTEM',
        title: 'לקוח חדש נוסף',
        message: `לקוח חדש "${client.name}" נוסף למערכת`,
        entityType: 'Client',
        entityId: client.id
      })

      return client
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a client
   */
  static async update(clientId: string, userId: string, data: UpdateClientInput) {
    try {
      // First check if client exists and belongs to user
      const existingClient = await prisma.client.findFirst({
        where: { id: clientId, userId }
      })

      if (!existingClient) {
        throw new Error('לקוח לא נמצא')
      }

      const client = await prisma.client.update({
        where: { id: clientId },
        data,
        include: {
          _count: {
            select: {
              projects: true,
              payments: true
            }
          }
        }
      })

      // Log status change
      if (data.status && data.status !== existingClient.status) {
        await this.logActivity({
          userId,
          action: 'CLIENT_STATUS_CHANGED',
          entityType: 'Client',
          entityId: client.id,
          metadata: { 
            from: existingClient.status, 
            to: data.status,
            clientName: client.name 
          }
        })
      }

      // Log type change
      if (data.type && data.type !== existingClient.type) {
        await this.logActivity({
          userId,
          action: 'CLIENT_TYPE_CHANGED',
          entityType: 'Client',
          entityId: client.id,
          metadata: { 
            from: existingClient.type, 
            to: data.type,
            clientName: client.name 
          }
        })
      }

      return client
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete a client
   */
  static async delete(clientId: string, userId: string) {
    try {
      // Check if client exists and belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        include: {
          _count: {
            select: {
              projects: true,
              payments: true
            }
          }
        }
      })

      if (!client) {
        throw new Error('לקוח לא נמצא')
      }

      // Check if client has active projects or pending payments
      if (client._count.projects > 0) {
        throw new Error('לא ניתן למחוק לקוח עם פרויקטים פעילים')
      }

      const pendingPayments = await prisma.payment.count({
        where: {
          clientId,
          status: { in: ['PENDING', 'OVERDUE'] }
        }
      })

      if (pendingPayments > 0) {
        throw new Error('לא ניתן למחוק לקוח עם תשלומים ממתינים')
      }

      await prisma.client.delete({
        where: { id: clientId }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'CLIENT_DELETED',
        entityType: 'Client',
        entityId: clientId,
        metadata: { clientName: client.name }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get client statistics
   */
  static async getStatistics(userId: string) {
    try {
      const [
        totalClients,
        activeClients,
        vipClients,
        totalRevenue,
        clientsWithProjects,
        recentClients
      ] = await Promise.all([
        // Total clients
        prisma.client.count({ where: { userId } }),
        
        // Active clients
        prisma.client.count({ 
          where: { userId, status: 'ACTIVE' } 
        }),
        
        // VIP clients
        prisma.client.count({ 
          where: { userId, type: 'VIP' } 
        }),
        
        // Total revenue
        prisma.client.aggregate({
          where: { userId },
          _sum: { totalRevenue: true }
        }),
        
        // Clients with active projects
        prisma.client.count({
          where: {
            userId,
            projects: {
              some: {
                status: { in: ['IN_PROGRESS', 'DRAFT'] }
              }
            }
          }
        }),
        
        // Recent clients (last 30 days)
        prisma.client.findMany({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            _count: {
              select: {
                projects: true,
                payments: true
              }
            }
          }
        })
      ])

      return {
        totalClients,
        activeClients,
        vipClients,
        totalRevenue: totalRevenue._sum.totalRevenue || new Prisma.Decimal(0),
        clientsWithProjects,
        recentClients,
        inactiveClients: totalClients - activeClients
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update client revenue (called after payment)
   */
  static async updateRevenue(clientId: string, amount: Prisma.Decimal) {
    try {
      const client = await prisma.client.update({
        where: { id: clientId },
        data: {
          totalRevenue: {
            increment: amount
          }
        }
      })

      return client
    } catch (error) {
      this.handleError(error)
    }
  }
}