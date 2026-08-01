import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The brief's job is to be worth reading.
 *
 * Two things it used to get wrong. Staleness was inferred from lastContactedAt,
 * which only the WhatsApp webhooks write, so a lead rung on the phone looked
 * abandoned and a lead with a meeting booked got nagged about anyway. And every
 * section was reported even when empty, so a quiet day handed the model eleven
 * "אין" lines and asked it to write something motivating about them.
 */

const prismaMock = {
  task: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  contact: { findMany: vi.fn() },
  project: { findMany: vi.fn() },
  request: { findMany: vi.fn(), count: vi.fn() },
}

const generateText = vi.fn()

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('ai', () => ({ generateText: (...args: unknown[]) => generateText(...args) }))
vi.mock('@ai-sdk/gateway', () => ({
  gateway: (id: string) => id,
  GatewayError: { isInstance: () => false },
}))

const { MorningBriefService } = await import('@/lib/services/morning-brief.service')

type Where = Record<string, unknown>

/**
 * Finds a query by the shape of its `where` rather than by call order. The
 * previous version indexed into mock.calls positionally, so removing one query
 * silently repointed every assertion at the wrong one.
 */
function contactQuery(match: (where: Where) => boolean): { where: Where; orderBy?: unknown } {
  const call = prismaMock.contact.findMany.mock.calls.find(([args]) => match(args?.where ?? {}))
  if (!call) throw new Error('no contact.findMany call matched')
  return call[0]
}

const isDueActions = (w: Where) => typeof w.nextActionAt === 'object' && w.nextActionAt !== null
const isStaleLeads = (w: Where) => w.nextActionAt === null
const isNewLeads = (w: Where) => 'createdAt' in w && !('nextActionAt' in w)

function promptText(): string {
  return generateText.mock.calls[0][0].prompt as string
}

function systemText(): string {
  return generateText.mock.calls[0][0].system as string
}

/** Everything empty: the shape of a genuinely quiet day. */
function quietDay() {
  prismaMock.task.findMany.mockResolvedValue([])
  prismaMock.task.groupBy.mockResolvedValue([])
  prismaMock.task.count.mockResolvedValue(0)
  prismaMock.project.findMany.mockResolvedValue([])
  prismaMock.request.findMany.mockResolvedValue([])
  prismaMock.request.count.mockResolvedValue(0)
  prismaMock.contact.findMany.mockResolvedValue([])
  generateText.mockResolvedValue({ text: 'בוקר טוב!' })
}

describe('next actions drive the brief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('asks only for leads with an action due by the end of today', async () => {
    await MorningBriefService.generateBrief('user-1')

    const { where, orderBy } = contactQuery(isDueActions)
    expect(where.status).toEqual({ in: ['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'QUOTED'] })
    expect((where.nextActionAt as { lt: Date }).lt).toBeInstanceOf(Date)
    expect(orderBy).toEqual({ nextActionAt: 'asc' })
  })

  it('exempts a lead with a scheduled action from the stale list', async () => {
    await MorningBriefService.generateBrief('user-1')

    expect(contactQuery(isStaleLeads).where.nextActionAt).toBeNull()
  })

  it('renders due actions with their note, date and overdue marker', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    prismaMock.contact.findMany.mockImplementation((args: { where?: Where }) =>
      Promise.resolve(
        isDueActions(args?.where ?? {})
          ? [
              {
                name: 'ליד שלישי',
                phone: '0501234567',
                status: 'MEETING_SCHEDULED',
                nextActionAt: yesterday,
                nextActionNote: 'לשלוח הצעת מחיר',
              },
            ]
          : []
      )
    )

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('פעולות להיום (1)')
    expect(prompt).toContain('לשלוח הצעת מחיר')
    expect(prompt).toContain('[באיחור]')
    expect(prompt).toContain('נקבעה פגישת אפיון')
  })
})

describe('the stale-clients section is gone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('never queries client-status contacts for staleness', async () => {
    await MorningBriefService.generateBrief('user-1')

    // It judged clients on lastContactedAt, which only the WhatsApp webhooks
    // write, so it flagged nearly every client every single day.
    const clientStatusQuery = prismaMock.contact.findMany.mock.calls.find(
      ([args]) => args?.where?.status === 'CLIENT'
    )
    expect(clientStatusQuery).toBeUndefined()
  })

  it('does not mention stale clients in the prompt', async () => {
    await MorningBriefService.generateBrief('user-1')

    expect(promptText()).not.toContain('לקוחות ללא קשר')
  })
})

describe('empty sections are omitted, not reported', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('says the day is clear once instead of listing every empty section', async () => {
    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('אין משימות פתוחות')
    // The old template printed "(0):\nאין" for every section in turn.
    expect(prompt).not.toContain('(0)')
    expect(prompt).not.toContain('משימות באיחור')
  })

  it('includes a section with content, with its real count', async () => {
    prismaMock.contact.findMany.mockImplementation((args: { where?: Where }) =>
      Promise.resolve(
        isStaleLeads(args?.where ?? {})
          ? [
              { name: 'ליד ראשון', status: 'NEW', lastContactedAt: null, createdAt: new Date(0) },
              { name: 'ליד שני', status: 'QUOTED', lastContactedAt: null, createdAt: new Date(0) },
            ]
          : []
      )
    )

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('ללא קשר 3+ ימים (2)')
    expect(prompt).toContain('ליד ראשון')
    expect(prompt).not.toContain('אין משימות פתוחות')
  })

  it('tells the model that an absent section means nothing to report', async () => {
    await MorningBriefService.generateBrief('user-1')

    expect(systemText()).toContain('A section that is absent means there is nothing there')
  })
})

