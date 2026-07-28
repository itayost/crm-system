import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Staleness used to be inferred from lastContactedAt, which only the WhatsApp
 * webhooks write. A lead rung on the phone yesterday looked abandoned, and a
 * lead with a meeting booked for Thursday got nagged about on Tuesday.
 *
 * "פעולות להיום" replaces the guess with what Itay actually said he would do,
 * and the stale-leads query now steps aside for any lead that has one.
 */

const prismaMock = {
  task: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  contact: { findMany: vi.fn() },
  project: { findMany: vi.fn() },
  request: { findMany: vi.fn() },
}

const generateText = vi.fn()

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('ai', () => ({ generateText: (...args: unknown[]) => generateText(...args) }))
vi.mock('@ai-sdk/gateway', () => ({ gateway: (id: string) => id }))

const { MorningBriefService } = await import('@/lib/services/morning-brief.service')

/** The nth contact.findMany call, in the order generateBrief issues them. */
const NEW_LEADS = 0
const STALE_CLIENTS = 1
const STALE_LEADS = 2
const DUE_NEXT_ACTIONS = 3

function contactQuery(index: number) {
  return prismaMock.contact.findMany.mock.calls[index][0]
}

describe('morning brief next actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.task.groupBy.mockResolvedValue([])
    prismaMock.task.count.mockResolvedValue(0)
    prismaMock.project.findMany.mockResolvedValue([])
    prismaMock.request.findMany.mockResolvedValue([])
    prismaMock.contact.findMany.mockResolvedValue([])
    generateText.mockResolvedValue({ text: 'בוקר טוב!' })
  })

  it('asks only for leads with an action due by the end of today', async () => {
    await MorningBriefService.generateBrief('user-1')

    const { where, orderBy } = contactQuery(DUE_NEXT_ACTIONS)
    expect(where.status.in).toEqual(['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'QUOTED'])
    expect(where.nextActionAt.lt).toBeInstanceOf(Date)
    expect(orderBy).toEqual({ nextActionAt: 'asc' })
  })

  it('exempts a lead with a scheduled action from the stale list', async () => {
    await MorningBriefService.generateBrief('user-1')

    expect(contactQuery(STALE_LEADS).where.nextActionAt).toBeNull()
  })

  it('leaves stale clients judged on contact alone', async () => {
    await MorningBriefService.generateBrief('user-1')

    const { where } = contactQuery(STALE_CLIENTS)
    expect(where.status).toBe('CLIENT')
    expect(where.nextActionAt).toBeUndefined()
  })

  it('renders due actions with their note, date and overdue marker', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    prismaMock.contact.findMany.mockImplementation((args: { where?: { nextActionAt?: unknown } }) => {
      const isDueQuery = typeof args?.where?.nextActionAt === 'object' && args.where.nextActionAt !== null
      if (!isDueQuery) return Promise.resolve([])
      return Promise.resolve([
        {
          name: 'ליד שלישי',
          phone: '0501234567',
          status: 'MEETING_SCHEDULED',
          nextActionAt: yesterday,
          nextActionNote: 'לשלוח הצעת מחיר',
        },
      ])
    })

    await MorningBriefService.generateBrief('user-1')

    const { prompt } = generateText.mock.calls[0][0]
    expect(prompt).toContain('פעולות להיום (1)')
    expect(prompt).toContain('ליד שלישי')
    expect(prompt).toContain('לשלוח הצעת מחיר')
    expect(prompt).toContain('[באיחור]')
  })

  it('names statuses in Hebrew, never as raw enum values', async () => {
    prismaMock.contact.findMany.mockImplementation((args: { select?: { lastContactedAt?: boolean; nextActionNote?: boolean } }) => {
      if (args?.select?.nextActionNote) return Promise.resolve([])
      if (args?.select?.lastContactedAt) {
        return Promise.resolve([
          { name: 'ליד ישן', status: 'QUOTED', lastContactedAt: null, createdAt: new Date(0) },
        ])
      }
      return Promise.resolve([])
    })

    await MorningBriefService.generateBrief('user-1')

    const { prompt } = generateText.mock.calls[0][0]
    expect(prompt).toContain('הוגשה הצעת מחיר')
    expect(prompt).not.toContain('(QUOTED)')
  })

  it('says אין rather than nothing when no action is due', async () => {
    await MorningBriefService.generateBrief('user-1')

    const { prompt } = generateText.mock.calls[0][0]
    expect(prompt).toContain('פעולות להיום (0):\nאין')
  })
})
