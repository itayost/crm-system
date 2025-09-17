import { prisma } from '@/lib/db/prisma'
import { BaseService } from './base.service'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format } from 'date-fns'
interface DashboardMetrics {
  totalClients: number
  activeProjects: number
  totalRevenue: number
  monthlyRevenue: number
  pendingPayments: number
  overduePayments: number
  totalTasks: number
  completedTasks: number
  activeTasks: number
  totalHours: number
  weeklyHours: number
  leadConversionRate: number
  totalLeads: number
  convertedLeads: number
}

interface RevenueData {
  month: string
  revenue: number
  payments: number
}

interface TimeData {
  date: string
  hours: number
  projects: number
}

interface ProjectAnalytics {
  id: string
  name: string
  type: string
  client: string
  estimatedHours: number
  actualHours: number
  budget: number
  revenue: number
  profitability: number
  completion: number
  status: string
}

interface ClientAnalytics {
  id: string
  name: string
  company: string
  totalRevenue: number
  projectsCount: number
  averageProjectValue: number
  lastProject: string
  type: string
}

export class ReportsService extends BaseService {
  /**
   * Get main dashboard metrics
   */
  static async getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
    try {
      const now = new Date()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const weekStart = startOfWeek(now, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 })

      const [
        totalClients,
        activeProjects,
        totalRevenue,
        monthlyRevenue,
        pendingPayments,
        overduePayments,
        totalTasks,
        completedTasks,
        activeTasks,
        totalTimeMinutes,
        weeklyTimeMinutes,
        totalLeads,
        convertedLeads
      ] = await Promise.all([
        // Clients
        prisma.client.count({ where: { userId, status: 'ACTIVE' } }),
        
        // Projects
        prisma.project.count({ where: { userId, status: 'IN_PROGRESS' } }),
        
        // Revenue - total from payments
        prisma.payment.aggregate({
          where: { userId, status: 'PAID' },
          _sum: { amount: true }
        }),
        
        // Monthly revenue
        prisma.payment.aggregate({
          where: {
            userId,
            status: 'PAID',
            paidAt: { gte: monthStart, lte: monthEnd }
          },
          _sum: { amount: true }
        }),
        
        // Pending payments count
        prisma.payment.count({
          where: { userId, status: 'PENDING' }
        }),
        
        // Overdue payments count
        prisma.payment.count({
          where: {
            userId,
            status: 'PENDING',
            dueDate: { lt: now }
          }
        }),
        
        // Tasks
        prisma.task.count({ where: { userId } }),
        prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.task.count({ where: { userId, status: 'IN_PROGRESS' } }),
        
        // Time entries - total minutes
        prisma.timeEntry.aggregate({
          where: { userId, duration: { not: null } },
          _sum: { duration: true }
        }),
        
        // Weekly time entries
        prisma.timeEntry.aggregate({
          where: {
            userId,
            duration: { not: null },
            startTime: { gte: weekStart, lte: weekEnd }
          },
          _sum: { duration: true }
        }),
        
        // Leads
        prisma.lead.count({ where: { userId } }),
        prisma.lead.count({ where: { userId, status: 'CONVERTED' } })
      ])

      const totalHours = (totalTimeMinutes._sum.duration || 0) / 60
      const weeklyHours = (weeklyTimeMinutes._sum.duration || 0) / 60
      const leadConversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      return {
        totalClients,
        activeProjects,
        totalRevenue: Number(totalRevenue._sum.amount || 0),
        monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
        pendingPayments,
        overduePayments,
        totalTasks,
        completedTasks,
        activeTasks,
        totalHours,
        weeklyHours,
        leadConversionRate,
        totalLeads,
        convertedLeads
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get revenue analytics over time
   */
  static async getRevenueAnalytics(userId: string, months: number = 12): Promise<RevenueData[]> {
    try {
      const now = new Date()
      const startDate = subMonths(now, months)

      const payments = await prisma.payment.findMany({
        where: {
          userId,
          status: 'PAID',
          paidAt: { gte: startDate, lte: now }
        },
        select: {
          amount: true,
          paidAt: true
        },
        orderBy: { paidAt: 'asc' }
      })

      // Group by month
      const monthlyData: Record<string, { revenue: number; payments: number }> = {}
      
      payments.forEach(payment => {
        if (payment.paidAt) {
          const monthKey = format(payment.paidAt, 'yyyy-MM')
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, payments: 0 }
          }
          monthlyData[monthKey].revenue += Number(payment.amount)
          monthlyData[monthKey].payments += 1
        }
      })

      // Convert to array and fill missing months
      const result: RevenueData[] = []
      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(now, i)
        const monthKey = format(date, 'yyyy-MM')
        const monthName = format(date, 'MMM yyyy')
        
        result.push({
          month: monthName,
          revenue: monthlyData[monthKey]?.revenue || 0,
          payments: monthlyData[monthKey]?.payments || 0
        })
      }

