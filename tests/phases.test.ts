import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A ProjectPhase carries no userId - it is reached through its project - so
 * every method has to prove ownership first, and has to prove the phase it was
 * handed actually belongs to the project in the URL.
 *
 * The rule worth protecting here is that approval and payment are separate.
 * Signing work off is not the same as being paid for it, and treating them as
 * one is what made "revenue" mean "work that finished".
 */

const prismaMock = {
  project: { findFirst: vi.fn() },
  projectPhase: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

// The owner notice is fire-and-forget and must never be able to turn a
// recorded sign-off into an error on the client's screen.
const sendMessage = vi.fn()
vi.mock('@/lib/services/waha.service', () => ({ WahaService: { sendMessage: (...a: unknown[]) => sendMessage(...a) } }))

const { PhasesService } = await import('@/lib/services/phases.service')

const OWNED_PROJECT = { id: 'project-1' }
const PHASE = {
  id: 'phase-1',
  name: 'אפיון',
  order: 2,
  status: 'IN_PROGRESS',
  approvedAt: null,
  paidAt: null,
  projectId: 'project-1',
}

function updateData() {
  return prismaMock.projectPhase.update.mock.calls[0][0].data
}

describe('phase ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.projectPhase.findMany.mockResolvedValue([])
    prismaMock.projectPhase.findFirst.mockResolvedValue(PHASE)
    prismaMock.projectPhase.update.mockResolvedValue(PHASE)
  })

  it('refuses to list phases of a project the caller does not own', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)

    await expect(PhasesService.listByProject('user-1', 'someone-elses')).rejects.toThrow(
      'פרויקט לא נמצא'
    )
    expect(prismaMock.projectPhase.findMany).not.toHaveBeenCalled()
  })

  it('scopes the ownership check to the caller', async () => {
    prismaMock.project.findFirst.mockResolvedValue(OWNED_PROJECT)

    await PhasesService.listByProject('user-1', 'project-1')

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', userId: 'user-1' },
      select: { id: true },
    })
  })

  it('refuses a phase that belongs to a different project', async () => {
    prismaMock.project.findFirst.mockResolvedValue(OWNED_PROJECT)
    prismaMock.projectPhase.findFirst.mockResolvedValue(null)

    await expect(
      PhasesService.update('user-1', 'project-1', 'other-projects-phase', { name: 'x' })
    ).rejects.toThrow('שלב לא נמצא')
    expect(prismaMock.projectPhase.update).not.toHaveBeenCalled()
  })
})

