import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Everything the client hears when Itay acts on their request.
 *
 * Both the dashboard routes and the owner agent's WhatsApp tools come through
 * RequestsService, so the service is tested directly rather than through either
 * caller: approve() for the approval notice, update() for the progress ones.
 */

const requests = new Map<string, Record<string, unknown>>()

function defined(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

const prismaMock = {
  request: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; userId?: string } }) => {
      const row = requests.get(where.id)
      if (!row) return null
      if (where.userId && row.userId !== where.userId) return null
      return row
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => requests.get(where.id) ?? null),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      // Prisma ignores undefined fields; the mock must too, or a partial update
      // would blank out everything it did not mention.
      const row = { ...(requests.get(where.id) ?? {}), ...defined(data) }
      requests.set(where.id, row)
      return row
    }),
    updateMany: vi.fn(),
  },
  task: { create: vi.fn(), delete: vi.fn() },
  project: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}

const wahaMock = { sendMessage: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/storage.service', () => ({
  StorageService: { removeAttachments: vi.fn() },
}))

const { RequestsService } = await import('@/lib/services/requests.service')

const BASE_REQUEST = {
  id: 'request-1',
  userId: 'user-1',
  title: 'תיקון כפתור בעמוד הבית',
  description: 'הכפתור לא מגיב',
  status: 'PENDING_REVIEW',
  priority: 'HIGH',
  projectId: 'project-1',
  taskId: null,
  resolvedAt: null,
}

const SUPPORT_SOURCE = { sessionName: 'bot', rawChatId: 'client-chat@lid' }
const PERSONAL_SOURCE = { sessionName: 'personal', rawChatId: '972521234567@c.us' }

function seedRequest(overrides: Record<string, unknown> = {}) {
  requests.clear()
  requests.set('request-1', {
    ...BASE_REQUEST,
    sourceMessage: SUPPORT_SOURCE,
    contact: { name: 'עדן בן חמו' },
    ...overrides,
  })
}

function sentText() {
  return (wahaMock.sendMessage.mock.calls[0][0] as { chatId: string; text: string }).text
}

