import { prisma } from '@/lib/db/prisma'

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

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

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
