import { describe, expect, it, vi } from 'vitest'

/**
 * What a client is allowed to see, and what they are told it means.
 *
 * Two things are being protected here. The derivation, because the portal and
 * the WhatsApp bot both render it and must never describe one ticket as two
 * different things; and the field whitelist, because the failure mode of a leak
 * is silent - someone adds a column to Request, nobody remembers this file, and
 * an AI confidence score turns up on a client's phone.
 */

vi.mock('@/lib/db/prisma', () => ({ prisma: { request: { findMany: vi.fn(), findFirst: vi.fn() } } }))

const { clientStatusOf, isAwaitingClient, toClientRequest, CLIENT_VISIBLE_STATUSES } = await import(
  '@/lib/services/client-view'
)

const NO_QUOTE = { quotedAt: null, clientDecision: null, clientDecisionAt: null }

describe('the status a client is shown', () => {
  it('hides a dismissed request entirely', () => {
    expect(clientStatusOf({ status: 'DISMISSED', ...NO_QUOTE })).toBeNull()
  })

  it('maps the internal lifecycle onto words a client can act on', () => {
    expect(clientStatusOf({ status: 'PENDING_REVIEW', ...NO_QUOTE })).toBe('RECEIVED')
    expect(clientStatusOf({ status: 'OPEN', ...NO_QUOTE })).toBe('SCHEDULED')
    expect(clientStatusOf({ status: 'IN_PROGRESS', ...NO_QUOTE })).toBe('IN_PROGRESS')
    expect(clientStatusOf({ status: 'RESOLVED', ...NO_QUOTE })).toBe('DONE')
  })

  it('lets an unanswered quote outrank where the work is', () => {
    // A request is genuinely OPEN and waiting on the client at the same time.
    // Of those two facts, only one is something they can do anything about.
    const quoted = { quotedAt: new Date('2026-08-01'), clientDecision: null, clientDecisionAt: null }

    expect(clientStatusOf({ status: 'OPEN', ...quoted })).toBe('AWAITING_YOU')
    expect(clientStatusOf({ status: 'PENDING_REVIEW', ...quoted })).toBe('AWAITING_YOU')
    expect(clientStatusOf({ status: 'IN_PROGRESS', ...quoted })).toBe('AWAITING_YOU')
  })

  it('stops waiting once the client has answered', () => {
    const answered = {
      quotedAt: new Date('2026-08-01'),
      clientDecision: 'APPROVED',
      clientDecisionAt: new Date('2026-08-02'),
    }

    expect(clientStatusOf({ status: 'IN_PROGRESS', ...answered })).toBe('IN_PROGRESS')
    expect(clientStatusOf({ status: 'RESOLVED', ...answered })).toBe('DONE')
  })

  it('shows the client their own decline rather than pretending it never happened', () => {
    expect(
      clientStatusOf({
        status: 'OPEN',
        quotedAt: new Date('2026-08-01'),
        clientDecision: 'DECLINED',
        clientDecisionAt: new Date('2026-08-02'),
      }),
    ).toBe('DECLINED')
  })

  it('never lets a dismissal leak through the quote branch', () => {
    expect(
      clientStatusOf({
        status: 'DISMISSED',
        quotedAt: new Date('2026-08-01'),
        clientDecision: null,
        clientDecisionAt: null,
      }),
    ).toBeNull()
  })

  it('keeps DISMISSED out of the visible list', () => {
    expect(CLIENT_VISIBLE_STATUSES).not.toContain('DISMISSED')
  })

  it('knows when the ball is in the client court', () => {
    expect(isAwaitingClient({ status: 'OPEN', ...NO_QUOTE })).toBe(false)
    expect(
      isAwaitingClient({
        status: 'OPEN',
        quotedAt: new Date(),
        clientDecision: null,
        clientDecisionAt: null,
      }),
    ).toBe(true)
  })
})

describe('the field whitelist', () => {
  /** Every internal column, including the ones that must never travel. */
  const FULL_ROW = {
    id: 'req-1',
    title: 'לוגו שגוי',
    description: 'תיאור',
    type: 'BUG',
    status: 'OPEN',
    createdAt: new Date('2026-08-01'),
    resolvedAt: null,
    attachments: ['client-1/a.png', 'client-1/b.png'],
    billingKind: 'BILLABLE',
    estimateHours: 3,
    quotedPrice: 1200,
    quotedAt: new Date('2026-08-05'),
    clientDecision: null,
    clientDecisionAt: null,
    project: { id: 'proj-1', name: 'האתר' },
  }

  it('emits the fields the portal needs', () => {
    const view = toClientRequest(FULL_ROW)!

    expect(view).toMatchObject({
      id: 'req-1',
      title: 'לוגו שגוי',
      clientStatus: 'AWAITING_YOU',
      projectName: 'האתר',
      billingKind: 'BILLABLE',
      estimateHours: 3,
      quotedPrice: 1200,
      awaitingDecision: true,
      attachmentCount: 2,
    })
  })

  it('never emits anything internal', () => {
    const view = toClientRequest({
      ...FULL_ROW,
      // Fields a future refactor might add to the select by accident.
      ...({ aiNote: 'ניחוש', aiConfidence: 0.4, isAiGenerated: true, taskId: 't-1', userId: 'u-1' } as Record<
        string,
        unknown
      >),
    } as Parameters<typeof toClientRequest>[0])!

    for (const forbidden of ['aiNote', 'aiConfidence', 'isAiGenerated', 'taskId', 'userId', 'status']) {
      expect(Object.keys(view)).not.toContain(forbidden)
    }
  })

  it('publishes a count, never the storage paths', () => {
    // Attachment paths embed the client id. The portal exposes how many files
    // there are and nothing about where they live.
    const view = toClientRequest(FULL_ROW)!

    expect(view.attachmentCount).toBe(2)
    expect(JSON.stringify(view)).not.toContain('client-1/a.png')
  })

  it('drops a request the client may not see', () => {
    expect(toClientRequest({ ...FULL_ROW, status: 'DISMISSED' })).toBeNull()
  })

  it('turns Prisma decimals into numbers the UI can format', () => {
    const view = toClientRequest({ ...FULL_ROW, quotedPrice: '1200.00', estimateHours: '3.50' })!

    expect(view.quotedPrice).toBe(1200)
    expect(view.estimateHours).toBe(3.5)
  })
})