      return result
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get time tracking analytics
   */
  static async getTimeAnalytics(userId: string, days: number = 30): Promise<TimeData[]> {
    try {
      const now = new Date()
      const startDate = new Date()
      startDate.setDate(now.getDate() - days)

      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          userId,
          duration: { not: null },
          startTime: { gte: startDate, lte: now }
        },
        select: {
          duration: true,
          startTime: true,
          projectId: true
        },
        orderBy: { startTime: 'asc' }
      })

      // Group by day
      const dailyData: Record<string, { hours: number; projects: Set<string> }> = {}
      
      timeEntries.forEach(entry => {
        const dayKey = format(entry.startTime, 'yyyy-MM-dd')
        if (!dailyData[dayKey]) {
          dailyData[dayKey] = { hours: 0, projects: new Set() }
        }
        dailyData[dayKey].hours += (entry.duration || 0) / 60
        if (entry.projectId) {
          dailyData[dayKey].projects.add(entry.projectId)
        }
      })

      // Convert to array
      const result: TimeData[] = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(now.getDate() - i)
        const dayKey = format(date, 'yyyy-MM-dd')
        const dayName = format(date, 'MM/dd')
        
        result.push({
          date: dayName,
          hours: Math.round((dailyData[dayKey]?.hours || 0) * 10) / 10,
          projects: dailyData[dayKey]?.projects.size || 0
        })
      }

      return result
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get project analytics
   */
  static async getProjectAnalytics(userId: string): Promise<ProjectAnalytics[]> {
    try {
      const projects = await prisma.project.findMany({
        where: { userId },
        include: {
          client: {
            select: { name: true, company: true }
          },
          tasks: {
            select: { status: true }
          },
          payments: {
            where: { status: 'PAID' },
            select: { amount: true }
          },
          timeEntries: {
            select: { duration: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return projects.map(project => {
        const totalTasks = project.tasks.length
        const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length
        const completion = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        
        const revenue = project.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const estimatedHours = project.estimatedHours || 0
        const actualHours = project.timeEntries.reduce((sum, t) => sum + (t.duration || 0), 0) / 60
        const profitability = estimatedHours > 0 ? ((revenue - (actualHours * 100)) / revenue) * 100 : 0

        return {
          id: project.id,
          name: project.name,
          type: project.type,
          client: project.client.company || project.client.name,
          estimatedHours,
          actualHours: Math.round(actualHours * 10) / 10,
          budget: Number(project.budget || 0),
          revenue,
          profitability: Math.round(profitability * 10) / 10,
          completion: Math.round(completion),
          status: project.status
        }
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get client analytics
   */
  static async getClientAnalytics(userId: string): Promise<ClientAnalytics[]> {
    try {
      const clients = await prisma.client.findMany({
        where: { userId, status: 'ACTIVE' },
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              budget: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          },
          payments: {
            where: { status: 'PAID' },
            select: { amount: true }
          }
        },
        orderBy: { totalRevenue: 'desc' }
      })

      return clients.map(client => {
        const totalRevenue = client.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const projectsCount = client.projects.length
        const averageProjectValue = projectsCount > 0 ? totalRevenue / projectsCount : 0
        const lastProject = client.projects[0]?.name || 'אין פרויקטים'

        return {
          id: client.id,
          name: client.name,
          company: client.company || '',
          totalRevenue,
          projectsCount,
          averageProjectValue: Math.round(averageProjectValue),
          lastProject,
          type: client.type
        }
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Get lead conversion funnel data
   */
  static async getLeadFunnelData(userId: string) {
    try {
      const leadsByStatus = await prisma.lead.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true }
      })

      const funnelData = [
        { stage: 'לידים חדשים', count: 0, percentage: 0 },
        { stage: 'יצירת קשר', count: 0, percentage: 0 },
        { stage: 'הצעת מחיר', count: 0, percentage: 0 },
        { stage: 'משא ומתן', count: 0, percentage: 0 },
        { stage: 'לקוחות', count: 0, percentage: 0 }
      ]

      const statusMap = {
        'NEW': 0,
        'CONTACTED': 1,
        'QUOTED': 2,
        'NEGOTIATING': 3,
        'CONVERTED': 4
      }

      const totalLeads = leadsByStatus.reduce((sum, item) => sum + item._count.status, 0)

      leadsByStatus.forEach(item => {
        const index = statusMap[item.status as keyof typeof statusMap]
        if (index !== undefined) {
          funnelData[index].count = item._count.status
          funnelData[index].percentage = totalLeads > 0 ? Math.round((item._count.status / totalLeads) * 100) : 0
        }
      })

      return funnelData
    } catch (error) {
      this.handleError(error)
    }
  }
}