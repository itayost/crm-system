import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  user: { findFirst: vi.fn() },
  contact: { findMany: vi.fn(), update: vi.fn() },
  whatsAppMessage: { create: vi.fn(), update: vi.fn() },
}

const wahaMock = {
  sendMessage: vi.fn(),
  getPhoneFromChatId: vi.fn(),
  formatChatId: vi.fn(),
}

const agentMock = {
  processMessage: vi.fn(),
  saveOwnerChatId: vi.fn(),
  resolveOwnerChatId: vi.fn(),
}

const supportMock = {
  handleMessage: vi.fn(),
}

const CLIENT_CONTACT = {
  id: 'contact-1',
  name: 'דנה',
  clientId: 'client-1',
  phone: '052-1234567',
  userId: 'user-1',
  client: { name: 'מסעדת הגן' },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/whatsapp-agent.service', () => ({ WhatsAppAgentService: agentMock }))
vi.mock('@/lib/services/support-agent.service', () => ({ SupportAgentService: supportMock }))

const { POST } = await import('@/app/api/whatsapp/webhook/route')
const { CLIENT_ACK_MESSAGE, UNKNOWN_SENDER_HOLD_MESSAGE } = await import(
  '@/lib/services/whatsapp-messages'
)

const WEBHOOK_SECRET = 'test-secret'
const OWNER_PHONE = '972501111111'
const OWNER_LOCAL_PHONE = '0501111111'
const OWNER_CHAT_ID = 'owner-chat@lid'

function webhookRequest(
  payload: Record<string, unknown>,
  { secret = WEBHOOK_SECRET }: { secret?: string | null } = {}
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-webhook-secret'] = secret

  return new Request('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ event: 'message', payload }),
  })
}

function incoming(from: string, body = 'שלום') {
  return { from, body, fromMe: false, timestamp: 1700000000 }
}

function sentTexts() {
  return wahaMock.sendMessage.mock.calls.map((call) => call[0] as { chatId: string; text: string })
}

