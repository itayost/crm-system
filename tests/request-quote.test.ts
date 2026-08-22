import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The commercial gate: pricing a request, the client's answer, and the billing
 * phase an approval becomes.
 *
 * Mirrors tests/request-approval.test.ts - a Map-backed prisma mock with the
 * same `defined()` helper, WAHA stubbed, service imported dynamically after the
 * mocks are registered.
 */

const requests = new Map<string, Record<string, unknown>>()
const phases = new Map<string, Record<string, unknown>>()

function defined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

/** Matches `where: { id, client: { formToken } }` the way the portal queries. */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>) {
  if (where.id && row.id !== where.id) return false
  if (where.userId && row.userId !== where.userId) return false
  const client = where.client as { formToken?: string } | undefined
  if (client?.formToken && (row.client as { formToken?: string })?.formToken !== client.formToken) {
    return false
  }
  return true
}

const prismaMock = {
  request: {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      for (const row of requests.values()) if (matchesWhere(row, where)) return row
      return null
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => requests.get(where.id) ?? null),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...(requests.get(where.id) ?? {}), ...defined(data) }
        requests.set(where.id, row)
        return row
      },
    ),
    updateMany: vi.fn(),
  },
  projectPhase: {
    // Typed loosely on purpose: tests override it with a row to prove the new
    // phase appends after the ones a project already has.
    findFirst: vi.fn(async (): Promise<{ order: number } | null> => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const phase = { id: `phase-${phases.size + 1}`, ...data }
      phases.set(phase.id as string, phase)
      return phase
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      phases.delete(where.id)
      return {}
    }),
  },
  task: { create: vi.fn(), delete: vi.fn() },
  project: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn(async () => null) },
  botConversation: { findFirst: vi.fn(async () => ({ ownerChatId: 'owner@c.us' })) },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}

const wahaMock = { sendMessage: vi.fn(), formatChatId: (phone: string) => `${phone}@c.us` }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/storage.service', () => ({
  StorageService: { removeAttachments: vi.fn() },
}))

// The portal link in the quote message is built from this. Unset, there is no
// origin to build a tappable link from and the notice is not sent at all.
process.env.NEXTAUTH_URL = 'https://crm.example.com'

const { RequestsService } = await import('@/lib/services/requests.service')

const TOKEN = 'form-token-abc'

function seed(overrides: Record<string, unknown> = {}) {
  requests.clear()
  phases.clear()
  requests.set('request-1', {
    id: 'request-1',
    userId: 'user-1',
    title: 'לוגו שגוי בחשבונית',
    description: 'הלוגו הישן מופיע',
    status: 'OPEN',
    priority: 'MEDIUM',
    projectId: 'project-1',
    clientId: 'client-1',
    taskId: null,
    phaseId: null,
    resolvedAt: null,
    billingKind: null,
    estimateHours: null,
    quotedPrice: null,
    quotedAt: null,
    clientDecision: null,
    clientDecisionAt: null,
    clientDecisionNote: null,
    sourceMessage: { sessionName: 'bot', rawChatId: 'client-chat@lid' },
    contact: { name: 'מאי', phone: '0521234567' },
    client: { formToken: TOKEN, name: 'מאי אורנשטיין' },
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seed()
  prismaMock.task.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'task-1',
    ...data,
  }))
  // Claims either the task link or the phase link, whichever the caller asked
  // for, and refuses when that link is already taken - the real conditional.
  prismaMock.request.updateMany.mockImplementation(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = requests.get(where.id as string)
      if (!row) return { count: 0 }
      if ('taskId' in where && row.taskId) return { count: 0 }
      if ('phaseId' in where && row.phaseId) return { count: 0 }
      if ('clientDecisionAt' in where && row.clientDecisionAt) return { count: 0 }
      requests.set(where.id as string, { ...row, ...data })
      return { count: 1 }
    },
  )
  prismaMock.projectPhase.findFirst.mockResolvedValue(null)
  wahaMock.sendMessage.mockResolvedValue(undefined)
})