describe('phase ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findFirst.mockResolvedValue(OWNED_PROJECT)
    prismaMock.projectPhase.findMany.mockResolvedValue([])
    prismaMock.projectPhase.create.mockResolvedValue({ id: 'phase-new' })
    prismaMock.$transaction.mockResolvedValue([])
  })

  it('appends a new phase after the current last one', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue({ order: 3 })

    await PhasesService.create('user-1', 'project-1', { name: 'פיתוח', price: 2500 })

    const { data } = prismaMock.projectPhase.create.mock.calls[0][0]
    expect(data.order).toBe(4)
    expect(Number(data.price)).toBe(2500)
  })

  it('starts the first phase at 1', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(null)

    await PhasesService.create('user-1', 'project-1', { name: 'אפיון', price: 0 })

    expect(prismaMock.projectPhase.create.mock.calls[0][0].data.order).toBe(1)
  })

  it('swaps orders with the neighbour above', async () => {
    prismaMock.projectPhase.findFirst
      .mockResolvedValueOnce(PHASE) // the phase being moved, order 2
      .mockResolvedValueOnce({ id: 'phase-0', order: 1 })

    await PhasesService.move('user-1', 'project-1', 'phase-1', 'UP')

    expect(prismaMock.$transaction).toHaveBeenCalled()
    const [first, second] = prismaMock.$transaction.mock.calls[0][0]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(prismaMock.projectPhase.update).toHaveBeenCalledWith({
      where: { id: 'phase-1' },
      data: { order: 1 },
    })
    expect(prismaMock.projectPhase.update).toHaveBeenCalledWith({
      where: { id: 'phase-0' },
      data: { order: 2 },
    })
  })

  it('is a no-op at the edge rather than an error', async () => {
    prismaMock.projectPhase.findFirst
      .mockResolvedValueOnce(PHASE)
      .mockResolvedValueOnce(null) // nothing above it

    await expect(
      PhasesService.move('user-1', 'project-1', 'phase-1', 'UP')
    ).resolves.toBeDefined()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('approval and payment are separate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findFirst.mockResolvedValue(OWNED_PROJECT)
    prismaMock.projectPhase.update.mockResolvedValue(PHASE)
  })

  it('stamps approvedAt when the phase is approved', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(PHASE)

    await PhasesService.update('user-1', 'project-1', 'phase-1', { status: 'APPROVED' })

    expect(updateData().approvedAt).toBeInstanceOf(Date)
  })

  it('does not pay a phase just because it was approved', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(PHASE)

    await PhasesService.update('user-1', 'project-1', 'phase-1', { status: 'APPROVED' })

    expect(updateData().paidAt).toBeUndefined()
  })

  it('clears approvedAt when the phase goes back for revisions', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue({
      ...PHASE,
      status: 'APPROVED',
      approvedAt: new Date('2026-07-01'),
    })

    await PhasesService.update('user-1', 'project-1', 'phase-1', { status: 'REVISIONS' })

    expect(updateData().approvedAt).toBeNull()
  })

  it('does not un-pay a phase that goes back for revisions', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue({
      ...PHASE,
      status: 'APPROVED',
      approvedAt: new Date('2026-07-01'),
      paidAt: new Date('2026-07-02'),
    })

    await PhasesService.update('user-1', 'project-1', 'phase-1', { status: 'REVISIONS' })

    // Money that arrived does not leave because the client found another bug.
    expect(updateData().paidAt).toBeUndefined()
  })

  it('marks a phase paid only on the explicit flag', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(PHASE)

    await PhasesService.update('user-1', 'project-1', 'phase-1', { paid: true })

    expect(updateData().paidAt).toBeInstanceOf(Date)
    expect(updateData().status).toBeUndefined()
  })

  it('reverses a payment on paid: false', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue({ ...PHASE, paidAt: new Date() })

    await PhasesService.update('user-1', 'project-1', 'phase-1', { paid: false })

    expect(updateData().paidAt).toBeNull()
  })

  it('keeps the original payment date when re-flagged as paid', async () => {
    const paidOn = new Date('2026-07-02')
    prismaMock.projectPhase.findFirst.mockResolvedValue({ ...PHASE, paidAt: paidOn })

    await PhasesService.update('user-1', 'project-1', 'phase-1', { paid: true })

    expect(updateData().paidAt).toBe(paidOn)
  })
})

describe('deleting a phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findFirst.mockResolvedValue(OWNED_PROJECT)
    prismaMock.projectPhase.findFirst.mockResolvedValue(PHASE)
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
  })

  it('renumbers what is left so order stays 1..n', async () => {
    prismaMock.projectPhase.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    prismaMock.projectPhase.delete.mockResolvedValue(PHASE)
    prismaMock.projectPhase.update.mockResolvedValue(PHASE)

    await PhasesService.delete('user-1', 'project-1', 'phase-1')

    expect(prismaMock.projectPhase.delete).toHaveBeenCalledWith({ where: { id: 'phase-1' } })
    expect(prismaMock.projectPhase.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { order: 1 },
    })
    expect(prismaMock.projectPhase.update).toHaveBeenCalledWith({
      where: { id: 'c' },
      data: { order: 3 },
    })
  })
})

