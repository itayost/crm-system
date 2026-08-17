import { prisma } from '@/lib/db/prisma'
import { startOfIsraelDay } from '@/lib/services/morning-brief.service'

/**
 * The ledger, at phase granularity.
 *
 * Money lives on phases, so this lists phases rather than projects - the
 * monthly invoicing ritual is "which stages are signed off and not yet paid",
 * and that question has no answer at project granularity. Advances are folded
 * in as synthetic rows so a project billed entirely up front is not invisible.
 *
 * Phases carry no userId of their own; ownership comes through the project,
 * the same way AgentProjectConfig works. Every query here scopes on
 * `project: { userId }` for that reason.
 */
export type LedgerView = 'due' | 'awaiting' | 'paid' | 'all'

export interface LedgerRow {
  id: string
  kind: 'phase' | 'advance'
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  name: string
  status: string
  price: number
  approvedAt: string | null
  paidAt: string | null
}

export interface Ledger {
  rows: LedgerRow[]
  totals: { due: number; awaiting: number; paidThisMonth: number }
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isNaN(n) ? 0 : n
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Midnight on the 1st, in Israel - not on the server.
 *
 * "שולם החודש" is a claim about the owner's calendar, and production runs in
 * UTC. A payment stamped at 01:00 on the 1st Israel time is 22:00 on the last
 * of the previous month in UTC, so a server-local boundary quietly files it in
 * the wrong month at exactly the moment the number is being read - the end of
 * one and the start of the next.
 *
 * Walks back to the 1st and re-derives the boundary rather than arithmetic on
 * a fixed day length, so a DST change inside the month cannot shift it.
 */
function startOfIsraelMonth(now: Date): Date {
  const dayOfMonth = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', day: 'numeric' }).format(now),
  )
  const todayStart = startOfIsraelDay(now)
  // Midday on the 1st: far enough from either boundary that a DST shift on the
  // way back cannot land on the wrong date.
  const noonOnTheFirst = new Date(todayStart.getTime() - (dayOfMonth - 1) * DAY_MS + DAY_MS / 2)
  return startOfIsraelDay(noonOnTheFirst)
}

export class MoneyService {
  static async getLedger(userId: string): Promise<Ledger> {
    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        advanceAmount: true,
        advancePaidAt: true,
        client: { select: { id: true, name: true } },
        phases: {
          select: {
            id: true,
            name: true,
            status: true,
            price: true,
            approvedAt: true,
            paidAt: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows: LedgerRow[] = []

    for (const project of projects) {
      const base = {
        projectId: project.id,
        projectName: project.name,
        clientId: project.client?.id ?? null,
        clientName: project.client?.name ?? null,
      }

      if (num(project.advanceAmount) > 0) {
        rows.push({
          ...base,
          id: `advance:${project.id}`,
          kind: 'advance',
          name: 'מקדמה',
          // An advance has no approval step - it is owed on signature - so it
          // reads as APPROVED for the purposes of "is this collectable".
          status: 'APPROVED',
          price: num(project.advanceAmount),
          approvedAt: null,
          paidAt: project.advancePaidAt?.toISOString() ?? null,
        })
      }

      for (const phase of project.phases) {
        rows.push({
          ...base,
          id: phase.id,
          kind: 'phase',
          name: phase.name,
          status: phase.status,
          price: num(phase.price),
          approvedAt: phase.approvedAt?.toISOString() ?? null,
          paidAt: phase.paidAt?.toISOString() ?? null,
        })
      }
    }

    const startOfMonth = startOfIsraelMonth(new Date())

    const totals = {
      due: rows
        .filter((r) => r.status === 'APPROVED' && !r.paidAt)
        .reduce((s, r) => s + r.price, 0),
      awaiting: rows
        .filter((r) => r.status === 'PENDING_APPROVAL')
        .reduce((s, r) => s + r.price, 0),
      paidThisMonth: rows
        .filter((r) => r.paidAt && new Date(r.paidAt) >= startOfMonth)
        .reduce((s, r) => s + r.price, 0),
    }

    return { rows, totals }
  }
}