describe('sending a quote', () => {
  it('refuses a billable request with no price', async () => {
    await expect(
      RequestsService.sendQuote('user-1', 'request-1', { billingKind: 'BILLABLE' }),
    ).rejects.toThrow('בקשה בתשלום חייבת מחיר')
  })

  it('classifies QUOTE_REQUIRED without a price, and sends nothing', async () => {
    // "Chargeable, price unknown" is the honest state of a big unscoped job.
    // Demanding a number here would ask for the one thing the label says you
    // do not have, so the only way to file it would be to invent one.
    await RequestsService.sendQuote('user-1', 'request-1', { billingKind: 'QUOTE_REQUIRED' })

    expect(requests.get('request-1')).toMatchObject({
      billingKind: 'QUOTE_REQUIRED',
      quotedPrice: null,
      quotedAt: null,
    })
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('still withholds the task while a QUOTE_REQUIRED request is unpriced', async () => {
    // Classification is not a free pass: it blocks work exactly like BILLABLE.
    seed({ status: 'PENDING_REVIEW', billingKind: 'QUOTE_REQUIRED' })

    await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).not.toHaveBeenCalled()
    expect(requests.get('request-1')).toMatchObject({ status: 'OPEN', taskId: null })
  })

  it('lets QUOTE_REQUIRED be classified before a project is chosen', async () => {
    // The project is needed when a price lands, not when the job is filed -
    // and an unscoped job usually predates the decision of which project it is.
    seed({ projectId: null })

    await RequestsService.sendQuote('user-1', 'request-1', { billingKind: 'QUOTE_REQUIRED' })

    expect(requests.get('request-1')).toMatchObject({ billingKind: 'QUOTE_REQUIRED' })
  })

  it('refuses a billable request that is not attached to a project', async () => {
    // The phase has nowhere to land. Catching it here, in front of Itay, beats
    // discovering it the moment the client presses approve.
    seed({ projectId: null })

    await expect(
      RequestsService.sendQuote('user-1', 'request-1', {
        billingKind: 'BILLABLE',
        quotedPrice: 1200,
      }),
    ).rejects.toThrow('לא ניתן לשלוח הצעת מחיר לבקשה שלא משויכת לפרויקט')
  })

  it('stamps quotedAt and messages the client for chargeable work', async () => {
    const result = await RequestsService.sendQuote('user-1', 'request-1', {
      billingKind: 'BILLABLE',
      quotedPrice: 1200,
      estimateHours: 3,
    })

    expect(requests.get('request-1')).toMatchObject({
      billingKind: 'BILLABLE',
      quotedPrice: 1200,
      estimateHours: 3,
    })
    expect(requests.get('request-1')!.quotedAt).toBeInstanceOf(Date)
    expect(result.notified).toBe(true)

    const text = (wahaMock.sendMessage.mock.calls[0][0] as { text: string }).text
    expect(text).toContain('1,200')
    expect(text).toContain(`https://crm.example.com/r/${TOKEN}`)
  })

  it('classifies work that costs the client nothing without asking them anything', async () => {
    const result = await RequestsService.sendQuote('user-1', 'request-1', {
      billingKind: 'INCLUDED',
      quotedPrice: 999,
    })

    // No quote goes out, and no price is kept: INCLUDED means the retainer
    // already covers it, so a number here would only be misleading.
    expect(requests.get('request-1')).toMatchObject({
      billingKind: 'INCLUDED',
      quotedAt: null,
      quotedPrice: null,
    })
    expect(result.notified).toBe(false)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('reopens the question when re-quoting after a decline', async () => {
    seed({
      billingKind: 'BILLABLE',
      quotedPrice: 1200,
      quotedAt: new Date('2026-08-01'),
      clientDecision: 'DECLINED',
      clientDecisionAt: new Date('2026-08-02'),
      clientDecisionNote: 'יקר מדי',
    })

    await RequestsService.sendQuote('user-1', 'request-1', {
      billingKind: 'BILLABLE',
      quotedPrice: 900,
    })

    expect(requests.get('request-1')).toMatchObject({
      quotedPrice: 900,
      clientDecision: null,
      clientDecisionAt: null,
      clientDecisionNote: null,
    })
  })

  it('refuses to re-price work the client has already agreed to', async () => {
    seed({
      billingKind: 'BILLABLE',
      quotedPrice: 1200,
      quotedAt: new Date('2026-08-01'),
      clientDecision: 'APPROVED',
      clientDecisionAt: new Date('2026-08-02'),
    })

    await expect(
      RequestsService.sendQuote('user-1', 'request-1', {
        billingKind: 'BILLABLE',
        quotedPrice: 2000,
      }),
    ).rejects.toThrow('הלקוח כבר אישר')
  })

  it('refuses to quote a request that was dismissed', async () => {
    // The portal hides DISMISSED, so this price would be one the client is
    // told about and has no button anywhere to accept.
    seed({ status: 'DISMISSED' })

    await expect(
      RequestsService.sendQuote('user-1', 'request-1', {
        billingKind: 'BILLABLE',
        quotedPrice: 1200,
      }),
    ).rejects.toThrow('בקשה שנדחתה')
  })

  it('refuses to quote a client who has no portal link yet', async () => {
    // formToken is opt-in per client. Without one there is no /r/ page, so the
    // quote could never be answered - the same argument as the project guard.
    seed({ client: { formToken: null, name: 'מאי אורנשטיין' } })

    await expect(
      RequestsService.sendQuote('user-1', 'request-1', {
        billingKind: 'BILLABLE',
        quotedPrice: 1200,
      }),
    ).rejects.toThrow('אין קישור פניות')
  })

  it('reaches a client who never talked to the bot, via their phone', async () => {
    // A request typed into the dashboard or submitted through the portal form
    // has no bot sourceMessage. Without the fallback its quote is undeliverable.
    seed({ sourceMessage: null })

    const result = await RequestsService.sendQuote('user-1', 'request-1', {
      billingKind: 'BILLABLE',
      quotedPrice: 500,
    })

    expect(result.notified).toBe(true)
    expect((wahaMock.sendMessage.mock.calls[0][0] as { chatId: string }).chatId).toBe(
      '0521234567@c.us',
    )
  })

  it('reports that it could not reach a client with no chat and no phone', async () => {
    seed({ sourceMessage: null, contact: null })

    const result = await RequestsService.sendQuote('user-1', 'request-1', {
      billingKind: 'BILLABLE',
      quotedPrice: 500,
    })

    // Saying "sent" here would be a lie, and the dashboard needs to know to
    // offer the portal link instead.
    expect(result.notified).toBe(false)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })
})

/**
 * The other half of the loop. Quotes reached a client with no bot history from
 * the day the fallback landed; "started" and "finished" did not, so a client
 * heard a price and then silence until they opened their link.
 */
describe('progress notices on a request with no bot history', () => {
  const noBotHistory = { sourceMessage: null, status: 'OPEN' }

  it('tells the client work started, via their phone', async () => {
    seed(noBotHistory)

    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    const sent = wahaMock.sendMessage.mock.calls[0][0] as { chatId: string; text: string }
    expect(sent.chatId).toBe('0521234567@c.us')
    expect(sent.text).toContain('התחלתי לטפל')
  })

  it('tells the client it is finished', async () => {
    seed({ ...noBotHistory, status: 'IN_PROGRESS' })

    await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })

    expect((wahaMock.sendMessage.mock.calls[0][0] as { text: string }).text).toContain('סיימתי לטפל')
  })

  it('does not invite a reply into a paused bot, and offers the portal instead', async () => {
    // Every notice goes out from the bot number. Paused, that number discards
    // whatever comes back, so "אני כאן" would be a promise the system breaks.
    const previous = process.env.WHATSAPP_BOT_PAUSED
    process.env.WHATSAPP_BOT_PAUSED = '1'
    seed({ ...noBotHistory, status: 'IN_PROGRESS' })

    try {
      await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })

      const text = (wahaMock.sendMessage.mock.calls[0][0] as { text: string }).text
      expect(text).not.toContain('אני כאן')
      expect(text).toContain(`/r/${TOKEN}`)
    } finally {
      process.env.WHATSAPP_BOT_PAUSED = previous
    }
  })

  it('says "אני כאן" again once the bot is back', async () => {
    const previous = process.env.WHATSAPP_BOT_PAUSED
    process.env.WHATSAPP_BOT_PAUSED = '0'
    seed({ ...noBotHistory, status: 'IN_PROGRESS' })

    try {
      await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })

      expect((wahaMock.sendMessage.mock.calls[0][0] as { text: string }).text).toContain('אני כאן')
    } finally {
      process.env.WHATSAPP_BOT_PAUSED = previous
    }
  })
})

