import { startOfIsraelDay } from '@/lib/services/morning-brief.service'
import { fullLedger, type LedgerRow } from '@/lib/money/ledger.server'
import { awaitingApproval, collectable, receivedSince } from '@/lib/money/ledger'

/**
 * The ledger, at phase granularity.
 *
 * Money lives on phases, so this lists phases rather than projects - the
 * monthly invoicing ritual is "which stages are signed off and not yet paid",
 * and that question has no answer at project granularity. Advances are folded
 * in as ledger rows so a project billed entirely up front is not invisible.
 *
 * The predicates that decide what counts as due/awaiting/paid live in
 * lib/money/ledger.ts, which the browser also runs - this service is just the
 * server-side loader plus the totals a client component cannot compute itself.
 */
export type { LedgerRow }
export type LedgerView = 'due' | 'awaiting' | 'paid' | 'all'

export interface Ledger {
  rows: LedgerRow[]
  totals: { due: number; awaiting: number; paidThisMonth: number }
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
    const rows = await fullLedger({ userId })
    const startOfMonth = startOfIsraelMonth(new Date())

    return {
      rows,
      totals: {
        due: collectable(rows),
        awaiting: awaitingApproval(rows),
        paidThisMonth: receivedSince(rows, startOfMonth),
      },
    }
  }
}
