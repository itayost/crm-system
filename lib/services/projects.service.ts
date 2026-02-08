import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { ProjectType, ProjectStage, Priority, Prisma } from '@prisma/client'

interface CreateProjectInput {
  name: string
  description?: string
  clientId: string
  type: ProjectType
  priority?: Priority
  budget?: number
  estimatedHours?: number
  startDate?: Date | string
  deadline?: Date | string
}

interface UpdateProjectInput {
  name?: string
  description?: string
  clientId?: string
  type?: ProjectType
  stage?: ProjectStage
  priority?: Priority
  budget?: number
  estimatedHours?: number
  actualHours?: number
  startDate?: Date | string
  deadline?: Date | string
  completedAt?: Date | string
}

interface ProjectFilters {
  stage?: ProjectStage
  priority?: Priority
  type?: ProjectType
  clientId?: string
  search?: string
}

export class ProjectsService extends BaseService {
  /**
   * Get all projects for a user with filters
   */
  static async getAll(userId: string, filters?: ProjectFilters) {
    try {
      const where: Prisma.ProjectWhereInput = {
        userId,
        ...(filters?.stage && { stage: filters.stage }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.type && { type: filters.type }),
        ...(filters?.clientId && { clientId: filters.clientId }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } }
          ]
        })
      }

      const projects = await prisma.project.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
              type: true
            }
          },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              dueDate: true
            }
          },
          _count: {
            select: {
              tasks: true,
              payments: true,
              timeEntries: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { deadline: 'asc' },
          { createdAt: 'desc' }
        ]
      })

      // Calculate additional metrics
      const projectsWithMetrics = projects.map(project => {
        const totalTasks = project._count.tasks
        const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length
        const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

        const totalPayments = project.payments.reduce((sum, p) =>
          sum + (typeof p.amount === 'number' ? p.amount : Number(p.amount)), 0
        )
        const paidPayments = project.payments
          .filter(p => p.status === 'PAID')
          .reduce((sum, p) => sum + (typeof p.amount === 'number' ? p.amount : Number(p.amount)), 0)

        // Calculate progress based on stage
        const progress = this.calculateProgress(project.stage)

        return {
          ...project,
          budget: project.budget ? Number(project.budget) : null, // Convert Decimal to number
          progress, // Add calculated progress
          taskProgress,
          totalPayments,
          paidPayments,
          paymentProgress: totalPayments > 0 ? (paidPayments / totalPayments) * 100 : 0
        }
      })

      return projectsWithMetrics
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get a single project by ID
   */
  static async getById(projectId: string, userId: string) {
    try {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId
        },
        include: {
          client: true,
          tasks: {
            where: { parentTaskId: null },
            include: {
              subTasks: {
                orderBy: { createdAt: 'asc' }
              }
            },
            orderBy: [
              { status: 'asc' },
              { priority: 'desc' },
              { createdAt: 'desc' }
            ]
          },
          payments: {
            orderBy: { dueDate: 'asc' }
          },
          timeEntries: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { startTime: 'desc' }
          },
          milestones: {
            orderBy: { dueDate: 'asc' }
          },
          _count: {
            select: {
              tasks: true,
              payments: true,
              timeEntries: true,
              milestones: true
            }
          }
        }
      })

      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }

      return project
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a new project
   */
  static async create(userId: string, data: CreateProjectInput) {
    try {
      // Verify client exists and belongs to user
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          userId
        }
      })

      if (!client) {
        throw new Error('לקוח לא נמצא')
      }

      const project = await prisma.project.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          clientId: data.clientId,
          userId,
          stage: 'PLANNING',
          status: 'IN_PROGRESS',
          priority: data.priority || 'MEDIUM',
          actualHours: 0,
          budget: data.budget ? new Prisma.Decimal(data.budget) : undefined,
          estimatedHours: data.estimatedHours,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          deadline: data.deadline ? new Date(data.deadline) : undefined
        },
        include: {
          client: true,
          _count: {
            select: {
              tasks: true,
              payments: true
            }
          }
        }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'PROJECT_CREATED',
        entityType: 'Project',
        entityId: project.id,
        metadata: { 
          projectName: project.name,
          clientName: client.name,
          projectType: project.type
        }
      })

      // Create notification
      await this.createNotification({
        userId,
        type: 'PROJECT_UPDATE',
        title: 'פרויקט חדש נוצר',
        message: `פרויקט "${project.name}" נוצר עבור ${client.name}`,
        entityType: 'Project',
        entityId: project.id
      })

      return project
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a project
   */
  static async update(projectId: string, userId: string, data: UpdateProjectInput) {
    try {
      // First check if project exists and belongs to user
      const existingProject = await prisma.project.findFirst({
        where: { id: projectId, userId }
      })

      if (!existingProject) {
        throw new Error('פרויקט לא נמצא')
      }

      // If updating client, verify new client exists and belongs to user
      if (data.clientId) {
        const client = await prisma.client.findFirst({
          where: { id: data.clientId, userId }
        })
        if (!client) {
          throw new Error('לקוח לא נמצא')
        }
      }

      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          ...data,
          budget: data.budget !== undefined ? new Prisma.Decimal(data.budget) : undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined
        },
        include: {
          client: true,
          _count: {
            select: {
              tasks: true,
              payments: true
            }
          }
        }
      })

      // Log stage changes
      if (data.stage && data.stage !== existingProject.stage) {
        await this.logActivity({
          userId,
          action: 'PROJECT_STAGE_CHANGED',
          entityType: 'Project',
          entityId: project.id,
          metadata: { 
            from: existingProject.stage, 
            to: data.stage,
            projectName: project.name 
          }
        })

        // Notify on completion
        if (data.stage === 'DELIVERY') {
          await this.createNotification({
            userId,
            type: 'PROJECT_UPDATE',
            title: 'פרויקט הושלם',
            message: `הפרויקט "${project.name}" מוכן למסירה`,
            entityType: 'Project',
            entityId: project.id
          })
        }
      }

      // Log priority changes
      if (data.priority && data.priority !== existingProject.priority) {
        await this.logActivity({
          userId,
          action: 'PROJECT_PRIORITY_CHANGED',
          entityType: 'Project',
          entityId: project.id,
          metadata: { 
            from: existingProject.priority, 
            to: data.priority,
            projectName: project.name 
          }
        })
      }

      return project
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete a project
   */
  static async delete(projectId: string, userId: string) {
    try {
      // Check if project exists and belongs to user
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        include: {
          _count: {
            select: {
              tasks: true,
              payments: true,
              timeEntries: true
            }
          }
        }
      })

      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }

      // Check if project has pending payments
      const pendingPayments = await prisma.payment.count({
        where: {
          projectId,
          status: { in: ['PENDING', 'OVERDUE'] }
        }
      })

      if (pendingPayments > 0) {
        throw new Error('לא ניתן למחוק פרויקט עם תשלומים ממתינים')
      }

      // Delete the project (cascading deletes will handle related records)
      await prisma.project.delete({
        where: { id: projectId }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'PROJECT_DELETED',
        entityType: 'Project',
        entityId: projectId,
        metadata: { projectName: project.name }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Complete a project (mark as delivered and paid)
   */
  static async complete(projectId: string, userId: string) {
    try {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        include: { client: true }
      })

      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }

      if (project.status === 'COMPLETED') {
        throw new Error('פרויקט זה כבר הושלם')
      }

      if (project.stage !== 'DELIVERY') {
        throw new Error('ניתן לסיים רק פרויקטים בשלב מסירה')
      }

      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          stage: 'DELIVERY'
        },
        include: {
          client: true,
          _count: {
            select: {
              tasks: true,
              payments: true
            }
          }
        }
      })

      await this.logActivity({
        userId,
        action: 'PROJECT_COMPLETED',
        entityType: 'Project',
        entityId: projectId,
        metadata: {
          projectName: project.name,
          clientName: project.client?.name
        }
      })

      await this.createNotification({
        userId,
        type: 'PROJECT_UPDATE',
        title: 'פרויקט הושלם',
        message: `הפרויקט "${project.name}" סומן כהושלם`,
        entityType: 'Project',
        entityId: projectId
      })

      return updated
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Calculate project progress based on stage
   */
  static calculateProgress(stage: ProjectStage): number {
    const stageProgress: Record<ProjectStage, number> = {
      PLANNING: 10,
      DEVELOPMENT: 40,
      TESTING: 70,
      REVIEW: 85,
      DELIVERY: 100,
      MAINTENANCE: 100
    }
    return stageProgress[stage] || 0
  }

  /**
   * Get project statistics
   */
  static async getStatistics(userId: string) {
    try {
      const [
        totalProjects,
        activeProjects,
        completedProjects,
        overdueProjects,
        projectsByStage,
        projectsByType,
        totalBudget,
        totalHours
      ] = await Promise.all([
        // Total projects
        prisma.project.count({ where: { userId } }),
        
        // Active projects
        prisma.project.count({ 
          where: { 
            userId, 
            stage: { in: ['PLANNING', 'DEVELOPMENT', 'TESTING', 'REVIEW'] }
          }
        }),
        
        // Completed projects
        prisma.project.count({
          where: { userId, status: 'COMPLETED' }
        }),
        
        // Overdue projects
        prisma.project.count({
          where: {
            userId,
            deadline: { lt: new Date() },
            stage: { not: 'DELIVERY' },
            status: { not: 'COMPLETED' }
          }
        }),
        
        // Projects by stage
        prisma.project.groupBy({
          by: ['stage'],
          where: { userId },
          _count: { stage: true }
        }),
        
        // Projects by type
        prisma.project.groupBy({
          by: ['type'],
          where: { userId },
          _count: { type: true }
        }),
        
        // Total budget
        prisma.project.aggregate({
          where: { userId },
          _sum: { budget: true }
        }),
        
        // Total hours
        prisma.project.aggregate({
          where: { userId },
          _sum: { 
            estimatedHours: true,
            actualHours: true
          }
        })
      ])

      return {
        totalProjects,
        activeProjects,
        completedProjects,
        overdueProjects,
        projectsByStage,
        projectsByType,
        totalBudget: totalBudget._sum.budget || new Prisma.Decimal(0),
        totalEstimatedHours: totalHours._sum.estimatedHours || 0,
        totalActualHours: totalHours._sum.actualHours || 0
      }
    } catch (error) {
      this.handleError(error)
    }
  }
}