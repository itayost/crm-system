import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  contact: { findFirst: vi.fn(), update: vi.fn() },
  whatsAppMessage: { create: vi.fn() },
}

const wahaMock = {
  getPhoneFromChatId: vi.fn(),
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => process.env.WAHA_PERSONAL_SESSION ?? 'personal',
}))

const { POST } = await import('@/app/api/whatsapp/index/route')

const WEBHOOK_SECRET = 'test-secret'

function indexRequest(
  payload: Record<string, unknown>,
  { secret = WEBHOOK_SECRET }: { secret?: string | null } = {}
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-webhook-secret'] = secret

  return new Request('http://localhost/api/whatsapp/index', {
    method: 'POST',
    headers,
    body: JSON.stringify({ event: 'message', payload }),
  })
}

function createdMessage() {
  return prismaMock.whatsAppMessage.create.mock.calls[0][0].data
}

describe('personal-session indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.WAHA_PERSONAL_SESSION = 'personal'

    prismaMock.contact.findFirst.mockResolvedValue(null)
    prismaMock.whatsAppMessage.create.mockResolvedValue({ id: 'msg-1' })
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)
  })

  it('archives an incoming message whose optional fields are null', async () => {
    // The personal session sees the same GOWS shape: to, media and participant
    // all arrive as null on an inbound message.
    wahaMock.getPhoneFromChatId.mockResolvedValue('0544994417')

    await POST(
      indexRequest({
        id: 'false_212669667753986@lid_2A151BEF',
        from: '212669667753986@lid',
        to: null,
        fromMe: false,
        body: 'שלום',
        media: null,
        timestamp: 1784974364,
      })
    )

    expect(createdMessage()).toMatchObject({ content: 'שלום', direction: 'INCOMING' })
  })

  it('attributes a message to a matched contact and touches lastContactedAt', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'contact-1', clientId: 'client-1' })

    const response = await POST(
      indexRequest({
        from: '11111@lid',
        body: 'היי',
        fromMe: false,
        timestamp: 1700000000,
      })
    )

    expect(response.status).toBe(200)
    expect(createdMessage()).toMatchObject({
      phoneNumber: '0521234567',
      rawChatId: '11111@lid',
      direction: 'INCOMING',
      content: 'היי',
      contactId: 'contact-1',
      clientId: 'client-1',
      sessionName: 'personal',
    })
    expect(prismaMock.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { lastContactedAt: expect.any(Date) },
    })
  })

  it('stores an unresolved LID unattributed under its raw chat id', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)

    await POST(
      indexRequest({ from: '22222@lid', body: 'שלום', fromMe: false, timestamp: 1700000000 })
    )

    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled()
    expect(createdMessage()).toMatchObject({
      phoneNumber: '22222@lid',
      rawChatId: '22222@lid',
      contactId: null,
      clientId: null,
    })
    expect(prismaMock.contact.update).not.toHaveBeenCalled()
  })

  it('indexes outgoing messages against the recipient chat', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')

    await POST(
      indexRequest({
        from: 'me@lid',
        to: '33333@lid',
        body: 'בדרך',
        fromMe: true,
        timestamp: 1700000000,
      })
    )

    expect(wahaMock.getPhoneFromChatId).toHaveBeenCalledWith('33333@lid', 'personal')
    expect(createdMessage()).toMatchObject({
      rawChatId: '33333@lid',
      direction: 'OUTGOING',
    })
  })

  it('ignores a payload that does not parse as a message', async () => {
    await POST(indexRequest({ from: '55555@lid', body: 'היי', timestamp: 'now' }))
    await POST(indexRequest({ body: 'היי', timestamp: 1700000000 }))

    expect(prismaMock.whatsAppMessage.create).not.toHaveBeenCalled()
  })

  it('fails closed when the webhook secret is not configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET

    const response = await POST(
      indexRequest({ from: '44444@lid', body: 'היי', fromMe: false, timestamp: 1700000000 })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.whatsAppMessage.create).not.toHaveBeenCalled()
  })

  it('rejects a mismatched secret', async () => {
    const response = await POST(
      indexRequest(
        { from: '44444@lid', body: 'היי', fromMe: false, timestamp: 1700000000 },
        { secret: 'wrong' }
      )
    )

    expect(response.status).toBe(401)
    expect(prismaMock.whatsAppMessage.create).not.toHaveBeenCalled()
  })
})
