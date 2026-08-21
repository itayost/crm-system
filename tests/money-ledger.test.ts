import { describe, expect, it } from 'vitest'
import {
  advanceEntry,
  agreed,
  awaitingApproval,
  collectable,
  entriesOf,
  isCollectable,
  phaseEntry,
  received,
  receivedSince,
  signedOffUnpaid,
  type LedgerEntry,
} from '@/lib/money/ledger'

const phase = (status: string, paidAt: string | null = null, price = 100) =>
  phaseEntry({ price, status, paidAt })

describe('state derivation', () => {
  it('reads an unpaid advance as collectable - it is owed on signature', () => {
    expect(advanceEntry(500, null)?.state).toBe('collectable')
  })

  it('reads a paid advance as paid', () => {
    expect(advanceEntry(500, '2026-08-01T00:00:00.000Z')?.state).toBe('paid')
  })

  it('has no entry at all for a project without an advance', () => {
    expect(advanceEntry(0, null)).toBeNull()
    expect(advanceEntry(null, null)).toBeNull()
  })

  it('never gives an advance a phase status', () => {
    expect(advanceEntry(500, null)?.phaseStatus).toBeNull()
  })

  it('maps every phase status to a state', () => {
    expect(phase('NOT_STARTED').state).toBe('scheduled')
    expect(phase('IN_PROGRESS').state).toBe('inProgress')
    expect(phase('REVISIONS').state).toBe('inProgress')
    expect(phase('PENDING_APPROVAL').state).toBe('awaitingClient')
    expect(phase('APPROVED').state).toBe('collectable')
  })

  it('treats REVISIONS as the owner working, not the client waiting', () => {
    expect(phase('REVISIONS').state).toBe(phase('IN_PROGRESS').state)
  })

  it('lets payment win over any status', () => {
    expect(phase('APPROVED', '2026-08-01T00:00:00.000Z').state).toBe('paid')
    expect(phase('PENDING_APPROVAL', '2026-08-01T00:00:00.000Z').state).toBe('paid')
  })

  it('accepts the string Decimals that arrive over JSON', () => {
    expect(phaseEntry({ price: '250.00', status: 'APPROVED' }).price).toBe(250)
  })

  it('accepts a Date for paidAt and normalises it to an ISO string', () => {
    const entry = phaseEntry({ price: 1, status: 'APPROVED', paidAt: new Date('2026-08-01') })
    expect(entry.paidAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('reads an unknown status as scheduled rather than throwing', () => {
    expect(phase('WHAT_IS_THIS').state).toBe('scheduled')
  })
})

describe('the two concepts stay distinct', () => {
  const entries = entriesOf(1000, null, [
    { price: 300, status: 'APPROVED' },
    { price: 400, status: 'PENDING_APPROVAL' },
    { price: 500, status: 'APPROVED', paidAt: '2026-08-01T00:00:00.000Z' },
  ])

  it('collectable counts the unpaid advance and the approved unpaid phase', () => {
    expect(collectable(entries)).toBe(1300)
  })

  it('signedOffUnpaid counts the phase only, never the advance', () => {
    expect(signedOffUnpaid(entries)).toBe(300)
  })

  it('awaitingApproval counts what is sitting with the client', () => {
    expect(awaitingApproval(entries)).toBe(400)
  })

  it('received counts only money that arrived', () => {
    expect(received(entries)).toBe(500)
  })

  it('agreed counts everything the client signed up for', () => {
    expect(agreed(entries)).toBe(2200)
  })
})

describe('receivedSince', () => {
  it('counts payments on or after the boundary', () => {
    const entries = entriesOf(null, null, [
      { price: 100, status: 'APPROVED', paidAt: '2026-08-01T00:00:00.000Z' },
      { price: 200, status: 'APPROVED', paidAt: '2026-07-31T23:59:59.000Z' },
    ])
    expect(receivedSince(entries, new Date('2026-08-01T00:00:00.000Z'))).toBe(100)
  })
})

describe('the rule that makes a prefilter sound', () => {
  const every: LedgerEntry[] = [
    ...['NOT_STARTED', 'IN_PROGRESS', 'REVISIONS', 'PENDING_APPROVAL', 'APPROVED'].flatMap((s) => [
      phase(s, null),
      phase(s, '2026-08-01T00:00:00.000Z'),
    ]),
    advanceEntry(500, null)!,
    advanceEntry(500, '2026-08-01T00:00:00.000Z')!,
  ]

  /**
   * openLedger() prefilters to `paidAt: null`. That is only safe while nothing
   * collectable carries a payment date. If this ever fails, the badge silently
   * starts under-reporting and no other test will catch it.
   */
  it('never marks a paid entry collectable', () => {
    for (const entry of every) {
      if (isCollectable(entry)) expect(entry.paidAt).toBeNull()
    }
    expect(every.some(isCollectable)).toBe(true)
  })
})

describe('empty and absent input', () => {
  it('is zero rather than NaN throughout', () => {
    expect(collectable([])).toBe(0)
    expect(received([])).toBe(0)
    expect(agreed(entriesOf(null, null, []))).toBe(0)
    expect(agreed(entriesOf(undefined, undefined))).toBe(0)
  })
})