describe('the gate on work', () => {
  it('lets owner triage through but withholds the task until the client agrees', async () => {
    seed({
      status: 'PENDING_REVIEW',
      billingKind: 'BILLABLE',
      quotedPrice: 1200,
      quotedAt: new Date('2026-08-01'),
    })

    const result = await RequestsService.approve('user-1', 'request-1')

    expect(requests.get('request-1')).toMatchObject({ status: 'OPEN', taskId: null })
    expect(prismaMock.task.create).not.toHaveBeenCalled()
    expect(result.taskId).toBeNull()
  })

  it('does not gate a request nobody classified', async () => {
    // billingKind is null on every request written before this shipped. The
    // gate has to be opt-in or it would freeze the whole existing pipeline.
    seed({ status: 'PENDING_REVIEW' })

    await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).toHaveBeenCalledTimes(1)
  })

  it('does not gate work the client is not paying for', async () => {
    seed({ status: 'PENDING_REVIEW', billingKind: 'WARRANTY' })

    await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).toHaveBeenCalledTimes(1)
  })
})

describe('the client answering', () => {
  const quoted = {
    billingKind: 'BILLABLE',
    quotedPrice: 1200,
    quotedAt: new Date('2026-08-01'),
  }

  it('refuses a request that belongs to a different token', async () => {
    seed(quoted)

    await expect(
      RequestsService.recordClientDecision('someone-elses-token', 'request-1', {
        decision: 'APPROVED',
      }),
    ).rejects.toThrow('בקשה לא נמצאה')
  })

  it('refuses an empty token rather than matching a client without one', async () => {
    seed(quoted)

    await expect(
      RequestsService.recordClientDecision('', 'request-1', { decision: 'APPROVED' }),
    ).rejects.toThrow('קישור לא תקין')
  })

  it('refuses a request that was never quoted', async () => {
    seed()

    await expect(
      RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' }),
    ).rejects.toThrow('לא נשלחה הצעת מחיר')
  })

  it('creates one billing phase and one task on approval', async () => {
    seed(quoted)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    expect(phases.size).toBe(1)
    const phase = [...phases.values()][0]
    expect(phase).toMatchObject({
      name: 'לוגו שגוי בחשבונית',
      price: 1200,
      projectId: 'project-1',
      // The client approved the quote, not the work. APPROVED here would put
      // unearned money into the dashboard's "chase this" list.
      status: 'NOT_STARTED',
      order: 1,
    })
    expect(phase.approvedAt).toBeUndefined()
    expect(prismaMock.task.create).toHaveBeenCalledTimes(1)
  })

  it('appends after the phases a project already has', async () => {
    seed(quoted)
    prismaMock.projectPhase.findFirst.mockResolvedValue({ order: 4 })

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    expect([...phases.values()][0]).toMatchObject({ order: 5 })
  })

  it('bills once when a client taps approve twice', async () => {
    seed(quoted)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })
    const second = await RequestsService.recordClientDecision(TOKEN, 'request-1', {
      decision: 'APPROVED',
    })

    expect(second).toMatchObject({ alreadyDecided: true, decision: 'APPROVED' })
    expect(phases.size).toBe(1)
    expect(prismaMock.task.create).toHaveBeenCalledTimes(1)

    // And Itay hears about it once. Two "הלקוח אישר" messages for one approval
    // is exactly the kind of thing that makes him stop trusting the alerts.
    const ownerMessages = wahaMock.sendMessage.mock.calls.filter(
      (call) => (call[0] as { chatId: string }).chatId === 'owner@c.us',
    )
    expect(ownerMessages).toHaveLength(1)
  })

  it('deletes the phase it just built if another approval claimed the link first', async () => {
    seed(quoted)

    // Only the phase claim loses. The decision write must still succeed, or
    // this would be testing the decision race rather than the phase one.
    const real = prismaMock.request.updateMany.getMockImplementation()!
    prismaMock.request.updateMany.mockImplementation(async (args) =>
      'phaseId' in (args.where as Record<string, unknown>) ? { count: 0 } : real(args),
    )

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    expect(prismaMock.projectPhase.delete).toHaveBeenCalledTimes(1)
    expect(phases.size).toBe(0)
  })

  it('does not turn an untriaged draft into work just because the client paid up', async () => {
    // Itay can price a PENDING_REVIEW draft before approving it - that is the
    // documented order. But the client's yes must not skip his review: update()
    // refuses to work a PENDING_REVIEW request, and this path must agree.
    seed({ ...quoted, status: 'PENDING_REVIEW' })

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    expect(requests.get('request-1')).toMatchObject({ clientDecision: 'APPROVED' })
    expect(prismaMock.task.create).not.toHaveBeenCalled()
  })

  it('records a decline with its reason and bills nothing', async () => {
    seed(quoted)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', {
      decision: 'DECLINED',
      note: 'יקר מדי לחודש הזה',
    })

    expect(requests.get('request-1')).toMatchObject({
      clientDecision: 'DECLINED',
      clientDecisionNote: 'יקר מדי לחודש הזה',
    })
    expect(phases.size).toBe(0)
    expect(prismaMock.task.create).not.toHaveBeenCalled()
  })

  it('records the answer even when the project vanished under it', async () => {
    // Request.projectId is onDelete SetNull, so this is reachable. A client who
    // just tapped a button must not see a server error for an owner-side gap.
    seed({ ...quoted, projectId: null })

    const result = await RequestsService.recordClientDecision(TOKEN, 'request-1', {
      decision: 'APPROVED',
    })

    expect(result.alreadyDecided).toBe(false)
    expect(phases.size).toBe(0)
    expect(requests.get('request-1')).toMatchObject({ clientDecision: 'APPROVED' })
  })

  it('tells Itay what the client decided', async () => {
    seed(quoted)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    const owner = wahaMock.sendMessage.mock.calls.find(
      (call) => (call[0] as { chatId: string }).chatId === 'owner@c.us',
    )
    expect(owner).toBeDefined()
    expect((owner![0] as { text: string }).text).toContain('מאי אורנשטיין')
  })
})

