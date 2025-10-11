import { BaseService } from './base.service'
import { prisma } from '@/lib/db/prisma'
import { ProjectsService } from './projects.service'

export interface SidebarBadges {
  leads: {
    hot: number
    new: number
  }
  projects: {
    active: number
  }
  tasks: {
    urgent: number
    overdue: number
  }
  payments: {
    overdue: number
    pending: number
  }
}

export interface SearchResult {
  id: string
  title: string
  type: 'lead' | 'client' | 'project' | 'payment'
  subtitle?: string
  href: string
}

export interface DashboardStats {
  activeProjects: number
  totalClients: number
  pendingPayments: number
  weeklyHours: number
  newLeads: number
  monthlyRevenue: number
}

export interface RecentProject {
  id: string
  name: string
  status: string
  progress: number
  client?: {
    name: string
  }
}

export interface TodayTask {
  id: string
  title: string
  priority: string
  deadline?: string
  time?: string
  estimated?: string
  project?: {
    name: string
  }
}

export interface UpcomingPayment {
  id: string
  client: string
  amount: number
  dueDate: string
  status: string
}

export interface DashboardData {
  stats: DashboardStats
  recentProjects: RecentProject[]
  todayTasks: TodayTask[]
  upcomingPayments: UpcomingPayment[]
}

