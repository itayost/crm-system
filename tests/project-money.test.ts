import { describe, expect, it } from 'vitest'
import {
  projectTotal,
  projectPaid,
  projectOutstanding,
} from '@/lib/utils/project-money'

/**
 * These three run on the server against Prisma Decimals and in the browser
 * against the strings JSON turned them into, so the string cases are not
 * paranoia - they are the normal client-side path.
 */

const PHASES = [
  { price: 1500, status: 'APPROVED', paidAt: '2026-07-01T00:00:00.000Z' },
  { price: 1500, status: 'APPROVED', paidAt: null },
  { price: 1000, status: 'IN_PROGRESS', paidAt: null },
]

describe('projectTotal', () => {
  it('adds the advance to every phase regardless of status', () => {
    expect(projectTotal(1000, PHASES)).toBe(5000)
  })

  it('treats a missing advance as zero rather than NaN', () => {
    expect(projectTotal(null, PHASES)).toBe(4000)
    expect(projectTotal(undefined, PHASES)).toBe(4000)
  })

  it('handles the string Decimals that arrive over JSON', () => {
    expect(projectTotal('1000.00', [{ price: '1500.50', paidAt: null }])).toBe(2500.5)
  })

  it('is zero for a project with no advance and no phases', () => {
    expect(projectTotal(null, [])).toBe(0)
    expect(projectTotal(null)).toBe(0)
  })
})

describe('projectPaid', () => {
  it('counts only phases with a payment date', () => {
    expect(projectPaid(1000, '2026-06-01T00:00:00.000Z', PHASES)).toBe(2500)
  })

  it('ignores an unpaid advance even when an amount is set', () => {
    expect(projectPaid(1000, null, PHASES)).toBe(1500)
  })

  it('never counts approval as payment', () => {
    const approvedButUnpaid = [{ price: 9000, status: 'APPROVED', paidAt: null }]
    expect(projectPaid(null, null, approvedButUnpaid)).toBe(0)
  })
})

describe('projectOutstanding', () => {
  it('counts work signed off but not settled', () => {
    expect(projectOutstanding(PHASES)).toBe(1500)
  })

  it('ignores unapproved work - it is not owed yet', () => {
    expect(projectOutstanding([{ price: 4000, status: 'PENDING_APPROVAL', paidAt: null }])).toBe(0)
  })

  it('ignores approved work already paid for', () => {
    expect(
      projectOutstanding([{ price: 4000, status: 'APPROVED', paidAt: '2026-07-01' }])
    ).toBe(0)
  })
})

describe('a phase materialised from an approved client quote', () => {
  /**
   * What RequestsService.ensurePhase writes when a client approves a quote in
   * the portal: the price they agreed to, NOT_STARTED, and no approvedAt.
   */
  const FROM_QUOTE = { price: 1200, status: 'NOT_STARTED', paidAt: null }

  it('counts towards what the client has agreed to pay', () => {
    expect(projectTotal(0, [FROM_QUOTE])).toBe(1200)
  })

  it('is not owed yet - the client approved the quote, not the work', () => {
    // This is the assertion that keeps unearned money out of the dashboard's
    // "chase this" tile and out of the morning brief. Sold is not delivered.
    expect(projectOutstanding([FROM_QUOTE])).toBe(0)
  })

  it('becomes owed once the delivered work is signed off', () => {
    expect(projectOutstanding([{ ...FROM_QUOTE, status: 'APPROVED' }])).toBe(1200)
  })

  it('is never counted as paid before it is paid', () => {
    expect(projectPaid(0, null, [FROM_QUOTE])).toBe(0)
  })
})

describe('the seeded projects keep their old totals', () => {
  // The e2e specs pin 5,000 and 15,000. They used to be Project.price and are
  // now computed, so this is the guard that the migration preserved meaning.
  it('פרויקט אתר still totals 5,000', () => {
    expect(
      projectTotal(1000, [{ price: 1500 }, { price: 1500 }, { price: 1000 }])
    ).toBe(5000)
  })

  it('פרויקט אפליקציה still totals 15,000', () => {
    expect(projectTotal(3000, [{ price: 5000 }, { price: 7000 }])).toBe(15000)
  })
})
