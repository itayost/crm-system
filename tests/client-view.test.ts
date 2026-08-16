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

const {
  clientStatusOf,
  isAwaitingClient,
  toClientRequest,
  CLIENT_VISIBLE_STATUSES,
  clientPhaseStatusOf,
  toClientProject,
} = await import('@/lib/services/client-view')

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

describe('what a client is told about a billing phase', () => {
  const phase = (status: string, paidAt: Date | null = null) => clientPhaseStatusOf({ status, paidAt })

  it('does not call a quote-approved phase finished', () => {
    // The trap this exists for: a phase created when the client approves a
    // quote is born NOT_STARTED. Showing the raw enum would be one thing; the
    // real risk is anything that reads "approved" back to them as done.
    expect(phase('NOT_STARTED')).toBe('SCHEDULED')
  })

  it('says work is under way', () => {
    expect(phase('IN_PROGRESS')).toBe('IN_PROGRESS')
  })

  it('puts the ball back in their court when it is there', () => {
    expect(phase('PENDING_APPROVAL')).toBe('AWAITING_YOU')
    expect(phase('REVISIONS')).toBe('AWAITING_YOU')
  })

  it('calls signed-off work done', () => {
    expect(phase('APPROVED')).toBe('DONE')
  })

  it('lets payment outrank everything', () => {
    // A paid phase is settled whatever its work status says.
    expect(phase('APPROVED', new Date())).toBe('PAID')
    expect(phase('NOT_STARTED', new Date())).toBe('PAID')
  })
})

describe('the project whitelist', () => {
  const row = {
    id: 'p1',
    name: 'אימונים לגיל השלישי',
    description: 'תיאור',
    status: 'ACTIVE',
    deadline: null,
    completedAt: null,
    advanceAmount: 0,
    advancePaidAt: null,
    phases: [
      { id: 'ph1', name: 'פיתוח', status: 'APPROVED', price: 7000, approvedAt: new Date(), paidAt: null },
      { id: 'ph2', name: 'הרחבה', status: 'NOT_STARTED', price: 1200, approvedAt: null, paidAt: null },
    ],
  }

  it('sums the ledger the way the dashboard does', () => {
    const view = toClientProject(row)

    expect(view.total).toBe(8200)
    expect(view.paid).toBe(0)
    // Only signed-off work is owed. The 1,200 phase is agreed but not delivered,
    // so a client must not open this and read that they owe for it.
    expect(view.outstanding).toBe(7000)
  })

  it('never emits an internal field', () => {
    const view = toClientProject({
      ...row,
      ...({ userId: 'u-1', agentConfig: { x: 1 }, productCard: { cardHe: 'סודי' } } as Record<
        string,
        unknown
      >),
    } as Parameters<typeof toClientProject>[0])

    for (const forbidden of ['userId', 'agentConfig', 'productCard', 'advanceAmount']) {
      expect(Object.keys(view)).not.toContain(forbidden)
    }
    expect(JSON.stringify(view)).not.toContain('סודי')
  })

  it('softens every phase status on the way out', () => {
    const view = toClientProject(row)

    expect(view.phases.map((p) => p.status)).toEqual(['DONE', 'SCHEDULED'])
    expect(JSON.stringify(view)).not.toContain('NOT_STARTED')
  })
})
