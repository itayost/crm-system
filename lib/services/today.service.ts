import { prisma } from '@/lib/db/prisma'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import { startOfIsraelDay } from '@/lib/services/morning-brief.service'
import { isBotPaused } from '@/lib/config/bot-pause'
import { openLedger } from '@/lib/money/ledger.server'
import { collectable, isCollectable } from '@/lib/money/ledger'

/**
 * What is owed today, as counts.
 *
 * One set of predicates, two consumers: the nav badges and (from Phase 4) the
 * היום cockpit. The morning brief asks the same questions of the same data, so
 * these live here rather than being re-expressed per surface - the owner-side
 * equivalent of what lib/services/client-view.ts does for the client side, and
 * for the same reason: the one thing they must never do is disagree.
 *
 * The badge rule, written down because it is easy to lose: a badge is only
 * allowed on a number that can reach zero on a good day. "23 open tasks" gets
 * no badge, because a permanent badge is wallpaper. "3 overdue" gets one.
 */
export interface TodayBadges {
  /** Client tickets nobody has triaged. Blocked on the owner. */
  triageRequests: number
  /** Open tasks already due or overdue. */
  dueTasks: number
  /** Leads with a next action promised for today or earlier. */
  dueLeads: number
  /** גבייה: everything invoiceable now, unpaid מקדמות included. */
  outstanding: number
  /**
   * Whether the client-facing WhatsApp bot is muted.
   *
   * Rides along here because it is read on every screen and there is no other
   * reason to make a request for it. Today this state is completely invisible
   * in the UI, which means "the bot went quiet" is diagnosed by reading a
   * deploy log.
   */
  botPaused: boolean
}

export interface TodayBoard {
  /** Leads with a next action promised for today or earlier. */
  dueLeads: {
    id: string
    name: string
    status: string
    nextActionAt: string | null
    nextActionNote: string | null
    overdue: boolean
  }[]
  /** Client tickets nobody has triaged. */
  triage: {
    id: string
    title: string
    type: string
    clientName: string | null
    createdAt: string
  }[]
  /** Rotting, but not the owner's move. Counts plus how old the oldest is. */
  atClient: {
    phasesAwaitingApproval: number
    quotesUnanswered: number
    quietLeads: number
  }
  /**
   * True totals, not the length of the truncated lists above.
   *
   * The lists are capped for display; the day line counts what is actually
   * owed. Reading `dueLeads.length` made the header say "6 דברים דורשים אותך"
   * while the nav badge - which uses the uncapped count - said 12. Two numbers
   * for one question is exactly what this service exists to prevent.
   */
  counts: { dueLeads: number; triage: number }
  /** Approved and unpaid, plus unpaid advances. */
  collect: {
    id: string
    projectId: string
    projectName: string
    clientName: string | null
    name: string
    price: number
    kind: 'phase' | 'advance'
  }[]
}

export class TodayService {
  /**
   * The action blocks of the היום cockpit.
   *
   * Ordered by who is blocked: the owner first, then a decision only the owner
   * can make, then what is sitting with the client, then the money. Every
   * predicate is one the morning brief already asks - which is the point of
   * putting them here rather than re-deriving them per surface.
   */
  static async getBoard(userId: string, now: Date = new Date()): Promise<TodayBoard> {
    const todayStart = startOfIsraelDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    const [
      dueLeads,
      dueLeadsTotal,
      triage,
      triageTotal,
      phasesAwaiting,
      quotesUnanswered,
      quietLeads,
      ledger,
    ] = await Promise.all([
        prisma.contact.findMany({
          where: {
            userId,
            status: { in: [...LEAD_STATUSES] },
            nextActionAt: { lt: todayEnd },
          },
          select: {
            id: true,
            name: true,
            status: true,
            nextActionAt: true,
            nextActionNote: true,
          },
          orderBy: { nextActionAt: 'asc' },
          take: 6,
        }),
        prisma.contact.count({
          where: {
            userId,
            status: { in: [...LEAD_STATUSES] },
            nextActionAt: { lt: todayEnd },
          },
        }),
        prisma.request.findMany({
          where: { userId, status: 'PENDING_REVIEW' },
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            client: { select: { name: true } },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 5,
        }),
        prisma.request.count({ where: { userId, status: 'PENDING_REVIEW' } }),
        prisma.projectPhase.count({
          where: { status: 'PENDING_APPROVAL', project: { userId, status: 'ACTIVE' } },
        }),
        prisma.request.count({
          where: {
            userId,
            quotedAt: { not: null },
            clientDecisionAt: null,
            status: { not: 'DISMISSED' },
          },
        }),
        prisma.contact.count({
          where: {
            userId,
            status: { in: [...LEAD_STATUSES] },
            nextActionAt: null,
            OR: [
              { lastContactedAt: { lt: threeDaysAgo } },
              { lastContactedAt: null, createdAt: { lt: threeDaysAgo } },
            ],
          },
        }),
        openLedger({ userId }),
      ])

    const collect: TodayBoard['collect'] = ledger
      .filter(isCollectable)
      .map((row) => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        clientName: row.clientName,
        name: row.name,
        price: row.price,
        kind: row.kind,
      }))
      .sort((a, b) => b.price - a.price)

    return {
      dueLeads: dueLeads.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        nextActionAt: c.nextActionAt?.toISOString() ?? null,
        nextActionNote: c.nextActionNote,
        overdue: Boolean(c.nextActionAt && c.nextActionAt < todayStart),
      })),
      triage: triage.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        clientName: r.client?.name ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      atClient: { phasesAwaitingApproval: phasesAwaiting, quotesUnanswered, quietLeads },
      counts: { dueLeads: dueLeadsTotal, triage: triageTotal },
      collect,
    }
  }

  static async getBadges(userId: string, now: Date = new Date()): Promise<TodayBadges> {
    const todayStart = startOfIsraelDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const [triageRequests, dueTasks, dueLeads, ledger] = await Promise.all([
      prisma.request.count({ where: { userId, status: 'PENDING_REVIEW' } }),
      prisma.task.count({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: todayEnd } },
      }),
      prisma.contact.count({
        where: { userId, status: { in: [...LEAD_STATUSES] }, nextActionAt: { lt: todayEnd } },
      }),
      openLedger({ userId }),
    ])

    return {
      triageRequests,
      dueTasks,
      dueLeads,
      outstanding: collectable(ledger),
      botPaused: isBotPaused(),
    }
  }
}