describe('the client signs off a phase', () => {
  const TOKEN = 'tok-1'
  const DELIVERED = {
    id: 'phase-1',
    name: 'פיתוח החזית',
    status: 'PENDING_APPROVAL',
    price: 3600,
    project: { name: 'האתר', userId: 'user-1', client: { name: 'רשת ביסטרו' } },
  }

  beforeEach(() => {
    // Every other block in this file clears first; without it the call-count
    // assertions below read another test's calls.
    vi.clearAllMocks()
    prismaMock.projectPhase.updateMany.mockResolvedValue({ count: 1 })
    sendMessage.mockResolvedValue(undefined)
  })

  it('reaches the phase through the token, never by id alone', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)

    await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    // The portal's entire security model is this where clause. A caller may
    // pass any phase id and still only ever reach their own client's rows.
    expect(prismaMock.projectPhase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'phase-1', project: { client: { formToken: TOKEN } } },
      }),
    )
  })

  it('refuses an empty token outright', async () => {
    await expect(PhasesService.recordClientReview('', 'phase-1', { decision: 'APPROVED' })).rejects.toThrow(
      'קישור לא תקין',
    )
    expect(prismaMock.projectPhase.findFirst).not.toHaveBeenCalled()
  })

  it('says the same thing for "not yours" as for "does not exist"', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(null)

    await expect(
      PhasesService.recordClientReview(TOKEN, 'someone-elses', { decision: 'APPROVED' }),
    ).rejects.toThrow('שלב לא נמצא')
  })

  it('stamps the sign-off and the proof it was the client', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)

    await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    const [call] = prismaMock.projectPhase.updateMany.mock.calls
    expect(call[0].data.status).toBe('APPROVED')
    expect(call[0].data.approvedAt).toBeInstanceOf(Date)
    // approvedAt can be set by either side; clientReviewedAt is the narrower
    // fact that matters if the invoice is ever argued about.
    expect(call[0].data.clientReviewedAt).toBeInstanceOf(Date)
    // Never touched here, or anywhere that is not an explicit "mark paid".
    expect(call[0].data).not.toHaveProperty('paidAt')
  })

  it('claims the row conditionally, so a double-tap cannot bill twice', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)

    await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    expect(prismaMock.projectPhase.updateMany.mock.calls[0][0].where).toEqual({
      id: 'phase-1',
      status: 'PENDING_APPROVAL',
    })
  })

  it('treats a lost race as already answered rather than as an error', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)
    prismaMock.projectPhase.updateMany.mockResolvedValue({ count: 0 })

    const result = await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    expect(result.alreadyReviewed).toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('answers only a phase that is actually waiting on them', async () => {
    for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'REVISIONS', 'APPROVED']) {
      prismaMock.projectPhase.updateMany.mockClear()
      prismaMock.projectPhase.findFirst.mockResolvedValue({ ...DELIVERED, status })

      const result = await PhasesService.recordClientReview(TOKEN, 'phase-1', {
        decision: 'APPROVED',
      })

      expect(result.alreadyReviewed, `${status} must not be answerable`).toBe(true)
      expect(prismaMock.projectPhase.updateMany).not.toHaveBeenCalled()
    }
  })

  it('sends it back for another round without approving it', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)

    await PhasesService.recordClientReview(TOKEN, 'phase-1', {
      decision: 'REVISIONS',
      note: '  הכותרת קטנה מדי  ',
    })

    const { data } = prismaMock.projectPhase.updateMany.mock.calls[0][0]
    expect(data.status).toBe('REVISIONS')
    // Follows the status both ways, exactly as update() does - so the amount
    // leaves `outstanding` again rather than staying billable.
    expect(data.approvedAt).toBeNull()
    expect(data.clientNote).toBe('הכותרת קטנה מדי')
  })

  it('clears a stale revision note on approval', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)

    await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    expect(prismaMock.projectPhase.updateMany.mock.calls[0][0].data.clientNote).toBeNull()
  })

  it('records the sign-off even when WhatsApp is down', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue(DELIVERED)
    sendMessage.mockRejectedValue(new Error('Missing WAHA_API_URL environment variable'))

    const result = await PhasesService.recordClientReview(TOKEN, 'phase-1', { decision: 'APPROVED' })

    expect(result).toEqual({ alreadyReviewed: false, status: 'APPROVED' })
  })
})