describe('approving a request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedRequest()
    prismaMock.task.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }))
    prismaMock.request.updateMany.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = requests.get(where.id)
        if (!row || row.taskId) return { count: 0 }
        requests.set(where.id, { ...row, ...data })
        return { count: 1 }
      }
    )
    wahaMock.sendMessage.mockResolvedValue(undefined)
  })

  it('creates a linked client-work task that inherits the request fields', async () => {
    const result = await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: {
        title: 'תיקון כפתור בעמוד הבית',
        description: 'הכפתור לא מגיב',
        priority: 'HIGH',
        category: 'CLIENT_WORK',
        projectId: 'project-1',
        userId: 'user-1',
      },
    })
    expect(result.taskId).toBe('task-1')
    expect(requests.get('request-1')).toMatchObject({ status: 'OPEN', taskId: 'task-1' })
  })

  it('tells a client who asked through the support agent', async () => {
    await RequestsService.approve('user-1', 'request-1')

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    const message = wahaMock.sendMessage.mock.calls[0][0] as { chatId: string; text: string }
    expect(message.chatId).toBe('client-chat@lid')
    expect(message.text).toContain('אושרה')
    expect(message.text).toContain('תיקון כפתור בעמוד הבית')
  })

  it('creates the task but says nothing for a batch-extracted request', async () => {
    seedRequest({ sourceMessage: PERSONAL_SOURCE })

    await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('says nothing for a request with no source message at all', async () => {
    seedRequest({ sourceMessage: null })

    await RequestsService.approve('user-1', 'request-1')

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('does not create a second task when approved again', async () => {
    await RequestsService.approve('user-1', 'request-1')
    prismaMock.task.create.mockClear()

    await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.create).not.toHaveBeenCalled()
    expect(requests.get('request-1')).toMatchObject({ taskId: 'task-1' })
  })

  it('tells the client once, however many times approve is pressed', async () => {
    await RequestsService.approve('user-1', 'request-1')
    await RequestsService.approve('user-1', 'request-1')

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('does not drag an in-progress request back to open', async () => {
    seedRequest({ status: 'IN_PROGRESS', taskId: 'task-1' })

    const result = await RequestsService.approve('user-1', 'request-1')

    expect(result.status).toBe('IN_PROGRESS')
    expect(prismaMock.task.create).not.toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('drops the task it just made if another approval won the link', async () => {
    prismaMock.request.updateMany.mockResolvedValue({ count: 0 })

    const result = await RequestsService.approve('user-1', 'request-1')

    expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } })
    expect(result.taskId).toBeNull()
  })

  it('still approves when the client message cannot be delivered', async () => {
    wahaMock.sendMessage.mockRejectedValue(new Error('waha down'))

    const result = await RequestsService.approve('user-1', 'request-1')

    expect(result.status).toBe('OPEN')
    expect(requests.get('request-1')).toMatchObject({ taskId: 'task-1' })
  })
})

describe('telling the client how their request is going', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedRequest({ status: 'OPEN', taskId: 'task-1' })
    wahaMock.sendMessage.mockResolvedValue(undefined)
  })

  it('tells the client by name when Itay picks the request up', async () => {
    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    const message = wahaMock.sendMessage.mock.calls[0][0] as { chatId: string; text: string }
    expect(message.chatId).toBe('client-chat@lid')
    // First name only: the bot is not reading her a form.
    expect(message.text).toContain('היי עדן')
    expect(message.text).not.toContain('בן חמו')
    expect(message.text).toContain('התחלתי לטפל')
    expect(message.text).toContain('תיקון כפתור בעמוד הבית')
  })

  it('tells the client when the request is done', async () => {
    seedRequest({ status: 'IN_PROGRESS', taskId: 'task-1' })

    await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    expect(sentText()).toContain('סיימתי לטפל')
    expect(sentText()).toContain('תיקון כפתור בעמוד הבית')
  })

  it('says nothing when the status is set to what it already was', async () => {
    seedRequest({ status: 'IN_PROGRESS', taskId: 'task-1' })

    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('says nothing when the edit never mentions the status', async () => {
    await RequestsService.update('user-1', 'request-1', { title: 'כותרת מתוקנת' })

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('stays silent on the statuses the client has no business hearing about', async () => {
    seedRequest({ status: 'IN_PROGRESS', taskId: 'task-1' })
    await RequestsService.update('user-1', 'request-1', { status: 'OPEN' })

    seedRequest({ status: 'OPEN', taskId: 'task-1' })
    await RequestsService.update('user-1', 'request-1', { status: 'DISMISSED' })

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('says nothing to a client who never spoke to the bot', async () => {
    seedRequest({ status: 'OPEN', taskId: 'task-1', sourceMessage: PERSONAL_SOURCE })

    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
    expect(requests.get('request-1')).toMatchObject({ status: 'IN_PROGRESS' })
  })

  it('greets a request with no contact on it without a dangling name', async () => {
    seedRequest({ status: 'OPEN', taskId: 'task-1', contact: null })

    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(sentText()).toContain('היי,')
    expect(sentText()).toContain('התחלתי לטפל')
  })

  it('still records the status when WhatsApp is down', async () => {
    wahaMock.sendMessage.mockRejectedValue(new Error('waha down'))

    const result = await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(result.status).toBe('IN_PROGRESS')
    expect(requests.get('request-1')).toMatchObject({ status: 'IN_PROGRESS' })
  })

  it('says it once per real transition, and again only if the work reopens', async () => {
    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })
    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })
    await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })
    await RequestsService.update('user-1', 'request-1', { status: 'RESOLVED' })
    // Reopened: the client was told it was done, so they are owed the correction.
    await RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(3)
  })

  it('does not announce work on a draft nobody approved', async () => {
    seedRequest({ status: 'PENDING_REVIEW' })

    await expect(
      RequestsService.update('user-1', 'request-1', { status: 'IN_PROGRESS' })
    ).rejects.toThrow('יש לאשר את הבקשה')

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })
})

describe('dismissing a request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedRequest()
  })

  it('stays silent toward the client and creates no task', async () => {
    await RequestsService.dismiss('user-1', 'request-1')

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
    expect(prismaMock.task.create).not.toHaveBeenCalled()
    expect(requests.get('request-1')).toMatchObject({ status: 'DISMISSED' })
  })
})
