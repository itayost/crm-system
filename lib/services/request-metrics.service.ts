import { prisma } from '@/lib/db/prisma'

/**
 * The numbers that answer "what needs me, and what is rotting".
 *
 * Kept out of DashboardService on purpose: that one aggregates the whole
 * business into five KPI tiles, and its request surface is two counters. This
 * one is about the request pipeline alone and is read by the requests screen as
 * well as the dashboard, so it would have been the wrong shape there.
 *
 * Every figure below is a count or a date over columns that already exist. No
 * new schema, no history table.
 */

/** Open in the sense that matters: still someone's problem. */
const LIVE = ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS'] as const

export interface RequestMetrics {
  /** Counts by lifecycle stage, for the pipeline. */
  pipeline: {
    pendingReview: number
    open: number
    inProgress: number
    resolved: number
    dismissed: number
  }
  /** The queues that need a decision from someone. */
  decisions: {
    /** Classified as chargeable but never priced - blocked by you. */
    needsPricing: number
    /** Live work with no billing classification at all - the gate never engaged. */
    unclassified: number
    /** Quoted and unanswered - blocked by the client. */
    awaitingClient: number
    /** Live requests that produced no Task, for any reason. */
    withoutTask: number
  }
  /** Age of the oldest live request, in whole days. Null when nothing is open. */
  oldestOpenDays: number | null
  /** Median days from open to resolved over the last 20 closed. Null if none. */
  medianCloseDays: number | null
}

export class RequestMetricsService {
  /**
   * Owner-wide by default, one client when scoped.
   *
   * The scoping is a single extra predicate on every query rather than a second
   * service, so the client page and the dashboard can never drift about what
   * "needs pricing" means - and RequestPipeline / DecisionsCard take the result
   * as a prop, so they render either without knowing which they were given.
   */
  static async get(userId: string, clientId?: string): Promise<RequestMetrics> {
    const scope = clientId ? { userId, clientId } : { userId }

    const [byStatus, needsPricing, unclassified, awaitingClient, withoutTask, oldest, closed] =
      await Promise.all([
        prisma.request.groupBy({
          by: ['status'],
          where: scope,
          _count: true,
        }),
        prisma.request.count({
          where: {
            ...scope,
            status: { in: [...LIVE] },
            billingKind: { in: ['BILLABLE', 'QUOTE_REQUIRED'] },
            quotedAt: null,
          },
        }),
        prisma.request.count({
          where: { ...scope, status: { in: [...LIVE] }, billingKind: null },
        }),
        prisma.request.count({
          where: { ...scope, quotedAt: { not: null }, clientDecisionAt: null, NOT: { status: 'DISMISSED' } },
        }),
        prisma.request.count({
          where: { ...scope, status: { in: [...LIVE] }, taskId: null },
        }),
        prisma.request.findFirst({
          where: { ...scope, status: { in: [...LIVE] } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        prisma.request.findMany({
          where: { ...scope, status: 'RESOLVED', resolvedAt: { not: null } },
          orderBy: { resolvedAt: 'desc' },
          take: 20,
          select: { createdAt: true, resolvedAt: true },
        }),
      ])

    const count = (status: string) => byStatus.find((row) => row.status === status)?._count ?? 0

    return {
      pipeline: {
        pendingReview: count('PENDING_REVIEW'),
        open: count('OPEN'),
        inProgress: count('IN_PROGRESS'),
        resolved: count('RESOLVED'),
        dismissed: count('DISMISSED'),
      },
      decisions: {
        needsPricing,
        unclassified,
        awaitingClient,
        withoutTask,
      },
      oldestOpenDays: oldest ? daysSince(oldest.createdAt) : null,
      medianCloseDays: median(
        closed.map((r) => daysBetween(r.createdAt, r.resolvedAt!)),
      ),
    }
  }
}

/** Whole days elapsed, floored - "opened 15 days ago" not "15.4". */
export function daysSince(from: Date | string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

/**
 * Median rather than mean: one job that sat for three months would drag an
 * average past every real number and make the figure useless.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
