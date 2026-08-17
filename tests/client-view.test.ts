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
  buildClientTimeline,
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

/* -------------------------------------------------------------------------
 * Everything below was already stored and shown to the client nowhere.
 * ---------------------------------------------------------------------- */

const BASE_ROW = {
  id: 'req-1',
  title: 'לוגו שגוי',
  description: 'תיאור',
  type: 'BUG',
  status: 'OPEN' as string,
  createdAt: new Date('2026-08-01'),
  resolvedAt: null as Date | null,
  attachments: [] as string[],
  billingKind: 'BILLABLE',
  estimateHours: 3,
  quotedPrice: 1200,
  quotedAt: null as Date | null,
  clientDecision: null as string | null,
  clientDecisionAt: null as Date | null,
  clientDecisionNote: null as string | null,
  intake: null as unknown,
  project: { id: 'proj-1', name: 'האתר' },
}

describe('attachments a client can tell apart', () => {
  it('names the file and its kind, and still never publishes the path', () => {
    const view = toClientRequest({
      ...BASE_ROW,
      attachments: ['cl_abc123/9f8e-uuid/screenshot.png', 'cl_abc123/1a2b-uuid/quote.PDF'],
    })!

    expect(view.attachments).toEqual([
      { index: 0, name: 'screenshot.png', kind: 'PNG' },
      { index: 1, name: 'quote.PDF', kind: 'PDF' },
    ])

    // The client id is the thing the path leaks, and the bucket is shared with
    // WhatsApp support media, so it must not survive the DTO boundary.
    const json = JSON.stringify(view)
    expect(json).not.toContain('cl_abc123')
    expect(json).not.toContain('9f8e-uuid')
  })

  it('reports no name when sanitising left nothing readable', () => {
    // sanitizeName() strips everything outside [A-Za-z0-9._-], so a Hebrew
    // filename arrives as underscores. "____.png" is a worse label than none.
    const view = toClientRequest({
      ...BASE_ROW,
      attachments: ['cl_abc123/uuid/____.png'],
    })!

    expect(view.attachments).toEqual([{ index: 0, name: null, kind: 'PNG' }])
  })

  it('keeps the count in step with the list', () => {
    const view = toClientRequest({ ...BASE_ROW, attachments: ['a/b/one.png', 'a/b/two.pdf'] })!

    expect(view.attachmentCount).toBe(view.attachments.length)
  })
})

describe('the intake, played back to whoever answered it', () => {
  const INTAKE = {
    where: 'בתפריט העליון',
    whatHappened: 'נסגר מיד',
    expected: 'שיישאר פתוח',
    frequency: 'ALWAYS',
    workedBefore: false,
    blocking: true,
    goal: null,
    today: null,
    suggestedType: 'BUG',
  }

  it('never emits the agent’s guess at the ticket type', () => {
    // suggestedType is documented in the schema as a hint for Itay only. The
    // client was never asked, so showing it back as if it were their answer
    // would misrepresent the conversation they just had.
    const view = toClientRequest({ ...BASE_ROW, intake: INTAKE })!

    expect(view.intake.map((a) => a.field)).not.toContain('suggestedType')
    expect(JSON.stringify(view.intake)).not.toContain('BUG')
  })

  it('renders enums and booleans as Hebrew, not as raw values', () => {
    const view = toClientRequest({ ...BASE_ROW, intake: INTAKE })!
    const byField = Object.fromEntries(view.intake.map((a) => [a.field, a.value]))

    expect(byField.frequency).toBe('תמיד')
    expect(byField.workedBefore).toBe('לא')
    expect(byField.blocking).toBe('כן')
    expect(byField.where).toBe('בתפריט העליון')
  })

  it('skips what was never answered, rather than showing empty rows', () => {
    const view = toClientRequest({ ...BASE_ROW, intake: INTAKE })!

    expect(view.intake.map((a) => a.field)).not.toContain('goal')
    expect(view.intake.map((a) => a.field)).not.toContain('today')
  })

  it('survives a stored shape that no longer parses', () => {
    const view = toClientRequest({ ...BASE_ROW, intake: { where: 42, nonsense: true } })!

    expect(view.intake).toEqual([])
  })

  it('is empty, not absent, when the bot never ran', () => {
    expect(toClientRequest(BASE_ROW)!.intake).toEqual([])
  })
})

describe('the client’s own decline note', () => {
  const DECLINED = {
    ...BASE_ROW,
    quotedAt: new Date('2026-08-05'),
    clientDecision: 'DECLINED',
    clientDecisionAt: new Date('2026-08-06'),
    clientDecisionNote: 'המחיר גבוה מדי לרבעון הזה',
  }

  it('reads back to the person who wrote it', () => {
    expect(toClientRequest(DECLINED)!.declineNote).toBe('המחיר גבוה מדי לרבעון הזה')
  })

  it('does not surface on an approval', () => {
    // sendQuote() resets the note on a re-quote, but a stale one must not ride
    // along on a request the client went on to approve.
    const approved = { ...DECLINED, clientDecision: 'APPROVED' }

    expect(toClientRequest(approved)!.declineNote).toBeNull()
  })
})

