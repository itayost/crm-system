import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = { project: { findMany: vi.fn() } }
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { openLedger, fullLedger } = await import('@/lib/money/ledger.server')
const { collectable } = await import('@/lib/money/ledger')

const PROJECT = {
  id: 'p1',
  name: 'אתר',
  advanceAmount: 1000,
  advancePaidAt: null,
  client: { id: 'c1', name: 'לקוח' },
  phases: [
    { id: 'ph1', name: 'עיצוב', status: 'APPROVED', price: 300, approvedAt: new Date('2026-08-01'), paidAt: null },
  ],
}

describe('scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('always scopes by userId', async () => {
    await fullLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' })
  })

  it('narrows to one client when asked', async () => {
    await fullLedger({ userId: 'u1', clientId: 'c1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', clientId: 'c1' })
  })

  it('narrows to one project when asked', async () => {
    await fullLedger({ userId: 'u1', projectId: 'p1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', id: 'p1' })
  })
})

describe('the prefilter is performance, not meaning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('asks the database for unpaid phases only on the open ledger', async () => {
    await openLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].select.phases.where).toEqual({ paidAt: null })
  })

  it('asks for every phase on the full ledger', async () => {
    await fullLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].select.phases.where).toBeUndefined()
  })

  it('reaches the same collectable total either way', async () => {
    const open = await openLedger({ userId: 'u1' })
    const full = await fullLedger({ userId: 'u1' })
    expect(collectable(open)).toBe(collectable(full))
    expect(collectable(open)).toBe(1300)
  })
})

describe('rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('carries the advance as its own row, named in Hebrew', async () => {
    const rows = await fullLedger({ userId: 'u1' })
    const advance = rows.find((r) => r.kind === 'advance')
    expect(advance).toMatchObject({ id: 'advance:p1', name: 'מקדמה', price: 1000, state: 'collectable' })
    expect(advance?.phaseStatus).toBeNull()
  })

  it('drops a paid advance from the open ledger', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { ...PROJECT, advancePaidAt: new Date('2026-08-01'), phases: [] },
    ])
    expect(await openLedger({ userId: 'u1' })).toHaveLength(0)
  })

  it('omits the advance row entirely when there is no advance', async () => {
    prismaMock.project.findMany.mockResolvedValue([{ ...PROJECT, advanceAmount: 0 }])
    const rows = await fullLedger({ userId: 'u1' })
    expect(rows.every((r) => r.kind === 'phase')).toBe(true)
  })

  it('carries project and client identity on every row', async () => {
    const rows = await fullLedger({ userId: 'u1' })
    for (const row of rows) {
      expect(row).toMatchObject({ projectId: 'p1', projectName: 'אתר', clientId: 'c1', clientName: 'לקוח' })
    }
  })
})
