import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revenue used to be "sum of Project.price where status = COMPLETED", so a
 * project half delivered and half paid for contributed nothing, and a finished
 * project the client had not paid for contributed everything.
 *
 * It is now money that actually arrived, read straight off the shared ledger:
 * paid phases plus paid advances.
 */

const prismaMock = {
  project: { count: vi.fn(), findMany: vi.fn() },
  contact: { count: vi.fn() },
  client: { count: vi.fn() },
  task: { count: vi.fn(), findMany: vi.fn() },
  request: { count: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const ledgerMock = vi.fn()
vi.mock('@/lib/money/ledger.server', () => ({ fullLedger: ledgerMock }))

const { DashboardService } = await import('@/lib/services/dashboard.service')

describe('dashboard revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ledgerMock.mockResolvedValue([])
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.project.findMany.mockResolvedValue([])
    prismaMock.contact.count.mockResolvedValue(0)
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.task.count.mockResolvedValue(0)
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.request.count.mockResolvedValue(0)
  })

  it('counts a paid phase but not an unpaid advance', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'phase', state: 'paid', price: 2500, paidAt: '2026-08-01T00:00:00.000Z', phaseStatus: 'APPROVED' },
      { kind: 'advance', state: 'collectable', price: 1000, paidAt: null, phaseStatus: null },
    ])
    const data = await DashboardService.getData('u1')
    expect(data.revenue).toBe(2500)
  })

  it('counts a paid advance', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'advance', state: 'paid', price: 1000, paidAt: '2026-08-01T00:00:00.000Z', phaseStatus: null },
    ])
    expect((await DashboardService.getData('u1')).revenue).toBe(1000)
  })

  it('never counts approval as payment', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'phase', state: 'collectable', price: 1500, paidAt: null, phaseStatus: 'APPROVED' },
    ])
    expect((await DashboardService.getData('u1')).revenue).toBe(0)
  })

  it('reads zero rather than NaN when nothing has been paid', async () => {
    expect((await DashboardService.getData('u1')).revenue).toBe(0)
  })

  it('no longer reports an outstanding figure', async () => {
    expect('outstanding' in (await DashboardService.getData('u1'))).toBe(false)
  })
})
