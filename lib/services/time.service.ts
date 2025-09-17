import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { Prisma } from '@prisma/client'
interface CreateTimeEntryInput {
  taskId?: string
  projectId: string
  description?: string
  startTime: Date | string
  endTime?: Date | string
  duration?: number
}

interface UpdateTimeEntryInput {
  description?: string
  startTime?: Date | string
  endTime?: Date | string
  duration?: number
}

interface TimeFilters {
  projectId?: string
  taskId?: string
  startDate?: Date | string
  endDate?: Date | string
  period?: 'today' | 'week' | 'month'
}

export class TimeService extends BaseService {
  /**
   * Start a timer for a task
   */
  static async startTimer(userId: string, taskId: string, projectId: string) {
    try {
      // Check if there's already an active timer
      const activeTimer = await prisma.timeEntry.findFirst({
        where: {
          userId,
          endTime: null
        }
      })

      if (activeTimer) {
        throw new Error('יש כבר טיימר פעיל. עצור אותו קודם')
      }

      // Verify task belongs to user
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId }
      })

      if (!task) {
        throw new Error('משימה לא נמצאה')
      }

      // Create new time entry
      const timeEntry = await prisma.timeEntry.create({
        data: {
          userId,
          taskId,
          projectId: projectId || task.projectId,
          startTime: new Date()
        },
        include: {
          task: true,
          project: true
        }
      })

      // Update task status to IN_PROGRESS if it was TODO
      if (task.status === 'TODO') {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'IN_PROGRESS' }
        })
      }

      return timeEntry
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Stop the active timer
   */
  static async stopTimer(userId: string) {
    try {
      // Find active timer
      const activeTimer = await prisma.timeEntry.findFirst({
        where: {
          userId,
          endTime: null
        }
      })

      if (!activeTimer) {
        throw new Error('אין טיימר פעיל')
      }

      const endTime = new Date()
      const duration = Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 60000) // in minutes

      // Update time entry
      const timeEntry = await prisma.timeEntry.update({
        where: { id: activeTimer.id },
        data: {
          endTime,
          duration
        },
        include: {
          task: true,
          project: true
        }
      })

      // Update project actual hours
      if (timeEntry.projectId) {
        await prisma.project.update({
          where: { id: timeEntry.projectId },
          data: {
            actualHours: {
              increment: duration / 60 // convert to hours
            }
          }
        })
      }

      return timeEntry
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get active timer
   */
  static async getActiveTimer(userId: string) {
    try {
      const activeTimer = await prisma.timeEntry.findFirst({
        where: {
          userId,
          endTime: null
        },
        include: {
          task: true,
          project: true
        }
      })

      return activeTimer
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get all time entries with filters
   */
  static async getAll(userId: string, filters?: TimeFilters) {
    try {
      const where: Prisma.TimeEntryWhereInput = { userId }

      // Apply filters
      if (filters?.projectId) {
        where.projectId = filters.projectId
      }

      if (filters?.taskId) {
        where.taskId = filters.taskId
      }

      // Date filtering
      if (filters?.period) {
        const now = new Date()
        switch (filters.period) {
          case 'today':
            where.startTime = {
              gte: startOfDay(now),
              lte: endOfDay(now)
            }
            break
          case 'week':
            where.startTime = {
              gte: startOfWeek(now, { weekStartsOn: 0 }), // Sunday
              lte: endOfWeek(now, { weekStartsOn: 0 })
            }
            break
          case 'month':
            where.startTime = {
              gte: startOfMonth(now),
              lte: endOfMonth(now)
            }
            break
        }
      } else if (filters?.startDate && filters?.endDate) {
        where.startTime = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate)
        }
      }

      const timeEntries = await prisma.timeEntry.findMany({
        where,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true
            }
          },
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { startTime: 'desc' }
      })

      return timeEntries
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Create manual time entry
   */
  static async create(userId: string, data: CreateTimeEntryInput) {
    try {
      // Calculate duration if both start and end are provided
      let duration = data.duration
      if (data.startTime && data.endTime && !duration) {
        const start = new Date(data.startTime)
        const end = new Date(data.endTime)
        duration = Math.round((end.getTime() - start.getTime()) / 60000) // in minutes
      }

      const timeEntry = await prisma.timeEntry.create({
        data: {
          ...data,
          userId,
          startTime: new Date(data.startTime),
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          duration
        },
        include: {
          task: true,
          project: true
        }
      })

      // Update project actual hours if completed
      if (timeEntry.projectId && duration) {
        await prisma.project.update({
          where: { id: timeEntry.projectId },
          data: {
            actualHours: {
              increment: duration / 60 // convert to hours
            }
          }
        })
      }

      return timeEntry
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Update time entry
   */
  static async update(timeEntryId: string, userId: string, data: UpdateTimeEntryInput) {
    try {
      // Check if time entry exists and belongs to user
      const existing = await prisma.timeEntry.findFirst({
        where: { id: timeEntryId, userId }
      })

      if (!existing) {
        throw new Error('רישום זמן לא נמצא')
      }

      // Recalculate duration if needed
      let duration = data.duration
      if (data.startTime || data.endTime) {
        const start = data.startTime ? new Date(data.startTime) : existing.startTime
        const end = data.endTime ? new Date(data.endTime) : existing.endTime
        if (end) {
          duration = Math.round((end.getTime() - start.getTime()) / 60000)
        }
      }

      const timeEntry = await prisma.timeEntry.update({
        where: { id: timeEntryId },
        data: {
          ...data,
          startTime: data.startTime ? new Date(data.startTime) : undefined,
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          duration
        },
        include: {
          task: true,
          project: true
        }
      })

      return timeEntry
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Delete time entry
   */
  static async delete(timeEntryId: string, userId: string) {
    try {
      // Check if time entry exists and belongs to user
      const timeEntry = await prisma.timeEntry.findFirst({
        where: { id: timeEntryId, userId }
      })

      if (!timeEntry) {
        throw new Error('רישום זמן לא נמצא')
      }

      // Update project hours if needed
      if (timeEntry.projectId && timeEntry.duration) {
        await prisma.project.update({
          where: { id: timeEntry.projectId },
          data: {
            actualHours: {
              decrement: timeEntry.duration / 60
            }
          }
        })
      }

      await prisma.timeEntry.delete({
        where: { id: timeEntryId }
      })

      return { success: true }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get time statistics
   */
  static async getStatistics(userId: string, period: 'day' | 'week' | 'month' = 'week') {
    try {
      const now = new Date()
      let startDate: Date
      let endDate: Date

      switch (period) {
        case 'day':
          startDate = startOfDay(now)
          endDate = endOfDay(now)
          break
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 0 })
          endDate = endOfWeek(now, { weekStartsOn: 0 })
          break
        case 'month':
          startDate = startOfMonth(now)
          endDate = endOfMonth(now)
          break
      }

      // Get time entries for period
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          userId,
          startTime: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              client: {
                select: {
                  name: true
                }
              }
            }
          },
          task: {
            select: {
              id: true,
              title: true
            }
          }
        }
      })

      // Calculate statistics
      const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
      const totalHours = totalMinutes / 60

      // Group by project
      const byProject = timeEntries.reduce((acc: any, entry) => {
        if (!entry.projectId) return acc
        
        if (!acc[entry.projectId]) {
          acc[entry.projectId] = {
            project: entry.project,
            minutes: 0,
            tasks: new Set()
          }
        }
        
        acc[entry.projectId].minutes += entry.duration || 0
        if (entry.taskId) {
          acc[entry.projectId].tasks.add(entry.taskId)
        }
        
        return acc
      }, {})

      // Convert to array and calculate hours
      const projectStats = Object.values(byProject).map((stat: any) => ({
        project: stat.project,
        hours: stat.minutes / 60,
        taskCount: stat.tasks.size
      }))

      // Sort by hours
      projectStats.sort((a: any, b: any) => b.hours - a.hours)

      return {
        totalHours,
        totalMinutes,
        entriesCount: timeEntries.length,
        projectStats,
        averagePerDay: totalHours / (period === 'day' ? 1 : period === 'week' ? 7 : 30)
      }
    } catch (error) {
      this.handleError(error)
    }
  }
}