describe('the timeline a client is shown', () => {
  const dated = (events: ReturnType<typeof buildClientTimeline>) =>
    events.filter((e) => e.state === 'done').map((e) => e.label)

  it('speaks in the second person, never about "the client"', () => {
    const view = toClientRequest({
      ...BASE_ROW,
      quotedAt: new Date('2026-08-05'),
      clientDecision: 'APPROVED',
      clientDecisionAt: new Date('2026-08-06'),
      status: 'IN_PROGRESS',
    })!

    const events = buildClientTimeline(view)

    expect(dated(events)).toEqual(['הפנייה נפתחה', 'נשלחה אליך הצעת מחיר', 'אישרת את ההצעה'])
    expect(JSON.stringify(events)).not.toContain('הלקוח')
    expect(JSON.stringify(events)).not.toContain('משימה')
  })

  it('leaves the current step undated, because no column records when it began', () => {
    // Request has no startedAt. Stamping "work started" with updatedAt would be
    // a guess presented to a paying customer as a fact.
    const view = toClientRequest({ ...BASE_ROW, status: 'IN_PROGRESS' })!
    const now = buildClientTimeline(view).find((e) => e.state === 'now')!

    expect(now.label).toBe('בפיתוח')
    expect(now.at).toBeNull()
  })

  it('shows the shape of what is left', () => {
    const view = toClientRequest({ ...BASE_ROW, status: 'IN_PROGRESS' })!
    const ahead = buildClientTimeline(view).filter((e) => e.state === 'ahead')

    expect(ahead.map((e) => e.label)).toEqual(['נמסר לבדיקה שלך'])
    expect(ahead.every((e) => e.at === null)).toBe(true)
  })

  it('stops at the end rather than promising more', () => {
    const view = toClientRequest({
      ...BASE_ROW,
      status: 'RESOLVED',
      resolvedAt: new Date('2026-08-09'),
    })!
    const events = buildClientTimeline(view)

    expect(events.some((e) => e.state === 'ahead')).toBe(false)
    expect(events.some((e) => e.state === 'now')).toBe(false)
    expect(events.at(-1)!.label).toBe('הושלם')
  })

  it('carries the decline note onto the event that explains it', () => {
    const view = toClientRequest({
      ...BASE_ROW,
      quotedAt: new Date('2026-08-05'),
      clientDecision: 'DECLINED',
      clientDecisionAt: new Date('2026-08-06'),
      clientDecisionNote: 'נדבר על זה ברבעון הבא',
    })!
    const decided = buildClientTimeline(view).find((e) => e.key === 'decided')!

    expect(decided.label).toBe('לא אישרת את ההצעה')
    expect(decided.note).toBe('נדבר על זה ברבעון הבא')
  })
})

describe('the ledger reconciles', () => {
  const project = (phases: Array<Record<string, unknown>>, advance = 0, advancePaidAt: Date | null = null) =>
    toClientProject({
      id: 'p1',
      name: 'פרויקט',
      description: null,
      status: 'ACTIVE',
      deadline: null,
      completedAt: null,
      advanceAmount: advance,
      advancePaidAt,
      phases: phases as Parameters<typeof toClientProject>[0]['phases'],
    })

  it('splits the total into paid, owed and not yet earned', () => {
    const view = project(
      [
        { id: 'a', name: 'שלב א', status: 'APPROVED', price: 3000, approvedAt: new Date(), paidAt: new Date() },
        { id: 'b', name: 'שלב ב', status: 'APPROVED', price: 2000, approvedAt: new Date(), paidAt: null },
        { id: 'c', name: 'שלב ג', status: 'IN_PROGRESS', price: 1500, approvedAt: null, paidAt: null },
      ],
      1000,
      new Date(),
    )

    expect(view.total).toBe(7500)
    expect(view.paid).toBe(4000)
    expect(view.outstanding).toBe(2000)
    expect(view.notYetDue).toBe(1500)
    // The whole point of the fourth figure: the three must account for the total.
    expect(view.paid + view.outstanding + view.notYetDue).toBe(view.total)
  })

  it('never shows a negative when work was paid before it was signed off', () => {
    // Paying an advance and a phase up front is normal, and it makes
    // total - paid - outstanding go under zero. No client can read that.
    const view = project([
      { id: 'a', name: 'שלב א', status: 'NOT_STARTED', price: 500, approvedAt: null, paidAt: new Date() },
    ])

    expect(view.notYetDue).toBe(0)
  })

  it('dates the phases the rail has to prove happened', () => {
    const paidAt = new Date('2026-07-09')
    const view = project([
      { id: 'a', name: 'שלב א', status: 'APPROVED', price: 500, approvedAt: new Date('2026-07-04'), paidAt },
    ])

    expect(view.phases[0].paidAt).toBe(paidAt.toISOString())
    expect(view.phases[0].approvedAt).toBe(new Date('2026-07-04').toISOString())
  })
})
