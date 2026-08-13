import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const prismaMock = {
  user: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}

const wahaMock = { sendMessage: vi.fn() }
const agentMock = { getOwnerChatId: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/whatsapp-agent.service', () => ({
  WhatsAppAgentService: agentMock,
}))

const { POST } = await import('@/app/api/public/leads/route')
const { resetRateLimits } = await import('@/lib/utils/rate-limit')

const SECRET = 'test-lead-secret'

const LEAD = { name: 'דנה כהן', phone: '054-4994417' }

function leadRequest(
  body: Record<string, unknown> = LEAD,
  { secret = SECRET, ip = '203.0.113.10' }: { secret?: string | null; ip?: string } = {}
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': ip,
  }
  if (secret !== null) headers['x-lead-secret'] = secret

  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}

function existingContact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-1',
    name: LEAD.name,
    phone: '0544994417',
    email: null,
    company: null,
    projectType: null,
    estimatedBudget: null,
    notes: null,
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('public lead intake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimits()
    process.env.PUBLIC_LEAD_SECRET = SECRET

    prismaMock.user.findFirst.mockResolvedValue({ id: 'owner-1' })
    prismaMock.contact.findFirst.mockResolvedValue(null)
    prismaMock.contact.create.mockResolvedValue({ id: 'contact-1', name: LEAD.name, phone: '0544994417' })
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1', name: LEAD.name, phone: '0544994417' })
    agentMock.getOwnerChatId.mockResolvedValue('972544994417@c.us')
    wahaMock.sendMessage.mockResolvedValue(undefined)
  })

  // The whole point of the change: an unset secret must not leave the endpoint
  // open, and a rejected submission must not reach the database at all.
  it('fails closed when no secret is configured', async () => {
    delete process.env.PUBLIC_LEAD_SECRET

    const res = await POST(leadRequest())

    expect(res.status).toBe(401)
    expect(prismaMock.contact.create).not.toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('rejects a wrong or missing secret', async () => {
    for (const secret of [null, '', 'not-the-secret', `${SECRET}x`]) {
      const res = await POST(leadRequest(LEAD, { secret }))

      expect(res.status).toBe(401)
    }

    expect(prismaMock.contact.create).not.toHaveBeenCalled()
  })

  it('creates a lead and notifies the owner, storing the phone normalized', async () => {
    const res = await POST(leadRequest({ ...LEAD, notes: 'רוצה דף נחיתה' }))

    expect(res.status).toBe(201)
    expect(prismaMock.contact.create).toHaveBeenCalledTimes(1)

    const created = prismaMock.contact.create.mock.calls[0][0].data
    expect(created.phone).toBe('0544994417')
    expect(created.status).toBe('NEW')
    expect(created.source).toBe('WEBSITE')
    expect(created.userId).toBe('owner-1')

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    expect(wahaMock.sendMessage.mock.calls[0][0].text).toContain('ליד חדש מהאתר')
  })

  // Five identical submissions in six seconds is what actually happened on
  // 2026-08-13. It must cost one row and one notification.
  it('swallows an identical resubmission inside the window', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(existingContact({ notes: 'רוצה דף נחיתה' }))

    const res = await POST(leadRequest({ ...LEAD, notes: 'רוצה דף נחיתה' }))

    expect(res.status).toBe(200)
    expect(prismaMock.contact.create).not.toHaveBeenCalled()
    expect(prismaMock.contact.update).not.toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('merges a submission that adds something new, without a second row', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(existingContact({ notes: 'רוצה דף נחיתה' }))

    const res = await POST(leadRequest({ ...LEAD, email: 'dana@example.com', notes: 'ועוד חנות' }))

    expect(res.status).toBe(200)
    expect(prismaMock.contact.create).not.toHaveBeenCalled()

    const update = prismaMock.contact.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: 'contact-1' })
    expect(update.data.notes).toContain('רוצה דף נחיתה')
    expect(update.data.notes).toContain('ועוד חנות')
    expect(update.data.email).toBe('dana@example.com')
    expect(update.data.status).toBeUndefined()

    expect(wahaMock.sendMessage.mock.calls[0][0].text).toContain('איש קשר קיים')
  })

  // An old contact is not a repeat: the window is measured from the last time
  // this contact was touched, so a client resubmitting months later is heard.
  it('merges rather than swallows when the contact is older than the window', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(
      existingContact({ updatedAt: new Date('2026-01-01T00:00:00Z') })
    )

    const res = await POST(leadRequest())

    expect(res.status).toBe(200)
    expect(prismaMock.contact.update).toHaveBeenCalledTimes(1)
    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('keeps a differing budget out of the duplicate window', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(
      existingContact({ estimatedBudget: new Prisma.Decimal(5000) })
    )

    const res = await POST(leadRequest({ ...LEAD, estimatedBudget: 9000 }))

    expect(res.status).toBe(200)
    expect(prismaMock.contact.update).toHaveBeenCalledTimes(1)
  })

  it('rate limits a caller hammering the endpoint', async () => {
    for (let i = 0; i < 10; i++) {
      const allowed = await POST(leadRequest({ name: `לקוח ${i}`, phone: '0501234567' }))
      expect(allowed.status).toBe(201)
    }

    const blocked = await POST(leadRequest({ name: 'לקוח 11', phone: '0501234567' }))

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect(prismaMock.contact.create).toHaveBeenCalledTimes(10)
  })

  it('counts the window per caller', async () => {
    for (let i = 0; i < 10; i++) {
      await POST(leadRequest(LEAD, { ip: '203.0.113.10' }))
    }

    const other = await POST(leadRequest(LEAD, { ip: '198.51.100.7' }))

    expect(other.status).toBe(201)
  })

  it('answers a missing field in Hebrew', async () => {
    const res = await POST(leadRequest({ phone: '0544994417' }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ success: false, error: 'שם חובה' })
  })

  it('rejects a phone that is not Israeli', async () => {
    const res = await POST(leadRequest({ name: 'דנה', phone: '123456789' }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'מספר טלפון ישראלי לא תקין' })
  })
})
