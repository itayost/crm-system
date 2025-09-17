import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { Lead, LeadStatus, LeadSource, Prisma } from '@prisma/client'
import { WhatsAppService } from './whatsapp.service'

interface CreateLeadInput {
  name: string
  email?: string
  phone: string
  company?: string
  source: LeadSource
  projectType?: string
  estimatedBudget?: number
  notes?: string
}

interface UpdateLeadInput {
  name?: string
  email?: string
  phone?: string
  company?: string
  status?: LeadStatus
  projectType?: string
  estimatedBudget?: number
  notes?: string
}

interface LeadFilters {
  status?: LeadStatus
  source?: LeadSource
  search?: string
}

export class LeadsService extends BaseService {
  /**
   * Get all leads for a user with optional filters
   */
  static async getAll(userId: string, filters?: LeadFilters) {
    try {
      const where: Prisma.LeadWhereInput = {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.source && { source: filters.source }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
            { company: { contains: filters.search, mode: 'insensitive' } }
          ]
        })
      }

      const leads = await prisma.lead.findMany({
        where,
        include: {
          client: true,
          activities: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return leads
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get a single lead by ID
   */
  static async getById(leadId: string, userId: string) {
    try {
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          userId
        },
        include: {
          client: true,
          activities: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      if (!lead) {
        throw new Error('ליד לא נמצא')
      }

      return lead
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a new lead
   */
  static async create(userId: string, data: CreateLeadInput) {
    try {
      const lead = await prisma.lead.create({
        data: {
          ...data,
          userId,
          estimatedBudget: data.estimatedBudget ? new Prisma.Decimal(data.estimatedBudget) : undefined
        },
        include: {
          client: true
        }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'LEAD_CREATED',
        entityType: 'Lead',
        entityId: lead.id,
        metadata: { leadName: lead.name, source: lead.source }
      })

      // Create notification
      await this.createNotification({
        userId,
        type: 'LEAD_NEW',
        title: 'ליד חדש נוסף',
        message: `ליד חדש "${lead.name}" נוסף למערכת`,
        entityType: 'Lead',
        entityId: lead.id
      })

      // Send WhatsApp notification for new lead
      try {
        await WhatsAppService.sendNewLeadNotification({
          name: lead.name,
          phone: lead.phone,
          source: lead.source,
          estimatedBudget: lead.estimatedBudget ? Number(lead.estimatedBudget) : undefined
        })
        console.log('WhatsApp notification sent for new lead:', lead.name)
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError)
        // Don't fail the lead creation if WhatsApp fails
      }

      return lead
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a lead
   */
  static async update(leadId: string, userId: string, data: UpdateLeadInput) {
    try {
      // First check if lead exists and belongs to user
      const existingLead = await prisma.lead.findFirst({
        where: { id: leadId, userId }
      })

      if (!existingLead) {
        throw new Error('ליד לא נמצא')
      }

      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...data,
          estimatedBudget: data.estimatedBudget !== undefined 
            ? new Prisma.Decimal(data.estimatedBudget) 
            : undefined
        },
        include: {
          client: true
        }
      })

      // Log status change
      if (data.status && data.status !== existingLead.status) {
        await this.logActivity({
          userId,
          action: 'LEAD_STATUS_CHANGED',
          entityType: 'Lead',
          entityId: lead.id,
          metadata: { 
            from: existingLead.status, 
            to: data.status,
            leadName: lead.name 
          }
        })
      }

      return lead
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Convert lead to client
   */
  static async convertToClient(leadId: string, userId: string) {
    try {
      // Start a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get the lead
        const lead = await tx.lead.findFirst({
          where: { id: leadId, userId }
        })

        if (!lead) {
          throw new Error('ליד לא נמצא')
        }

        if (lead.status === 'CONVERTED') {
          throw new Error('ליד זה כבר הומר ללקוח')
        }

        // Create the client
        const client = await tx.client.create({
          data: {
            name: lead.name,
            email: lead.email || '',
            phone: lead.phone,
            company: lead.company,
            userId,
            notes: lead.notes
          }
        })

        // Update the lead
        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: {
            status: 'CONVERTED',
            convertedToClientId: client.id,
            convertedAt: new Date()
          }
        })

        // Log activity
        await tx.activity.create({
          data: {
            userId,
            action: 'LEAD_CONVERTED',
            entityType: 'Lead',
            entityId: leadId,
            leadId,
            metadata: {
              leadName: lead.name,
              clientId: client.id,
              clientName: client.name
            }
          }
        })

        return { lead: updatedLead, client }
      })

      // Create notification
      await this.createNotification({
        userId,
        type: 'LEAD_NEW',
        title: 'ליד הומר ללקוח',
        message: `הליד "${result.lead.name}" הומר ללקוח בהצלחה`,
        entityType: 'Client',
        entityId: result.client.id
      })

      return result
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete a lead
   */
  static async delete(leadId: string, userId: string) {
    try {
      // Check if lead exists and belongs to user
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, userId }
      })

      if (!lead) {
        throw new Error('ליד לא נמצא')
      }

      if (lead.status === 'CONVERTED') {
        throw new Error('לא ניתן למחוק ליד שהומר ללקוח')
      }

      await prisma.lead.delete({
        where: { id: leadId }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'LEAD_DELETED',
        entityType: 'Lead',
        entityId: leadId,
        metadata: { leadName: lead.name }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get lead statistics for dashboard
   */
  static async getStatistics(userId: string) {
    try {
      const [total, byStatus, bySource, recentLeads, conversionRate] = await Promise.all([
        // Total leads
        prisma.lead.count({ where: { userId } }),
        
        // Leads by status
        prisma.lead.groupBy({
          by: ['status'],
          where: { userId },
          _count: { status: true }
        }),
        
        // Leads by source
        prisma.lead.groupBy({
          by: ['source'],
          where: { userId },
          _count: { source: true }
        }),
        
        // Recent leads (last 7 days)
        prisma.lead.findMany({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { client: true }
        }),
        
        // Conversion rate
        prisma.lead.count({
          where: {
            userId,
            status: 'CONVERTED'
          }
        })
      ])

      return {
        total,
        byStatus,
        bySource,
        recentLeads,
        conversionRate: total > 0 ? (conversionRate / total) * 100 : 0
      }
    } catch (error) {
      this.handleError(error)
    }
  }
}