describe('no English enum values reach the prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('translates task priority and lead source', async () => {
    prismaMock.task.findMany.mockImplementation((args: { where?: { dueDate?: { lt?: Date } } }) =>
      Promise.resolve(
        args?.where?.dueDate?.lt
          ? [{ title: 'לתקן באג', priority: 'HIGH', dueDate: new Date(0), project: null }]
          : []
      )
    )
    prismaMock.contact.findMany.mockImplementation((args: { where?: Where }) =>
      Promise.resolve(
        isNewLeads(args?.where ?? {})
          ? [{ name: 'ליד חדש', phone: '0501112222', source: 'WEBSITE' }]
          : []
      )
    )

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('גבוה')
    expect(prompt).toContain('אתר')
    expect(prompt).not.toContain('HIGH')
    expect(prompt).not.toContain('WEBSITE')
  })

  it('translates task categories', async () => {
    prismaMock.task.groupBy.mockResolvedValue([{ category: 'CLIENT_WORK', _count: 3 }])

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('עבודת לקוח: 3')
    expect(prompt).not.toContain('CLIENT_WORK')
  })
})

describe('requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('includes work already promised, not only what awaits a decision', async () => {
    prismaMock.request.findMany.mockImplementation((args: { where?: { status?: unknown } }) => {
      const status = args?.where?.status
      if (typeof status === 'object' && status !== null) {
        return Promise.resolve([
          {
            type: 'BUG',
            title: 'הטופס לא נשלח',
            status: 'IN_PROGRESS',
            client: { name: 'גן עדן' },
            project: { name: 'אתר' },
          },
        ])
      }
      return Promise.resolve([])
    })
    prismaMock.request.count.mockImplementation((args: { where?: { status?: unknown } }) =>
      Promise.resolve(typeof args?.where?.status === 'object' ? 1 : 0)
    )

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    expect(prompt).toContain('פניות פתוחות (1)')
    expect(prompt).toContain('הטופס לא נשלח')
    expect(prompt).toContain('בטיפול')
    expect(prompt).not.toContain('IN_PROGRESS')
  })

  it('discloses how much a capped list is hiding', async () => {
    // Nine pending, but the query only fetches LIST_CAP (8) of them.
    const rows = Array.from({ length: 8 }, (_, i) => ({
      type: 'REQUEST',
      title: `פנייה ${i + 1}`,
      status: 'PENDING_REVIEW',
      client: { name: 'לקוח' },
      contact: null,
    }))
    prismaMock.request.findMany.mockImplementation((args: { where?: { status?: unknown } }) =>
      Promise.resolve(args?.where?.status === 'PENDING_REVIEW' ? rows : [])
    )
    prismaMock.request.count.mockImplementation((args: { where?: { status?: unknown } }) =>
      Promise.resolve(args?.where?.status === 'PENDING_REVIEW' ? 9 : 0)
    )

    await MorningBriefService.generateBrief('user-1')

    const prompt = promptText()
    // The count is the honest total, and the trim is stated rather than silent.
    expect(prompt).toContain('פניות ממתינות לאישור (9)')
    expect(prompt).toContain('ועוד 1')
  })
})

describe('date windows follow the Israel day boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  it('starts the new-leads window on a midnight, not on the cron time', async () => {
    await MorningBriefService.generateBrief('user-1')

    const { where } = contactQuery(isNewLeads)
    const from = (where.createdAt as { gte: Date }).gte
    // Israel midnight is 21:00 or 22:00 UTC the day before, so a day-aligned
    // boundary lands on an exact hour with no minutes or seconds.
    expect(from.getUTCMinutes()).toBe(0)
    expect(from.getUTCSeconds()).toBe(0)
    expect(from.getUTCMilliseconds()).toBe(0)
  })
})

describe('the brief prefers the local model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quietDay()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runs on Ollama when configured, and falls back to the gateway when it fails', async () => {
    vi.stubEnv('OLLAMA_BASE_URL', 'https://ollama.example.com/v1')
    vi.stubEnv('OLLAMA_API_KEY', 'test-key')
    generateText.mockRejectedValueOnce(new Error('vps down'))

    const brief = await MorningBriefService.generateBrief('user-1')

    expect(brief).toBe('בוקר טוב!')
    expect(generateText).toHaveBeenCalledTimes(2)
    const [local] = generateText.mock.calls[0]
    const [viaGateway] = generateText.mock.calls[1]
    // Same brief either way: identical instructions and data on both tiers.
    expect(viaGateway.model).toBe('anthropic/claude-sonnet-4.6')
    expect(local.system).toBe(viaGateway.system)
    expect(local.prompt).toBe(viaGateway.prompt)
    expect(local.maxOutputTokens).toBe(1024)
    expect(local.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('goes straight to the gateway when Ollama is not configured', async () => {
    await MorningBriefService.generateBrief('user-1')

    expect(generateText).toHaveBeenCalledTimes(1)
    expect(generateText.mock.calls[0][0].model).toBe('anthropic/claude-sonnet-4.6')
  })
})
