import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The extraction pass trusts a model to point each drafted request at a real
 * source message. An id it invented violates a foreign key and throws out of the
 * per-client loop, so the batch is never marked processed and the same messages
 * are re-sent to the model on every run, forever.
 */

let extraction: { requests: Array<Record<string, unknown>> }
const generateObjectSpy = vi.fn(async () => ({ object: extraction }))

vi.mock('ai', () => ({
  generateObject: () => generateObjectSpy(),
  tool: <T>(definition: T) => definition,
}))
vi.mock('@ai-sdk/gateway', () => ({ gateway: (id: string) => id }))

const prismaMock = {
  whatsAppMessage: { groupBy: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  client: { findFirst: vi.fn() },
  request: { findMany: vi.fn(), findFirst: vi.fn() },
}

const requestsServiceMock = { createDrafts: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/requests.service', () => ({ RequestsService: requestsServiceMock }))

const { RequestExtractionService } = await import('@/lib/services/request-extraction.service')

const MESSAGES = [
  {
    id: 'msg-real',
    content: 'הכפתור בעמוד הבית לא עובד',
    timestamp: new Date('2026-07-25T09:00:00Z'),
    phoneNumber: '0521234567',
    contact: { id: 'contact-1', name: 'דנה' },
  },
]

function draft(overrides: Record<string, unknown> = {}) {
  return {
    type: 'BUG',
    title: 'תיקון כפתור',
    description: 'לא מגיב',
    priority: 'HIGH',
    contactId: 'contact-1',
    projectId: null,
    sourceMessageId: 'msg-real',
    confidence: 0.9,
    ...overrides,
  }
}

describe('request extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.whatsAppMessage.groupBy.mockResolvedValue([{ clientId: 'client-1', _count: 1 }])
    prismaMock.whatsAppMessage.findMany.mockResolvedValue(MESSAGES)
    prismaMock.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.client.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'מסעדת הגן',
      projects: [{ id: 'project-1', name: 'האתר' }],
    })
    prismaMock.request.findMany.mockResolvedValue([])
    prismaMock.request.findFirst.mockResolvedValue(null)
    requestsServiceMock.createDrafts.mockResolvedValue([{ id: 'request-1' }])
    extraction = { requests: [draft()] }
  })

  it('drafts a request that points at a real message', async () => {
    const stats = await RequestExtractionService.runForOwner('user-1')

    expect(stats.requestsDrafted).toBe(1)
    expect(requestsServiceMock.createDrafts).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ sourceMessageId: 'msg-real', clientId: 'client-1' }),
    ])
    expect(prismaMock.whatsAppMessage.updateMany).toHaveBeenCalled()
  })

  it('drops a request whose source message the model invented', async () => {
    extraction = { requests: [draft({ sourceMessageId: 'msg-hallucinated' })] }

    const stats = await RequestExtractionService.runForOwner('user-1')

    expect(stats.requestsDrafted).toBe(0)
    expect(requestsServiceMock.createDrafts).not.toHaveBeenCalled()
    // Critically, the batch still gets marked processed, so the cron moves on
    // instead of retrying the same messages every run.
    expect(prismaMock.whatsAppMessage.updateMany).toHaveBeenCalled()
  })

  it('keeps the good requests when only one of them is bogus', async () => {
    extraction = {
      requests: [draft(), draft({ title: 'בקשה מומצאת', sourceMessageId: 'nope' })],
    }

    const stats = await RequestExtractionService.runForOwner('user-1')

    expect(stats.requestsDrafted).toBe(1)
    expect(requestsServiceMock.createDrafts).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ title: 'תיקון כפתור' }),
    ])
  })

  it('still drops a request attributed to a contact outside the batch', async () => {
    extraction = { requests: [draft({ contactId: 'contact-elsewhere' })] }

    const stats = await RequestExtractionService.runForOwner('user-1')

    expect(stats.requestsDrafted).toBe(0)
  })

  it('does not mark messages processed when the model call fails', async () => {
    generateObjectSpy.mockRejectedValueOnce(new Error('gateway down'))

    const stats = await RequestExtractionService.runForOwner('user-1')

    expect(stats.messagesProcessed).toBe(0)
    expect(prismaMock.whatsAppMessage.updateMany).not.toHaveBeenCalled()
  })
})
