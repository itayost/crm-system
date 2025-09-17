import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { TaskStatus, Priority, Prisma } from '@prisma/client'

interface CreateTaskInput {
  title: string
  description?: string
  priority?: Priority
  dueDate?: Date | string
  projectId?: string
  clientId?: string
  assignedToId?: string
  tags?: string[]
}

interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  dueDate?: Date | string
  completedAt?: Date | string
  projectId?: string
  clientId?: string
  assignedToId?: string
  tags?: string[]
}

interface TaskFilters {
  status?: TaskStatus
  priority?: Priority
  projectId?: string
  clientId?: string
  assignedToId?: string
  overdue?: boolean
  dueToday?: boolean
  dueThisWeek?: boolean
}

export class TasksService extends BaseService {
  /**
   * Get all tasks for a user with filters
   */
  static async getAll(userId: string, filters?: TaskFilters) {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const where: Prisma.TaskWhereInput = {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.projectId && { projectId: filters.projectId }),
        ...(filters?.clientId && { clientId: filters.clientId }),
        ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
        ...(filters?.overdue && {
          status: { not: 'COMPLETED' },
          dueDate: { lt: now }
        }),
        ...(filters?.dueToday && {
          dueDate: {
            gte: today,
            lt: tomorrow
          }
        }),
        ...(filters?.dueThisWeek && {
          dueDate: {
            gte: today,
            lt: weekEnd
          }
        })
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          client: {
            select: {
              id: true,
              name: true,
              company: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          timeEntries: {
            select: {
              id: true,
              duration: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { dueDate: 'asc' }
        ]
      })

      // Calculate total time for each task
      const tasksWithTime = tasks.map(task => ({
        ...task,
        totalMinutes: task.timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
      }))

      return tasksWithTime
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get a single task by ID
   */
  static async getById(taskId: string, userId: string) {
    try {
      const task = await prisma.task.findFirst({
        where: { 
          id: taskId,
          userId
        },
        include: {
          project: true,
          client: true,
          assignedTo: true,
          timeEntries: {
            orderBy: { startTime: 'desc' }
          }
        }
      })

      if (!task) {
        throw new Error('משימה לא נמצאה')
      }

      return task
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create a new task
   */
  static async create(userId: string, data: CreateTaskInput) {
    try {
      // Verify project if provided
      if (data.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: data.projectId, userId }
        })
        if (!project) {
          throw new Error('פרויקט לא נמצא')
        }
      }

      // Verify client if provided
      if (data.clientId) {
        const client = await prisma.client.findFirst({
          where: { id: data.clientId, userId }
        })
        if (!client) {
          throw new Error('לקוח לא נמצא')
        }
      }

      const task = await prisma.task.create({
        data: {
          ...data,
          userId,
          status: 'TODO',
          priority: data.priority || 'MEDIUM',
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined
        },
        include: {
          project: true,
          client: true
        }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'TASK_CREATED',
        entityType: 'Task',
        entityId: task.id,
        metadata: {
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate
        }
      })

      // Create notification for urgent tasks
      if (task.priority === 'URGENT') {
        await this.createNotification({
          userId,
          type: 'TASK_ASSIGNED',
          title: 'משימה דחופה חדשה',
          message: task.title,
          entityType: 'Task',
          entityId: task.id
        })
      }

      return task
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update a task
   */
  static async update(taskId: string, userId: string, data: UpdateTaskInput) {
    try {
      // Check if task exists and belongs to user
      const existingTask = await prisma.task.findFirst({
        where: { id: taskId, userId }
      })

      if (!existingTask) {
        throw new Error('משימה לא נמצאה')
      }

      // If marking as completed, set completedAt
      if (data.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        data.completedAt = new Date()
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined
        },
        include: {
          project: true,
          client: true
        }
      })

      // Log status changes
      if (data.status && data.status !== existingTask.status) {
        await this.logActivity({
          userId,
          action: 'TASK_STATUS_CHANGED',
          entityType: 'Task',
          entityId: task.id,
          metadata: {
            title: task.title,
            from: existingTask.status,
            to: data.status
          }
        })
      }

      return task
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete a task
   */
  static async delete(taskId: string, userId: string) {
    try {
      // Check if task exists and belongs to user
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId }
      })

      if (!task) {
        throw new Error('משימה לא נמצאה')
      }

      await prisma.task.delete({
        where: { id: taskId }
      })

      // Log activity
      await this.logActivity({
        userId,
        action: 'TASK_DELETED',
        entityType: 'Task',
        entityId: taskId,
        metadata: {
          title: task.title
        }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get task statistics
   */
  static async getStatistics(userId: string) {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const [
        totalTasks,
        todoTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        dueTodayTasks,
        urgentTasks
      ] = await Promise.all([
        prisma.task.count({ where: { userId } }),
        prisma.task.count({ where: { userId, status: 'TODO' } }),
        prisma.task.count({ where: { userId, status: 'IN_PROGRESS' } }),
        prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.task.count({
          where: {
            userId,
            status: { not: 'COMPLETED' },
            dueDate: { lt: now }
          }
        }),
        prisma.task.count({
          where: {
            userId,
            status: { not: 'COMPLETED' },
            dueDate: { gte: today, lt: tomorrow }
          }
        }),
        prisma.task.count({
          where: {
            userId,
            status: { not: 'COMPLETED' },
            priority: 'URGENT'
          }
        })
      ])

      return {
        totalTasks,
        todoTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        dueTodayTasks,
        urgentTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    } catch (error) {
      this.handleError(error)
    }
  }
}