export class DashboardService extends BaseService {
  static async getSidebarBadges(userId: string): Promise<SidebarBadges> {
    const [hotLeads, newLeads, activeProjects, overduePayments, pendingPayments] = await Promise.all([
      // Hot leads (recent activity in last 7 days)
      prisma.lead.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      
      // New leads (last 24 hours)
      prisma.lead.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Active projects
      prisma.project.count({
        where: {
          userId,
          status: 'IN_PROGRESS'
        }
      }),
      
      // Overdue payments
      prisma.payment.count({
        where: {
          userId,
          status: 'PENDING',
          dueDate: {
            lt: new Date()
          }
        }
      }),
      
      // Pending payments (due within 7 days)
      prisma.payment.count({
        where: {
          userId,
          status: 'PENDING',
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    return {
      leads: {
        hot: hotLeads,
        new: newLeads
      },
      projects: {
        active: activeProjects
      },
      payments: {
        overdue: overduePayments,
        pending: pendingPayments
      }
    }
  }

  static async searchAll(userId: string, query: string, limit: number = 10): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`
    
    const [leads, clients, projects, payments] = await Promise.all([
      // Search leads
      prisma.lead.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { company: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          company: true,
          email: true
        },
        take: Math.floor(limit / 4)
      }),
      
      // Search clients
      prisma.client.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { company: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          company: true,
          email: true
        },
        take: Math.floor(limit / 4)
      }),
      
      // Search projects
      prisma.project.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          client: {
            select: { name: true }
          }
        },
        take: Math.floor(limit / 4)
      }),
      
      // Search payments
      prisma.payment.findMany({
        where: {
          userId,
          OR: [
            { notes: { contains: query, mode: 'insensitive' } },
            { client: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { company: { contains: query, mode: 'insensitive' } }
              ]
            }}
          ]
        },
        select: {
          id: true,
          notes: true,
          amount: true,
          client: {
            select: { name: true, company: true }
          }
        },
        take: Math.floor(limit / 4)
      })
    ])

    const results: SearchResult[] = []

    // Add leads to results
    leads.forEach(lead => {
      results.push({
        id: lead.id,
        title: lead.name,
        type: 'lead',
        subtitle: lead.company || lead.email || undefined,
        href: `/leads?id=${lead.id}`
      })
    })

    // Add clients to results
    clients.forEach(client => {
      results.push({
        id: client.id,
        title: client.name,
        type: 'client',
        subtitle: client.company || client.email,
        href: `/clients?id=${client.id}`
      })
    })

    // Add projects to results
    projects.forEach(project => {
      results.push({
        id: project.id,
        title: project.name,
        type: 'project',
        subtitle: project.client?.name || project.description?.substring(0, 50),
        href: `/projects?id=${project.id}`
      })
    })

    // Add payments to results
    payments.forEach(payment => {
      results.push({
        id: payment.id,
        title: payment.notes || 'תשלום',
        type: 'payment',
        subtitle: `${payment.client?.name || payment.client?.company} - ₪${payment.amount}`,
        href: `/payments?id=${payment.id}`
      })
    })

    // Sort by relevance (exact matches first)
    return results
      .sort((a, b) => {
        const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
        return bExact - aExact
      })
      .slice(0, limit)
  }

  static async getRecentSearches(userId: string): Promise<SearchResult[]> {
    // This could be enhanced to store actual search history
    // For now, return recent leads and projects as suggestions
    const [recentLeads, recentProjects] = await Promise.all([
      prisma.lead.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          name: true,
          company: true
        }
      }),
      
      prisma.project.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        select: {
          id: true,
          name: true,
          client: {
            select: { name: true }
          }
        }
      })
    ])

    const results: SearchResult[] = []

    recentLeads.forEach(lead => {
      results.push({
        id: lead.id,
        title: lead.name,
        type: 'lead',
        subtitle: lead.company || undefined,
        href: `/leads?id=${lead.id}`
      })
    })

    recentProjects.forEach(project => {
      results.push({
        id: project.id,
        title: project.name,
        type: 'project',
        subtitle: project.client?.name,
        href: `/projects?id=${project.id}`
      })
    })

    return results
  }

  static async getDashboardData(userId: string): Promise<DashboardData> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    const [
      activeProjects,
      totalClients,
      pendingPayments,
      weeklyHours,
      newLeads,
      monthlyRevenue,
      recentProjects,
      todayTasks,
      upcomingPayments
    ] = await Promise.all([
      // Active projects count
      prisma.project.count({
        where: {
          userId,
          status: 'IN_PROGRESS'
        }
      }),

      // Total clients count
      prisma.client.count({
        where: {
          userId,
          status: 'ACTIVE'
        }
      }),

      // Pending payments count
      prisma.payment.count({
        where: {
          userId,
          status: 'PENDING'
        }
      }),

      // Weekly hours from time entries
      prisma.timeEntry.aggregate({
        where: {
          userId,
          startTime: {
            gte: startOfWeek
          },
          endTime: {
            not: null
          }
        },
        _sum: {
          duration: true
        }
      }),

      // New leads count (last 7 days)
      prisma.lead.count({
        where: {
          userId,
          createdAt: {
            gte: startOfWeek
          }
        }
      }),

      // Monthly revenue from paid payments
      prisma.payment.aggregate({
        where: {
          userId,
          status: 'PAID',
          paidAt: {
            gte: startOfMonth
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Recent projects with progress
      prisma.project.findMany({
        where: {
          userId,
          status: {
            in: ['IN_PROGRESS', 'ON_HOLD']
          }
        },
        include: {
          client: {
            select: {
              name: true
            }
          },
          tasks: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 3
      }),

      // Today's tasks
      prisma.task.findMany({
        where: {
          userId,
          OR: [
            {
              dueDate: {
                gte: startOfDay,
                lt: endOfDay
              }
            },
            {
              priority: {
                in: ['HIGH', 'URGENT']
              },
              status: {
                not: 'COMPLETED'
              }
            }
          ]
        },
        include: {
          project: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' }
        ],
        take: 3
      }),

      // Upcoming payments (next 30 days)
      prisma.payment.findMany({
        where: {
          userId,
          status: 'PENDING',
          dueDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          client: {
            select: {
              name: true,
              company: true
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        },
        take: 5
      })
    ])

    // Calculate project progress based on stage (consistent with projects page)
    const projectsWithProgress = recentProjects.map(project => {
      // Use stage-based progress for consistency with projects page
      const progress = ProjectsService.calculateProgress(project.stage)

      return {
        id: project.id,
        name: project.name,
        status: project.priority === 'HIGH' ? 'URGENT' : project.status,
        progress,
        client: project.client
      }
    })

    // Format today's tasks
    const formattedTasks = todayTasks.map(task => {
      let timeInfo = ''
      if (task.dueDate) {
        const isToday = task.dueDate.toDateString() === now.toDateString()
        const isTomorrow = task.dueDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()
        
        if (isToday) {
          timeInfo = `היום ${task.dueDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
        } else if (isTomorrow) {
          timeInfo = `מחר ${task.dueDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
        } else {
          timeInfo = task.dueDate.toLocaleDateString('he-IL')
        }
      } else if (task.estimatedHours) {
        timeInfo = `${task.estimatedHours} שעות משוערות`
      }

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        deadline: timeInfo,
        project: task.project
      }
    })

    // Format upcoming payments
    const formattedPayments = upcomingPayments.map(payment => {
      const isOverdue = payment.dueDate < now
      
      return {
        id: payment.id,
        client: payment.client.company || payment.client.name,
        amount: Number(payment.amount),
        dueDate: payment.dueDate.toLocaleDateString('he-IL'),
        status: isOverdue ? 'overdue' : 'pending'
      }
    })

    return {
      stats: {
        activeProjects,
        totalClients,
        pendingPayments,
        weeklyHours: Math.round((weeklyHours._sum.duration || 0) / 60 * 10) / 10, // Convert minutes to hours
        newLeads,
        monthlyRevenue: Number(monthlyRevenue._sum.amount || 0)
      },
      recentProjects: projectsWithProgress,
      todayTasks: formattedTasks,
      upcomingPayments: formattedPayments
    }
  }
}