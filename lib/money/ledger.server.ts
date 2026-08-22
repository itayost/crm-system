/**
 * Loading the ledger. Server only - the predicates live in ./ledger, which the
 * browser also runs.
 *
 * Two loaders, differing only in how many rows travel. The `where` clauses here
 * are guaranteed supersets of anything ./ledger can match, so a prefilter can
 * never change an answer. The rule that makes openLedger sound is asserted
 * directly in tests/money-ledger.test.ts: nothing collectable carries a payment
 * date, so filtering to unpaid rows cannot drop one.
 *
 * getBadges runs on every route change and every 120 seconds, which is why the
 * open ledger exists at all rather than everything using fullLedger.
 */
import { prisma } from '@/lib/db/prisma'
import { advanceEntry, phaseEntry, type LedgerEntry } from '@/lib/money/ledger'

export interface LedgerScope {
  userId: string
  clientId?: string
  projectId?: string
}

export interface LedgerRow extends LedgerEntry {
  id: string
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  name: string
  approvedAt: string | null
}

const ADVANCE_NAME = 'מקדמה'

async function load(scope: LedgerScope, unpaidOnly: boolean): Promise<LedgerRow[]> {
  const projects = await prisma.project.findMany({
    where: {
      userId: scope.userId,
      ...(scope.clientId ? { clientId: scope.clientId } : {}),
      ...(scope.projectId ? { id: scope.projectId } : {}),
    },
    select: {
      id: true,
      name: true,
      advanceAmount: true,
      advancePaidAt: true,
      client: { select: { id: true, name: true } },
      phases: {
        where: unpaidOnly ? { paidAt: null } : undefined,
        select: {
          id: true,
          name: true,
          status: true,
          price: true,
          approvedAt: true,
          paidAt: true,
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

    const advance = advanceEntry(project.advanceAmount, project.advancePaidAt)
    // The phase prefilter is a database concern; the advance lives on the
    // project row, so its equivalent has to happen here.
    if (advance && !(unpaidOnly && advance.paidAt)) {
      rows.push({ ...base, ...advance, id: `advance:${project.id}`, name: ADVANCE_NAME, approvedAt: null })
    }

    for (const phase of project.phases) {
      rows.push({
        ...base,
        ...phaseEntry(phase),
        id: phase.id,
        name: phase.name,
        approvedAt: phase.approvedAt?.toISOString() ?? null,
      })
    }
  }

  return rows
}

/** Unpaid rows only. Enough for גבייה, and bounded by what is still owed. */
export function openLedger(scope: LedgerScope): Promise<LedgerRow[]> {
  return load(scope, true)
}

/** Every row, paid history included. Needed for received() and the /money page. */
export function fullLedger(scope: LedgerScope): Promise<LedgerRow[]> {
  return load(scope, false)
}
