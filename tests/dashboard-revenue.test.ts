import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revenue used to be "sum of Project.price where status = COMPLETED", so a
 * project half delivered and half paid for contributed nothing, and a finished
 * project the client had not paid for contributed everything.
 *
 * It is now money that actually arrived: paid phases plus paid advances. What
 * was signed off but not settled becomes its own number.
 */

const prismaMock = {
  projectPhase: { aggregate: vi.fn() },
  project: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  contact: { count: vi.fn() },
  client: { count: vi.fn() },
  task: { count: vi.fn(), findMany: vi.fn() },
  request: { count: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { DashboardService } = await import('@/lib/services/dashboard.service')

/** The phase aggregate is called twice: paid first, then approved-unpaid. */
const PAID_PHASES = 0
const APPROVED_UNPAID = 1

describe('dashboard revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.projectPhase.aggregate
      .mockResolvedValueOnce({ _sum: { price: 2500 } })
      .mockResolvedValueOnce({ _sum: { price: 1500 } })
    prismaMock.project.aggregate.mockResolvedValue({ _sum: { advanceAmount: 1000 } })
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.project.findMany.mockResolvedValue([])
    prismaMock.contact.count.mockResolvedValue(0)
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.task.count.mockResolvedValue(0)
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.request.count.mockResolvedValue(0)
  })

  it('sums paid phases and paid advances', async () => {
    const data = await DashboardService.getData('user-1')

    expect(data.revenue).toBe(3500)
  })

  it('reports approved-but-unpaid separately', async () => {
    const data = await DashboardService.getData('user-1')

    expect(data.outstanding).toBe(1500)
  })

  it('counts only phases that were actually paid', async () => {
    await DashboardService.getData('user-1')

    const { where } = prismaMock.projectPhase.aggregate.mock.calls[PAID_PHASES][0]
    expect(where.paidAt).toEqual({ not: null })
    // A phase carries no userId of its own, so scoping goes via the project.
    expect(where.project).toEqual({ userId: 'user-1' })
  })

  it('counts outstanding as approved and unpaid, not merely unpaid', async () => {
    await DashboardService.getData('user-1')

    const { where } = prismaMock.projectPhase.aggregate.mock.calls[APPROVED_UNPAID][0]
    expect(where.status).toBe('APPROVED')
    expect(where.paidAt).toBeNull()
    expect(where.project).toEqual({ userId: 'user-1' })
  })

  it('ignores an advance that has not been paid', async () => {
    await DashboardService.getData('user-1')

    const { where } = prismaMock.project.aggregate.mock.calls[0][0]
    expect(where.advancePaidAt).toEqual({ not: null })
    expect(where.userId).toBe('user-1')
  })

  it('reads zero rather than NaN when nothing has been paid', async () => {
    // mockReset, not clearAllMocks: the latter empties the recorded calls but
    // leaves the mockResolvedValueOnce queue from beforeEach still armed.
    prismaMock.projectPhase.aggregate.mockReset()
    prismaMock.project.aggregate.mockReset()
    prismaMock.projectPhase.aggregate.mockResolvedValue({ _sum: { price: null } })
    prismaMock.project.aggregate.mockResolvedValue({ _sum: { advanceAmount: null } })

    const data = await DashboardService.getData('user-1')

    expect(data.revenue).toBe(0)
    expect(data.outstanding).toBe(0)
  })
})
