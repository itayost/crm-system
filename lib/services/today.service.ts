import { prisma } from '@/lib/db/prisma'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import { startOfIsraelDay } from '@/lib/services/morning-brief.service'
import { isBotPaused } from '@/lib/config/bot-pause'

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
  /** Approved but unpaid, in shekels. The invoices worth chasing. */
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

    const [dueLeads, triage, phasesAwaiting, quotesUnanswered, quietLeads, phases, advances] =
      await Promise.all([
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
        prisma.projectPhase.findMany({
          where: { status: 'APPROVED', paidAt: null, project: { userId } },
          select: {
            id: true,
            name: true,
            price: true,
            project: {
              select: { id: true, name: true, client: { select: { name: true } } },
            },
          },
          orderBy: { approvedAt: 'asc' },
        }),
        prisma.project.findMany({
          where: { userId, advancePaidAt: null, advanceAmount: { gt: 0 } },
          select: {
            id: true,
            name: true,
            advanceAmount: true,
            client: { select: { name: true } },
          },
        }),
      ])

    const collect: TodayBoard['collect'] = [
      ...phases.map((p) => ({
        id: p.id,
        projectId: p.project.id,
        projectName: p.project.name,
        clientName: p.project.client?.name ?? null,
        name: p.name,
        price: Number(p.price ?? 0),
        kind: 'phase' as const,
      })),
      ...advances.map((p) => ({
        id: `advance:${p.id}`,
        projectId: p.id,
        projectName: p.name,
        clientName: p.client?.name ?? null,
        name: 'מקדמה',
        price: Number(p.advanceAmount ?? 0),
        kind: 'advance' as const,
      })),
    ].sort((a, b) => b.price - a.price)

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
      collect,
    }
  }

  static async getBadges(userId: string, now: Date = new Date()): Promise<TodayBadges> {
    const todayStart = startOfIsraelDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const [triageRequests, dueTasks, dueLeads, unpaidPhases, unpaidAdvances] = await Promise.all([
      prisma.request.count({
        where: { userId, status: 'PENDING_REVIEW' },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { lt: todayEnd },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          status: { in: [...LEAD_STATUSES] },
          nextActionAt: { lt: todayEnd },
        },
      }),
      // Phases have no userId of their own - ownership comes through the
      // project, the same way AgentProjectConfig works.
      prisma.projectPhase.findMany({
        where: { status: 'APPROVED', paidAt: null, project: { userId } },
        select: { price: true },
      }),
      /**
       * Unpaid advances count too.
       *
       * The badge sits on the nav item that links to /money, so the two must
       * agree - and the ledger there lists an advance as collectable, because
       * a מקדמה is owed on signature rather than on sign-off. Leaving it out
       * here meant the badge said nothing while the page it pointed at said
       * ₪3,000. That is precisely the disagreement this service exists to
       * prevent.
       *
       * Note this is deliberately a wider rule than `projectOutstanding()`,
       * which answers a narrower question ("work signed off but unpaid") for a
       * single project and stays as it is.
       */
      prisma.project.findMany({
        where: { userId, advancePaidAt: null, advanceAmount: { gt: 0 } },
        select: { advanceAmount: true },
      }),
    ])

    const outstanding =
      unpaidPhases.reduce((sum, p) => sum + Number(p.price ?? 0), 0) +
      unpaidAdvances.reduce((sum, p) => sum + Number(p.advanceAmount ?? 0), 0)

    return { triageRequests, dueTasks, dueLeads, outstanding, botPaused: isBotPaused() }
  }
}
