import { describe, expect, it, vi } from 'vitest'

/**
 * The pipeline counters and the derived timeline.
 *
 * The counters matter because a tile that says 6 must open a list of 6 - the
 * dashboard predicate and the list filter are written twice, in two files, and
 * this is what keeps them honest.
 */

vi.mock('@/lib/db/prisma', () => ({ prisma: { request: { groupBy: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() } } }))

const { median, daysSince } = await import('@/lib/services/request-metrics.service')
const { buildTimeline } = await import('@/lib/services/request-timeline')

describe('median close time', () => {
  it('is null when nothing has closed', () => {
    expect(median([])).toBeNull()
  })

  it('takes the middle of an odd set', () => {
    expect(median([1, 12, 4])).toBe(4)
  })

  it('averages the two middles of an even set', () => {
    expect(median([0, 1, 4, 12])).toBe(2.5)
  })

  it('is not dragged by one job that sat for a quarter', () => {
    // The reason it is a median: a mean here would be 25 and describe nothing.
    expect(median([1, 2, 2, 3, 120])).toBe(2)
  })
})

describe('age in days', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('floors rather than rounds - "15 days" must not mean 15.6', () => {
    expect(daysSince(new Date('2026-08-01T00:00:00Z'), now)).toBe(15)
  })

  it('is zero for today', () => {
    expect(daysSince(new Date('2026-08-16T09:00:00Z'), now)).toBe(0)
  })

  it('never goes negative on a clock skew', () => {
    expect(daysSince(new Date('2026-08-20T00:00:00Z'), now)).toBe(0)
  })
})

describe('the derived timeline', () => {
  /** Only the fields buildTimeline reads, widened so overrides typecheck. */
  interface Fixture {
    id: string
    title: string
    status: string
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    isAiGenerated: boolean
    billingKind: string | null
    quotedAt: string | null
    clientDecision: string | null
    clientDecisionAt: string | null
    clientDecisionNote: string | null
    task: { id: string; title: string; status: string } | null
  }

  const base: Fixture = {
    id: 'r1',
    title: 'לוגו שגוי',
    status: 'OPEN',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    resolvedAt: null,
    isAiGenerated: false,
    billingKind: null,
    quotedAt: null,
    clientDecision: null,
    clientDecisionAt: null,
    clientDecisionNote: null,
    task: null,
  }

  const keys = (r: Fixture) =>
    buildTimeline(r as unknown as Parameters<typeof buildTimeline>[0]).map((e) => e.key)

  it('always opens with the request being filed', () => {
    expect(keys(base)[0]).toBe('created')
  })

  it('shows what is still to come, not just what happened', () => {
    // A timeline that stops at the last real event tells you nothing about
    // what you owe next, which is the question the page exists to answer.
    expect(keys(base)).toContain('to-task')
    expect(keys(base)).toContain('to-resolve')
  })

  it('asks for a price on a chargeable request that has none', () => {
    expect(keys({ ...base, billingKind: 'QUOTE_REQUIRED' })).toContain('to-quote')
  })

  it('waits on the client once a quote is out', () => {
    const k = keys({ ...base, billingKind: 'BILLABLE', quotedAt: '2026-08-03T00:00:00Z' })
    expect(k).toContain('quoted')
    expect(k).toContain('to-decide')
    expect(k).not.toContain('to-quote')
  })

  it('records the decision and stops asking for one', () => {
    const k = keys({
      ...base,
      billingKind: 'BILLABLE',
      quotedAt: '2026-08-03T00:00:00Z',
      clientDecision: 'APPROVED',
      clientDecisionAt: '2026-08-04T00:00:00Z',
    })
    expect(k).toContain('decided')
    expect(k).not.toContain('to-decide')
  })

  it('has nothing left to promise once the work is done', () => {
    const k = keys({ ...base, status: 'RESOLVED', resolvedAt: '2026-08-05T00:00:00Z' })
    expect(k).toContain('resolved')
    expect(k.filter((x) => x.startsWith('to-'))).toEqual([])
  })

  it('promises nothing on a dismissed request either', () => {
    expect(keys({ ...base, status: 'DISMISSED' }).filter((x) => x.startsWith('to-'))).toEqual([])
  })
})