/**
 * The gate only bites when billingKind is set before approval. Approve first -
 * which is the ordinary habit, and the state of every request that predates
 * this feature - and the Task already exists by the time a price is discussed.
 * A decline then leaves live work on the list for something nobody is paying
 * for. It is not cancelled automatically; it is raised.
 */
describe('a decline on work that already has a task', () => {
  const quotedWithTask = {
    billingKind: 'BILLABLE',
    quotedPrice: 1200,
    quotedAt: new Date('2026-08-01'),
    taskId: 'task-1',
    task: { id: 'task-1', title: 'לוגו שגוי בחשבונית', status: 'TODO' },
  }

  it('warns Itay that the task is still open, and does not touch it', async () => {
    seed(quotedWithTask)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', {
      decision: 'DECLINED',
      note: 'יקר מדי',
    })

    const owner = wahaMock.sendMessage.mock.calls.find(
      (call) => (call[0] as { chatId: string }).chatId === 'owner@c.us',
    )
    const text = (owner![0] as { text: string }).text

    expect(text).toContain('משימה פתוחה')
    expect(text).toContain('לוגו שגוי בחשבונית')
    expect(text).toContain('לא בוטלה')

    // The decision is Itay's. Nothing here may cancel work he may have started
    // or may be about to re-quote.
    expect(requests.get('request-1')).toMatchObject({ taskId: 'task-1' })
  })

  it('stays quiet about a task that was already dealt with', async () => {
    seed({
      ...quotedWithTask,
      task: { id: 'task-1', title: 'לוגו שגוי בחשבונית', status: 'CANCELLED' },
    })

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'DECLINED' })

    const owner = wahaMock.sendMessage.mock.calls.find(
      (call) => (call[0] as { chatId: string }).chatId === 'owner@c.us',
    )
    expect((owner![0] as { text: string }).text).not.toContain('משימה פתוחה')
  })

  it('says nothing about tasks when the client approves', async () => {
    seed(quotedWithTask)

    await RequestsService.recordClientDecision(TOKEN, 'request-1', { decision: 'APPROVED' })

    const owner = wahaMock.sendMessage.mock.calls.find(
      (call) => (call[0] as { chatId: string }).chatId === 'owner@c.us',
    )
    expect((owner![0] as { text: string }).text).not.toContain('משימה פתוחה')
  })
})
