import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_INTAKE } from '@/lib/validations/intake'

/**
 * The two service behaviours the dashboard rework leans on: the opt-in
 * excludePending filter (the requests table hides drafts that already sit in
 * the pending-review queue) and intake editing through update().
 */

const prismaMock = {
  request: {
    findMany: vi.fn(async (_args?: Record<string, unknown>) => []),
    findFirst: vi.fn(),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    updateMany: vi.fn(),
  },
  task: { create: vi.fn(), delete: vi.fn() },
  project: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: { sendMessage: vi.fn() },
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/storage.service', () => ({
  StorageService: { removeAttachments: vi.fn() },
}))

const { RequestsService } = await import('@/lib/services/requests.service')
const { updateRequestSchema } = await import('@/lib/validations/request')

describe('getAll pending filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('excludes PENDING_REVIEW only when excludePending is set', async () => {
    await RequestsService.getAll('user-1', { excludePending: true })

    expect(prismaMock.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'PENDING_REVIEW' } }),
      })
    )
  })

  it('an explicit status filter wins over excludePending', async () => {
    await RequestsService.getAll('user-1', { status: 'PENDING_REVIEW', excludePending: true })

    expect(prismaMock.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING_REVIEW' }),
      })
    )
  })

  it('default listing stays unfiltered so the owner agent keeps seeing drafts', async () => {
    await RequestsService.getAll('user-1', {})

    expect(prismaMock.request.findMany).toHaveBeenCalledOnce()
    const args = prismaMock.request.findMany.mock.calls[0]?.[0] as
      | { where: { status?: unknown } }
      | undefined
    expect(args?.where.status).toBeUndefined()
  })
})

describe('update with intake', () => {
  const existing = {
    id: 'request-1',
    userId: 'user-1',
    status: 'OPEN',
    resolvedAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.request.findFirst.mockResolvedValue(existing)
  })

  it('writes a full intake object through', async () => {
    const intake = { ...EMPTY_INTAKE, whatHappened: 'הכפתור לא מגיב', blocking: true }

    await RequestsService.update('user-1', 'request-1', { intake })

    expect(prismaMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ intake }) })
    )
  })

  it('leaves the stored intake untouched when the update omits it', async () => {
    await RequestsService.update('user-1', 'request-1', { title: 'כותרת חדשה' })

    const data = prismaMock.request.update.mock.calls[0][0].data
    expect(data.intake).toBeUndefined()
  })
})

describe('updateRequestSchema intake shape', () => {
  it('accepts a full intake object', () => {
    const parsed = updateRequestSchema.safeParse({ intake: EMPTY_INTAKE })
    expect(parsed.success).toBe(true)
  })

  it('rejects a null intake - omission is the only way to leave it alone', () => {
    const parsed = updateRequestSchema.safeParse({ intake: null })
    expect(parsed.success).toBe(false)
  })
})
