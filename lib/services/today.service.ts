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

export class TodayService {
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
