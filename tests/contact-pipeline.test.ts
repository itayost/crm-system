import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The lead pipeline's two server-side rules:
 *
 * 1. Whether a new contact is a lead or a client is not the caller's to decide.
 *    It follows from whether they were attached to a business, and it is
 *    derived in one place so the form, the API and the WhatsApp agent cannot
 *    disagree - a bookkeeper added to an existing client used to be born NEW
 *    and pollute the לידים tab, the KPI and the morning brief.
 * 2. Reaching a terminal status ends the chasing, so a stale next action is
 *    cleared rather than left to resurface in tomorrow's brief.
 */

const prismaMock = {
  contact: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  client: { findFirst: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/clients.service', () => ({
  ClientsService: { convertContactToClient: vi.fn() },
}))

const { ContactsService } = await import('@/lib/services/contacts.service')

const NEW_CONTACT = {
  name: 'דנה',
  phone: '0521234567',
  email: undefined,
  source: 'WHATSAPP' as const,
}

describe('contact creation derives the phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.create.mockResolvedValue({ id: 'contact-1' })
    prismaMock.client.findFirst.mockResolvedValue({ id: 'client-1' })
  })

  it('creates a contact attached to a business as a CLIENT', async () => {
    await ContactsService.create('user-1', { ...NEW_CONTACT, clientId: 'client-1' })

    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CLIENT', clientId: 'client-1' }),
      })
    )
  })

  it('leaves convertedAt unset - that contact was never a lead we won', async () => {
    await ContactsService.create('user-1', { ...NEW_CONTACT, clientId: 'client-1' })

    const { data } = prismaMock.contact.create.mock.calls[0][0]
    expect(data.convertedAt).toBeUndefined()
  })

  it('leaves a contact with no business to the schema default', async () => {
    await ContactsService.create('user-1', NEW_CONTACT)

    const { data } = prismaMock.contact.create.mock.calls[0][0]
    expect(data.status).toBeUndefined()
  })
})

describe('next action lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
    prismaMock.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      clientId: 'client-1',
      convertedAt: null,
      client: { projects: [] },
    })
    prismaMock.client.findFirst.mockResolvedValue({ id: 'client-1' })
  })

  it('stores a next action as a Date', async () => {
    await ContactsService.update('user-1', 'contact-1', {
      email: undefined,
      nextActionAt: '2026-08-01T09:00:00.000Z',
      nextActionNote: 'לשלוח הצעת מחיר',
    })

    const { data } = prismaMock.contact.update.mock.calls[0][0]
    expect(data.nextActionAt).toEqual(new Date('2026-08-01T09:00:00.000Z'))
    expect(data.nextActionNote).toBe('לשלוח הצעת מחיר')
  })

  it('clears the next action on an explicit null', async () => {
    await ContactsService.update('user-1', 'contact-1', {
      email: undefined,
      nextActionAt: null,
      nextActionNote: null,
    })

    const { data } = prismaMock.contact.update.mock.calls[0][0]
    expect(data.nextActionAt).toBeNull()
    expect(data.nextActionNote).toBeNull()
  })

  it('leaves the next action alone when the payload omits it', async () => {
    await ContactsService.update('user-1', 'contact-1', { email: undefined, phone: '0521111111' })

    const { data } = prismaMock.contact.update.mock.calls[0][0]
    expect(data.nextActionAt).toBeUndefined()
    expect(data.nextActionNote).toBeUndefined()
  })

  it.each(['CLIENT', 'LOST', 'INACTIVE'] as const)(
    'clears the next action when the lead reaches %s',
    async (status) => {
      await ContactsService.update('user-1', 'contact-1', { email: undefined, status })

      const { data } = prismaMock.contact.update.mock.calls[0][0]
      expect(data.nextActionAt).toBeNull()
      expect(data.nextActionNote).toBeNull()
    }
  )

  it('does not clear a next action the same request just set', async () => {
    await ContactsService.update('user-1', 'contact-1', {
      email: undefined,
      status: 'LOST',
      nextActionAt: '2026-09-01T09:00:00.000Z',
      nextActionNote: 'לבדוק שוב בעוד חודש',
    })

    const { data } = prismaMock.contact.update.mock.calls[0][0]
    expect(data.nextActionAt).toEqual(new Date('2026-09-01T09:00:00.000Z'))
    expect(data.nextActionNote).toBe('לבדוק שוב בעוד חודש')
  })

  it('keeps advancing a lead through the pipeline free of side effects', async () => {
    await ContactsService.update('user-1', 'contact-1', {
      email: undefined,
      status: 'MEETING_SCHEDULED',
    })

    const { data } = prismaMock.contact.update.mock.calls[0][0]
    expect(data.status).toBe('MEETING_SCHEDULED')
    expect(data.nextActionAt).toBeUndefined()
  })
})

describe('lead and client phases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.findMany.mockResolvedValue([])
  })

  it('excludes LOST from the leads pipeline', async () => {
    await ContactsService.getAll('user-1', { phase: 'lead' })

    const { where } = prismaMock.contact.findMany.mock.calls[0][0]
    expect(where.status.in).toEqual(['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'QUOTED'])
    expect(where.status.in).not.toContain('LOST')
  })

  it('sorts the leads worklist by what is owed soonest, nulls last', async () => {
    await ContactsService.getAll('user-1', { phase: 'lead' })

    const { orderBy } = prismaMock.contact.findMany.mock.calls[0][0]
    expect(orderBy).toEqual([
      { nextActionAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ])
  })

  it('finds a LOST lead when asked for it by status', async () => {
    await ContactsService.getAll('user-1', { status: 'LOST' })

    const { where } = prismaMock.contact.findMany.mock.calls[0][0]
    expect(where.status).toBe('LOST')
  })

  it('narrows rather than silently dropping one of status and phase', async () => {
    // LOST is not a pipeline stage, so this pair describes an empty set. It
    // used to return the whole pipeline: phase overwrote where.status.
    const result = await ContactsService.getAll('user-1', { phase: 'lead', status: 'LOST' })

    expect(result).toEqual([])
    expect(prismaMock.contact.findMany).not.toHaveBeenCalled()
  })
})