describe('bot webhook identity routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.OWNER_PHONE = OWNER_PHONE

    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' })
    prismaMock.contact.findMany.mockResolvedValue([])
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
    prismaMock.whatsAppMessage.create.mockResolvedValue({ id: 'msg-1' })
    prismaMock.whatsAppMessage.update.mockResolvedValue({ id: 'msg-1' })
    agentMock.processMessage.mockResolvedValue('תשובת הסוכן')
    agentMock.resolveOwnerChatId.mockResolvedValue(OWNER_CHAT_ID)
    supportMock.handleMessage.mockResolvedValue('תשובת התמיכה')
    wahaMock.sendMessage.mockResolvedValue(undefined)
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)
  })

  it('routes the owner to the owner agent and replies with its answer', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(OWNER_LOCAL_PHONE)

    const response = await POST(webhookRequest(incoming(OWNER_CHAT_ID, 'מה יש היום?')))

    expect(response.status).toBe(200)
    expect(wahaMock.getPhoneFromChatId).toHaveBeenCalledWith(OWNER_CHAT_ID, 'bot')
    expect(agentMock.processMessage).toHaveBeenCalledWith('user-1', 'מה יש היום?')
    expect(sentTexts()).toEqual([{ chatId: OWNER_CHAT_ID, text: 'תשובת הסוכן' }])
    expect(agentMock.saveOwnerChatId).toHaveBeenCalledWith(OWNER_CHAT_ID)
  })

  it('routes a client contact to the support agent, never the owner agent', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()
    expect(agentMock.saveOwnerChatId).not.toHaveBeenCalled()
    expect(supportMock.handleMessage).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'client-chat@lid',
      clientId: 'client-1',
      clientName: 'מסעדת הגן',
      contactId: 'contact-1',
      contactName: 'דנה',
      sourceMessageId: 'msg-1',
      text: 'יש באג באתר',
    })
    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: 'תשובת התמיכה' }])
  })

  it('archives the client message as already processed so batch extraction skips it', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))

    const archived = prismaMock.whatsAppMessage.create.mock.calls[0][0].data
    expect(archived).toMatchObject({
      phoneNumber: '0521234567',
      rawChatId: 'client-chat@lid',
      direction: 'INCOMING',
      content: 'יש באג באתר',
      contactId: 'contact-1',
      clientId: 'client-1',
      sessionName: 'bot',
    })
    expect(archived.processedAt).toBeInstanceOf(Date)
    expect(prismaMock.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { lastContactedAt: expect.any(Date) },
    })
  })

  it('still answers the client when the support agent fails', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    supportMock.handleMessage.mockRejectedValue(new Error('gateway down'))

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))

    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: CLIENT_ACK_MESSAGE }])
    expect(prismaMock.whatsAppMessage.create).toHaveBeenCalled()
    // Handed back to the batch extraction so the request is not lost by both paths.
    expect(prismaMock.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { processedAt: null },
    })
  })

  it('does not treat a mere suffix match as a client', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0541234567')
    prismaMock.contact.findMany.mockResolvedValue([
      { ...CLIENT_CONTACT, phone: '0521234567' },
    ])

    await POST(webhookRequest(incoming('lookalike@lid', 'היי')))

    expect(sentTexts()[0]).toEqual({ chatId: 'lookalike@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE })
  })

  it('holds an unknown number and notifies the owner', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0539999999')

    await POST(webhookRequest(incoming('stranger@lid', 'היי, אפשר הצעת מחיר?')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()
    expect(agentMock.saveOwnerChatId).not.toHaveBeenCalled()

    const texts = sentTexts()
    expect(texts[0]).toEqual({ chatId: 'stranger@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE })
    expect(texts[1].chatId).toBe(OWNER_CHAT_ID)
    expect(texts[1].text).toContain('0539999999')
    expect(texts[1].text).toContain('היי, אפשר הצעת מחיר?')
  })

  it('treats a lead (contact without a client) like an unknown sender', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0541234567')
    prismaMock.contact.findMany.mockResolvedValue([
      { id: 'contact-2', name: 'יוסי', clientId: null, phone: '0541234567', userId: 'user-1', client: null },
    ])

    await POST(webhookRequest(incoming('lead-chat@lid', 'רוצה אתר')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()

    const texts = sentTexts()
    expect(texts[0]).toEqual({ chatId: 'lead-chat@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE })
    expect(texts[1].chatId).toBe(OWNER_CHAT_ID)
    expect(texts[1].text).toContain('יוסי')
  })

  it('holds a sender whose phone cannot be resolved', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)

    await POST(webhookRequest(incoming('unresolved@lid')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()
    expect(sentTexts()[0]).toEqual({
      chatId: 'unresolved@lid',
      text: UNKNOWN_SENDER_HOLD_MESSAGE,
    })
  })

  it('does not notify the owner about his own unresolved message', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)

    await POST(webhookRequest(incoming(OWNER_CHAT_ID)))

    expect(sentTexts()).toEqual([{ chatId: OWNER_CHAT_ID, text: UNKNOWN_SENDER_HOLD_MESSAGE }])
  })

  it('still holds the sender when no owner chat id is available', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0539999999')
    agentMock.resolveOwnerChatId.mockResolvedValue(null)

    await POST(webhookRequest(incoming('stranger@lid')))

    expect(sentTexts()).toEqual([{ chatId: 'stranger@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE }])
  })

  it('ignores non-message events, own messages, and malformed payloads', async () => {
    const statusEvent = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      body: JSON.stringify({ event: 'session.status', payload: {} }),
    })

    await POST(statusEvent)
    await POST(webhookRequest({ ...incoming(OWNER_CHAT_ID), fromMe: true }))
    await POST(webhookRequest({ from: 'x@lid', body: 'היי', timestamp: 'not-a-number' }))
    await POST(webhookRequest({ from: 'x@lid', timestamp: 1700000000 }))

    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
    expect(agentMock.processMessage).not.toHaveBeenCalled()
  })
})

describe('bot webhook secret enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OWNER_PHONE = OWNER_PHONE
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' })
  })

  it('rejects a mismatched secret', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET

    const response = await POST(webhookRequest(incoming(OWNER_CHAT_ID), { secret: 'wrong-secret' }))

    expect(response.status).toBe(401)
    expect(agentMock.processMessage).not.toHaveBeenCalled()
  })

  it('rejects a missing secret header', async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET

    const response = await POST(webhookRequest(incoming(OWNER_CHAT_ID), { secret: null }))

    expect(response.status).toBe(401)
  })

  it('fails closed when the secret is not configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET

    const response = await POST(webhookRequest(incoming(OWNER_CHAT_ID)))

    expect(response.status).toBe(401)
    expect(agentMock.processMessage).not.toHaveBeenCalled()
  })
})
