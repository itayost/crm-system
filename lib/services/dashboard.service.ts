import { prisma } from '@/lib/db/prisma'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import { fullLedger } from '@/lib/money/ledger.server'
import { received } from '@/lib/money/ledger'

export class DashboardService {
  static async getData(userId: string) {
    const [
      ledger,
      leadCount,
      clientCount,
      activeProjectCount,
      completedProjectCount,
      pendingTaskCount,
      overdueTaskCount,
      pendingReviewRequestCount,
      openRequestCount,
      activeProjects,
      pendingTasks,
    ] = await Promise.all([
      // Revenue is money that actually arrived, not work that got finished.
      // It used to be "sum of price on COMPLETED projects", so a project half
      // delivered and half paid for showed up as nothing at all.
      fullLedger({ userId }),
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
      prisma.project.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
          // Enough for the phase strip and the total on the היום cockpit, so
          // that list says where each project actually is rather than only
          // naming it.
          phases: {
            select: { price: true, status: true, paidAt: true },
            orderBy: { order: 'asc' },
          },
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
      revenue: received(ledger),
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
      activeProjects,
      pendingTasks,
    }
  }
}
