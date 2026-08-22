import { describe, expect, it, vi } from 'vitest'
import { phaseEntry, type LedgerState } from '@/lib/money/ledger'
import type { ClientPhaseStatus } from '@/lib/services/client-view'

/**
 * lib/money/ledger.ts and lib/services/client-view.ts each derive a phase's
 * state from the same two fields - `status` and `paidAt` - with the same
 * payment-wins rule and the same REVISIONS-folds-into-IN_PROGRESS behaviour.
 * ledger.ts says outright "the two must not diverge", and until now nothing
 * but that comment enforced it.
 *
 * A separate file rather than an addition to tests/client-view.test.ts or
 * tests/money-ledger.test.ts, because the thing under test belongs to
 * neither module - it is the contract between them, the same reason
 * tests/money-agreement.test.ts (which this branch retired) was its own file
 * rather than living inside one side of what it was policing.
 */

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

const { clientPhaseStatusOf } = await import('@/lib/services/client-view')

const PHASE_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_APPROVAL',
  'REVISIONS',
  'APPROVED',
] as const

/** The one correspondence both derivations must honour. */
const CLIENT_TO_LEDGER_STATE: Record<ClientPhaseStatus, LedgerState> = {
  PAID: 'paid',
  DONE: 'collectable',
  AWAITING_YOU: 'awaitingClient',
  IN_PROGRESS: 'inProgress',
  SCHEDULED: 'scheduled',
}

describe('the client and the ledger agree on where a phase stands', () => {
  const PAID_AT = new Date('2026-08-01')

  it.each(PHASE_STATUSES)('unpaid, status=%s', (status) => {
    const clientState = clientPhaseStatusOf({ status, paidAt: null })
    const ledgerState = phaseEntry({ price: 100, status, paidAt: null }).state

    expect(CLIENT_TO_LEDGER_STATE[clientState]).toBe(ledgerState)
  })

  it.each(PHASE_STATUSES)('paid, status=%s', (status) => {
    const clientState = clientPhaseStatusOf({ status, paidAt: PAID_AT })
    const ledgerState = phaseEntry({ price: 100, status, paidAt: PAID_AT }).state

    // Payment wins on both sides, whatever the status says.
    expect(ledgerState).toBe('paid')
    expect(CLIENT_TO_LEDGER_STATE[clientState]).toBe(ledgerState)
  })
})
