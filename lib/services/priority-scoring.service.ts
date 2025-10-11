import { BaseService } from './base.service'
import { prisma } from '@/lib/db/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface PriorityScoreBreakdown {
  deadlineScore: number
  valueScore: number
  clientScore: number
  statusScore: number
  totalScore: number
  reason: string
}

export interface PriorityItem {
  id: string
  type: 'task' | 'project'
  title: string
  priorityScore: number
  reason: string
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
  deadline?: Date
  clientName?: string
  budget?: number
}

export class PriorityScoringService extends BaseService {
  /**
   * Calculate priority score for a task (0-100)
   */
  static async calculateTaskScore(taskId: string): Promise<PriorityScoreBreakdown> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    })

    if (!task) {
      throw new Error('Task not found')
    }

    const now = new Date()
    const breakdown: PriorityScoreBreakdown = {
      deadlineScore: 0,
      valueScore: 0,
      clientScore: 0,
      statusScore: 0,
      totalScore: 0,
      reason: ''
    }

    // 40 points - Deadline proximity
    if (task.dueDate) {
      const daysUntilDue = Math.ceil((task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDue < 0) {
        breakdown.deadlineScore = 40 // Overdue
      } else if (daysUntilDue === 0) {
        breakdown.deadlineScore = 35 // Today
      } else if (daysUntilDue <= 1) {
        breakdown.deadlineScore = 35 // Tomorrow
      } else if (daysUntilDue <= 3) {
        breakdown.deadlineScore = 30 // 1-3 days
      } else if (daysUntilDue <= 7) {
        breakdown.deadlineScore = 20 // 4-7 days
      } else if (daysUntilDue <= 14) {
        breakdown.deadlineScore = 10 // 8-14 days
      } else {
        breakdown.deadlineScore = 5 // > 14 days
      }
    }

    // 30 points - Monetary value (based on project budget)
    if (task.project.budget) {
      const budget = Number(task.project.budget)
      // Normalize budget (0-50k₪) to 0-30 points
      breakdown.valueScore = Math.min(30, (budget / 50000) * 30)
    }

    // 20 points - Client type
    if (task.project.client) {
      breakdown.clientScore = task.project.client.type === 'VIP' ? 20 : 10
    }

    // 10 points - Task status
    switch (task.status) {
      case 'WAITING_APPROVAL':
        breakdown.statusScore = 10
        break
      case 'IN_PROGRESS':
        breakdown.statusScore = 8
        break
      case 'TODO':
        breakdown.statusScore = 5
        break
      case 'COMPLETED':
        breakdown.statusScore = 0
        break
      case 'CANCELLED':
        breakdown.statusScore = 0
        break
      default:
        breakdown.statusScore = 5
    }

    breakdown.totalScore = Math.round(breakdown.deadlineScore + breakdown.valueScore + breakdown.clientScore + breakdown.statusScore)
    
    // Generate reason
    const reasons: string[] = []
    if (breakdown.deadlineScore >= 30) reasons.push('דדליין דחוף')
    if (breakdown.valueScore >= 20) reasons.push('תקציב גבוה')
    if (breakdown.clientScore >= 20) reasons.push('לקוח VIP')
    if (breakdown.statusScore >= 8) reasons.push('ממתין לאישור')
    if (reasons.length === 0) reasons.push('עדיפות רגילה')
    
    breakdown.reason = reasons.join(', ')

    return breakdown
  }

  /**
   * Calculate priority score for a project (0-100)
   */
  static async calculateProjectScore(projectId: string): Promise<PriorityScoreBreakdown> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true
      }
    })

    if (!project) {
      throw new Error('Project not found')
    }

    const now = new Date()
    const breakdown: PriorityScoreBreakdown = {
      deadlineScore: 0,
      valueScore: 0,
      clientScore: 0,
      statusScore: 0,
      totalScore: 0,
      reason: ''
    }

    // 40 points - Deadline proximity
    if (project.deadline) {
      const daysUntilDue = Math.ceil((project.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDue < 0) {
        breakdown.deadlineScore = 40 // Overdue
      } else if (daysUntilDue === 0) {
        breakdown.deadlineScore = 35 // Today
      } else if (daysUntilDue <= 1) {
        breakdown.deadlineScore = 35 // Tomorrow
      } else if (daysUntilDue <= 3) {
        breakdown.deadlineScore = 30 // 1-3 days
      } else if (daysUntilDue <= 7) {
        breakdown.deadlineScore = 20 // 4-7 days
      } else if (daysUntilDue <= 14) {
        breakdown.deadlineScore = 10 // 8-14 days
      } else {
        breakdown.deadlineScore = 5 // > 14 days
      }
    }

    // 30 points - Monetary value (project budget)
    if (project.budget) {
      const budget = Number(project.budget)
      // Normalize budget (0-50k₪) to 0-30 points
      breakdown.valueScore = Math.min(30, (budget / 50000) * 30)
    }

    // 20 points - Client type
    if (project.client) {
      breakdown.clientScore = project.client.type === 'VIP' ? 20 : 10
    }

    // 10 points - Project stage
    switch (project.stage) {
      case 'REVIEW':
      case 'DELIVERY':
        breakdown.statusScore = 10
        break
      case 'TESTING':
        breakdown.statusScore = 8
        break
      case 'DEVELOPMENT':
        breakdown.statusScore = 6
        break
      case 'PLANNING':
        breakdown.statusScore = 4
        break
      case 'MAINTENANCE':
        breakdown.statusScore = 2
        break
      default:
        breakdown.statusScore = 4
    }

    breakdown.totalScore = Math.round(breakdown.deadlineScore + breakdown.valueScore + breakdown.clientScore + breakdown.statusScore)
    
    // Generate reason
    const reasons: string[] = []
    if (breakdown.deadlineScore >= 30) reasons.push('דדליין דחוף')
    if (breakdown.valueScore >= 20) reasons.push('תקציב גבוה')
    if (breakdown.clientScore >= 20) reasons.push('לקוח VIP')
    if (breakdown.statusScore >= 8) reasons.push('שלב מתקדם')
    if (reasons.length === 0) reasons.push('עדיפות רגילה')
    
    breakdown.reason = reasons.join(', ')

    return breakdown
  }

  /**
   * Update task with calculated priority score
   */
  static async updateTaskScore(taskId: string): Promise<void> {
    const breakdown = await this.calculateTaskScore(taskId)
    
    await prisma.task.update({
      where: { id: taskId },
      data: {
        priorityScore: breakdown.totalScore,
        priorityCalculatedAt: new Date()
      }
    })
  }

  /**
   * Update project with calculated priority score
   */
  static async updateProjectScore(projectId: string): Promise<void> {
    const breakdown = await this.calculateProjectScore(projectId)
    
    await prisma.project.update({
      where: { id: projectId },
      data: {
        priorityScore: breakdown.totalScore,
        priorityCalculatedAt: new Date()
      }
    })
  }

  /**
   * Recalculate all scores for a user
   */
  static async recalculateAllScores(userId: string): Promise<{ tasksUpdated: number; projectsUpdated: number }> {
    // Get all tasks and projects for the user
    const [tasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        select: { id: true }
      }),
      prisma.project.findMany({
        where: { userId },
        select: { id: true }
      })
    ])

    // Update all tasks
    const taskPromises = tasks.map(task => this.updateTaskScore(task.id))
    await Promise.all(taskPromises)

    // Update all projects
    const projectPromises = projects.map(project => this.updateProjectScore(project.id))
    await Promise.all(projectPromises)

    return {
      tasksUpdated: tasks.length,
      projectsUpdated: projects.length
    }
  }

  /**
   * Get top priority items for a user
   */
  static async getTopPriorityItems(userId: string, limit: number = 10): Promise<PriorityItem[]> {
    const [topTasks, topProjects] = await Promise.all([
      // Get top tasks
      prisma.task.findMany({
        where: { 
          userId,
          status: { not: 'COMPLETED' }
        },
        include: {
          project: {
            include: {
              client: true
            }
          }
        },
        orderBy: { priorityScore: 'desc' },
        take: Math.ceil(limit / 2)
      }),

      // Get top projects
      prisma.project.findMany({
        where: { 
          userId,
          status: { not: 'COMPLETED' }
        },
        include: {
          client: true
        },
        orderBy: { priorityScore: 'desc' },
        take: Math.ceil(limit / 2)
      })
    ])

    const items: PriorityItem[] = []

    // Add tasks
    topTasks.forEach(task => {
      items.push({
        id: task.id,
        type: 'task',
        title: task.title,
        priorityScore: task.priorityScore || 0,
        reason: this.generateTaskReason(task),
        urgencyLevel: this.getUrgencyLevel(task.priorityScore || 0),
        deadline: task.dueDate || undefined,
        clientName: task.project.client?.name,
        budget: task.project.budget ? Number(task.project.budget) : undefined
      })
    })

    // Add projects
    topProjects.forEach(project => {
      items.push({
        id: project.id,
        type: 'project',
        title: project.name,
        priorityScore: project.priorityScore || 0,
        reason: this.generateProjectReason(project),
        urgencyLevel: this.getUrgencyLevel(project.priorityScore || 0),
        deadline: project.deadline || undefined,
        clientName: project.client?.name,
        budget: project.budget ? Number(project.budget) : undefined
      })
    })

    // Sort by priority score and return top items
    return items
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit)
  }

  /**
   * Get smart recommendations for today
   */
  static async getRecommendedTasksForToday(userId: string): Promise<PriorityItem[]> {
    const topItems = await this.getTopPriorityItems(userId, 5)
    
    // Filter for items that are actionable today
    return topItems.filter(item => {
      // Include high priority items (score >= 50)
      if (item.priorityScore >= 50) return true
      
      // Include items due today or overdue
      if (item.deadline) {
        const today = new Date()
        const deadline = new Date(item.deadline)
        const isToday = deadline.toDateString() === today.toDateString()
        const isOverdue = deadline < today
        return isToday || isOverdue
      }
      
      return false
    })
  }

  /**
   * Get urgency level based on score
   */
  private static getUrgencyLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 70) return 'critical'
    if (score >= 40) return 'high'
    if (score >= 20) return 'medium'
    return 'low'
  }

  /**
   * Generate reason for task priority
   */
  private static generateTaskReason(task: { dueDate?: Date | null; project?: { client?: { type?: string }; budget?: Decimal | null }; status?: string }): string {
    const reasons: string[] = []
    
    if (task.dueDate) {
      const now = new Date()
      const daysUntilDue = Math.ceil((task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDue < 0) {
        reasons.push('דדליין באיחור')
      } else if (daysUntilDue <= 1) {
        reasons.push('דדליין דחוף')
      } else if (daysUntilDue <= 3) {
        reasons.push('דדליין קרוב')
      }
    }
    
    if (task.project?.client?.type === 'VIP') {
      reasons.push('לקוח VIP')
    }
    
    if (task.project?.budget && Number(task.project.budget) >= 20000) {
      reasons.push('תקציב גבוה')
    }
    
    if (task.status === 'WAITING_APPROVAL') {
      reasons.push('ממתין לאישור')
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'עדיפות רגילה'
  }

  /**
   * Generate reason for project priority
   */
  private static generateProjectReason(project: { deadline?: Date | null; client?: { type?: string }; budget?: Decimal | null; stage?: string }): string {
    const reasons: string[] = []
    
    if (project.deadline) {
      const now = new Date()
      const daysUntilDue = Math.ceil((project.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDue < 0) {
        reasons.push('דדליין באיחור')
      } else if (daysUntilDue <= 1) {
        reasons.push('דדליין דחוף')
      } else if (daysUntilDue <= 3) {
        reasons.push('דדליין קרוב')
      }
    }
    
    if (project.client?.type === 'VIP') {
      reasons.push('לקוח VIP')
    }
    
    if (project.budget && Number(project.budget) >= 20000) {
      reasons.push('תקציב גבוה')
    }
    
    if (project.stage && ['REVIEW', 'DELIVERY'].includes(project.stage)) {
      reasons.push('שלב מתקדם')
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'עדיפות רגילה'
  }
}
