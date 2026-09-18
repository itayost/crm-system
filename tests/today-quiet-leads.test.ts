import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The quiet-leads count must keep asking about lastContactedAt.
 *
 * The field's only writers were the two WhatsApp webhooks, deleted in the
 * 2026-09 teardown, and דיברתי now replaces them. If this clause ever loses
 * the lastContactedAt arm, the count silently stops meaning "not spoken to
 * recently" and starts meaning "record older than three days" - a metric that
 * lies rather than one that breaks. See ADR 0004.
 */

const prismaMock = {
  contact: { count: vi.fn(), findMany: vi.fn() },
  request: { count: vi.fn(), findMany: vi.fn() },
  projectPhase: { count: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/money/ledger.server', () => ({
  openLedger: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/money/ledger', () => ({
  isCollectable: () => false,
}))

const { TodayService } = await import('@/lib/services/today.service')

describe('quiet leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.count.mockResolvedValue(0)
    prismaMock.contact.findMany.mockResolvedValue([])
    prismaMock.request.count.mockResolvedValue(0)
    prismaMock.request.findMany.mockResolvedValue([])
    prismaMock.projectPhase.count.mockResolvedValue(0)
  })

  it('still asks about lastContactedAt, not only about createdAt', async () => {
    await TodayService.getBoard('user-1')

    const quiet = prismaMock.contact.count.mock.calls
      .map((call) => call[0].where)
      .find((where) => where?.nextActionAt === null)

    expect(quiet).toBeDefined()
    expect(JSON.stringify(quiet.OR)).toContain('lastContactedAt')
  })

  it('only counts leads with no next action planned', async () => {
    await TodayService.getBoard('user-1')

    const quiet = prismaMock.contact.count.mock.calls
      .map((call) => call[0].where)
      .find((where) => where?.OR)

    expect(quiet.nextActionAt).toBeNull()
  })
})
