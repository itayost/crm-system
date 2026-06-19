import { prisma } from '@/lib/db/prisma'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] as const

export class DashboardService {
  static async getData(userId: string) {
    const [
      revenueResult,
      leadCount,
      clientCount,
      activeProjectCount,
      completedProjectCount,
      pendingTaskCount,
      overdueTaskCount,
      pendingReviewRequestCount,
      openRequestCount,
      recentContacts,
      activeProjects,
      pendingTasks,
    ] = await Promise.all([
      prisma.project.aggregate({
        where: { userId, status: 'COMPLETED', price: { not: null } },
        _sum: { price: true },
      }),
      prisma.contact.count({
        where: { userId, status: { in: [...LEAD_STATUSES] } },
      }),
      prisma.client.count({
        where: { userId },
      }),
      prisma.project.count({
        where: { userId, status: 'ACTIVE' },
      }),
      prisma.project.count({
        where: { userId, status: 'COMPLETED' },
      }),
      prisma.task.count({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.request.count({
        where: { userId, status: 'PENDING_REVIEW' },
      }),
      prisma.request.count({
        where: { userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.contact.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.project.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
        orderBy: [
          { dueDate: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      revenue: Number(revenueResult._sum.price ?? 0),
      contacts: {
        leads: leadCount,
        clients: clientCount,
      },
      projects: {
        active: activeProjectCount,
        completed: completedProjectCount,
      },
      tasks: {
        pending: pendingTaskCount,
        overdue: overdueTaskCount,
      },
      requests: {
        pendingReview: pendingReviewRequestCount,
        open: openRequestCount,
      },
      recentContacts,
      activeProjects,
      pendingTasks,
    }
  }
}
