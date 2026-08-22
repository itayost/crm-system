import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  user: { findFirst: vi.fn() },
  contact: { findMany: vi.fn(), update: vi.fn() },
  whatsAppMessage: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  project: { findMany: vi.fn() },
}

const degradedMock = vi.fn()

const wahaMock = {
  sendMessage: vi.fn(),
  getPhoneFromChatId: vi.fn(),
  formatChatId: vi.fn(),
  sendSeen: vi.fn(),
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
}

const agentMock = {
  processMessage: vi.fn(),
}

const ownerLineMock = {
  notifyOwner: vi.fn(),
  rememberOwnerChat: vi.fn(),
}

const supportMock = {
  handleMessage: vi.fn(),
}

const mediaMock = {
  processIncomingMedia: vi.fn(),
}

const conversationMock = { exists: vi.fn(), appendHistory: vi.fn() }

/**
 * The client turn now runs in after(), so the route answers the webhook before
 * the work happens. Tests capture those tasks and await them explicitly.
 */
const afterTasks: Array<Promise<unknown>> = []
async function flushAfter() {
  await Promise.all(afterTasks.splice(0))
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
  // Mirrors the real helper: typing opens before the work and closes after it,
  // whatever the work does.
  withTyping: async (chatId: string, work: () => Promise<unknown>) => {
    await wahaMock.startTyping(chatId)
    try {
      return await work()
    } finally {
      await wahaMock.stopTyping(chatId)
    }
  },
}))
vi.mock('@/lib/services/whatsapp-agent.service', () => ({ WhatsAppAgentService: agentMock }))
vi.mock('@/lib/services/owner-line', () => ownerLineMock)
vi.mock('@/lib/services/support-agent.service', () => ({ SupportAgentService: supportMock }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    after: (task: () => Promise<unknown>) => {
      afterTasks.push(task())
    },
  }
})
vi.mock('@/lib/services/support-conversation.service', () => ({
  SupportConversationService: conversationMock,
}))
vi.mock('@/lib/services/support-media.service', () => ({
  processIncomingMedia: (...args: unknown[]) => mediaMock.processIncomingMedia(...args),
}))
vi.mock('@/lib/ai/resilient-model', () => ({
  degradedSupportReply: (...args: unknown[]) => degradedMock(...args),
  describeModelError: (error: unknown) => String(error),
}))

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
    delete process.env.WHATSAPP_BOT_PAUSED

    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' })
    prismaMock.contact.findMany.mockResolvedValue([])
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
    prismaMock.whatsAppMessage.create.mockResolvedValue({ id: 'msg-1' })
    prismaMock.whatsAppMessage.update.mockResolvedValue({ id: 'msg-1' })
    prismaMock.whatsAppMessage.findUnique.mockResolvedValue(null)
    agentMock.processMessage.mockResolvedValue('תשובת הסוכן')
    ownerLineMock.notifyOwner.mockResolvedValue(true)
    ownerLineMock.rememberOwnerChat.mockResolvedValue(undefined)
    supportMock.handleMessage.mockResolvedValue('תשובת התמיכה')
    mediaMock.processIncomingMedia.mockResolvedValue(null)
    prismaMock.project.findMany.mockResolvedValue([])
    conversationMock.appendHistory.mockResolvedValue(undefined)
    // The local model is unavailable unless a test says otherwise.
    degradedMock.mockResolvedValue(null)
    // Existing conversation by default, so only the tests that care about the
    // greeting have to think about it.
    conversationMock.exists.mockResolvedValue(true)
    wahaMock.sendSeen.mockResolvedValue(undefined)
    wahaMock.startTyping.mockResolvedValue(undefined)
    wahaMock.stopTyping.mockResolvedValue(undefined)
    wahaMock.sendMessage.mockResolvedValue(undefined)
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)
  })

  // Captured verbatim from the GOWS engine. Every optional field it does not
  // populate arrives as null, not as an absent key, and an earlier schema that
  // merely marked them optional rejected the whole payload - so the route
  // answered 200 and silently did nothing to every real message.
  const GOWS_PAYLOAD = {
    id: 'false_212669667753986@lid_2A151BEFE19E404A4599',
    timestamp: 1784974364,
    from: '212669667753986@lid',
    fromMe: false,
    source: 'app',
    body: 'מה יש היום?',
    to: null,
    participant: null,
    hasMedia: false,
    media: null,
    ack: 2,
    location: null,
    vCards: null,
    replyTo: null,
  }

  it('accepts the payload shape the GOWS engine actually sends', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(OWNER_LOCAL_PHONE)

    await POST(webhookRequest(GOWS_PAYLOAD))

    expect(agentMock.processMessage).toHaveBeenCalledWith('user-1', 'מה יש היום?')
    expect(sentTexts()).toEqual([{ chatId: '212669667753986@lid', text: 'תשובת הסוכן' }])
  })

  it('routes the owner to the owner agent and replies with its answer', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(OWNER_LOCAL_PHONE)

    const response = await POST(webhookRequest(incoming(OWNER_CHAT_ID, 'מה יש היום?')))

    expect(response.status).toBe(200)
    expect(wahaMock.getPhoneFromChatId).toHaveBeenCalledWith(OWNER_CHAT_ID, 'bot')
    expect(agentMock.processMessage).toHaveBeenCalledWith('user-1', 'מה יש היום?')
    expect(sentTexts()).toEqual([{ chatId: OWNER_CHAT_ID, text: 'תשובת הסוכן' }])
    expect(ownerLineMock.rememberOwnerChat).toHaveBeenCalledWith(OWNER_CHAT_ID)
  })

  it('routes a client contact to the support agent, never the owner agent', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    expect(agentMock.processMessage).not.toHaveBeenCalled()
    expect(ownerLineMock.rememberOwnerChat).not.toHaveBeenCalled()
    expect(supportMock.handleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        chatId: 'client-chat@lid',
        clientId: 'client-1',
        clientName: 'מסעדת הגן',
        contactId: 'contact-1',
        contactName: 'דנה',
        sourceMessageId: 'msg-1',
        text: 'יש באג באתר',
        media: null,
      })
    )
    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: 'תשובת התמיכה' }])
  })

  it('archives the client message as already processed so batch extraction skips it', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

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

  it('transcribes a client voice note and archives the transcript with the media', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    mediaMock.processIncomingMedia.mockResolvedValue({
      path: 'client-1/uuid/audio.ogg',
      mimeType: 'audio/ogg',
      transcript: 'הכפתור לא עובד',
      transcribed: true,
      agentText: '[הודעה קולית מהלקוח, תומללה אוטומטית]: הכפתור לא עובד',
      failure: null,
    })

    await POST(
      webhookRequest({
        from: 'client-chat@lid',
        fromMe: false,
        timestamp: 1700000000,
        media: { url: 'http://waha.local/files/a.oga', mimetype: 'audio/ogg', filename: null },
      })
    )
    await flushAfter()

    expect(mediaMock.processIncomingMedia).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' })
    )

    const archived = prismaMock.whatsAppMessage.create.mock.calls[0][0].data
    expect(archived).toMatchObject({
      mediaPath: 'client-1/uuid/audio.ogg',
      mediaMimeType: 'audio/ogg',
      transcript: 'הכפתור לא עובד',
      content: '[הודעה קולית מהלקוח, תומללה אוטומטית]: הכפתור לא עובד',
    })

    expect(supportMock.handleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '[הודעה קולית מהלקוח, תומללה אוטומטית]: הכפתור לא עובד',
        media: { path: 'client-1/uuid/audio.ogg', mimeType: 'audio/ogg', transcribed: true },
      })
    )
  })


  it('greets a client writing for the first time, before doing any slow work', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    conversationMock.exists.mockResolvedValue(false)

    let greetedBeforeAgent = false
    supportMock.handleMessage.mockImplementation(async () => {
      greetedBeforeAgent = wahaMock.sendMessage.mock.calls.length === 1
      return 'תשובת התמיכה'
    })

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    const texts = sentTexts()
    expect(texts[0].text).toContain('היי דנה')
    expect(greetedBeforeAgent).toBe(true)
    expect(texts[1]).toEqual({ chatId: 'client-chat@lid', text: 'תשובת התמיכה' })
    expect(wahaMock.sendSeen).toHaveBeenCalledWith('client-chat@lid')
  })

  it('does not greet again inside an existing conversation', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    await POST(webhookRequest(incoming('client-chat@lid', 'כן')))
    await flushAfter()

    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: 'תשובת התמיכה' }])
  })

  it('warns before transcribing media, and only once per turn', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    mediaMock.processIncomingMedia.mockImplementation(async () => {
      // The client has already been told before the slow step begins.
      expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
      return {
        path: null,
        mimeType: 'audio/ogg',
        transcript: null,
        transcribed: false,
        agentText: '[הודעה קולית]',
        failure: null,
      }
    })
    // The agent asks to acknowledge too; it must not produce a second message.
    supportMock.handleMessage.mockImplementation(async ({ onAcknowledge }: { onAcknowledge?: () => Promise<void> }) => {
      await onAcknowledge?.()
      return 'תשובת התמיכה'
    })

    await POST(
      webhookRequest({
        from: 'client-chat@lid',
        fromMe: false,
        timestamp: 1700000000,
        media: { url: 'http://waha.local/a.oga', mimetype: 'audio/ogg', filename: null },
      })
    )
    await flushAfter()

    const texts = sentTexts()
    expect(texts).toHaveLength(2)
    expect(texts[0].text).toBe('רגע, בודק את זה ואחזור אליך.')
  })

  it('shows typing for the whole turn, and stops even when the agent throws', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    supportMock.handleMessage.mockRejectedValue(new Error('gateway down'))

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג')))
    await flushAfter()

    expect(wahaMock.startTyping).toHaveBeenCalledWith('client-chat@lid')
    expect(wahaMock.stopTyping).toHaveBeenCalledWith('client-chat@lid')
  })

  it('answers a redelivered message only once', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    const payload = { ...incoming('client-chat@lid', 'יש באג באתר'), id: 'waha-msg-77' }

    await POST(webhookRequest(payload))
    await flushAfter()

    // WAHA retries a webhook it believes failed; the same message comes back.
    prismaMock.whatsAppMessage.findUnique.mockResolvedValue({ id: 'msg-1' })
    await POST(webhookRequest(payload))
    await flushAfter()

    expect(prismaMock.whatsAppMessage.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'waha-msg-77' },
      select: { id: true },
    })
    expect(prismaMock.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    expect(supportMock.handleMessage).toHaveBeenCalledTimes(1)
    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: 'תשובת התמיכה' }])
  })

  it('hands the message back when the reply cannot be delivered', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    wahaMock.sendMessage.mockRejectedValue(new Error('waha down'))

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    // The agent may have answered, but nobody saw it: let the batch pass file it.
    expect(prismaMock.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { processedAt: null },
    })
  })

  it('still answers the client when the support agent fails, and tells the owner', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    supportMock.handleMessage.mockRejectedValue(new Error('gateway down'))

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    // Local model unavailable -> the canned tier, plus the owner handoff ping.
    expect(sentTexts()).toEqual([{ chatId: 'client-chat@lid', text: CLIENT_ACK_MESSAGE }])
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(
      expect.stringContaining('לא נפתחה פנייה'),
      { about: 'a degraded turn', unlessChatId: 'client-chat@lid' }
    )
    expect(prismaMock.whatsAppMessage.create).toHaveBeenCalled()
    // Handed back to the batch extraction so the request is not lost by both paths.
    expect(prismaMock.whatsAppMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { processedAt: null },
    })
  })

  it('answers with the local model when the agent fails and the fallback is up', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])
    prismaMock.project.findMany.mockResolvedValue([{ name: 'אתר הזמנות' }])
    supportMock.handleMessage.mockRejectedValue(new Error('gateway down'))
    degradedMock.mockResolvedValue('קיבלתי את ההודעה, איתי יראה אותה ויחזור אליך.')

    await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    expect(degradedMock).toHaveBeenCalledWith({
      contactName: 'דנה',
      clientName: 'מסעדת הגן',
      projectNames: ['אתר הזמנות'],
      lastMessage: 'יש באג באתר',
    })
    expect(sentTexts()).toEqual([
      { chatId: 'client-chat@lid', text: 'קיבלתי את ההודעה, איתי יראה אותה ויחזור אליך.' },
    ])
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(
      expect.stringContaining('מסעדת הגן'),
      { about: 'a degraded turn', unlessChatId: 'client-chat@lid' }
    )
    // The exchange still lands in the conversation record.
    expect(conversationMock.appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 'client-chat@lid' }),
      [
        { role: 'user', content: 'יש באג באתר' },
        { role: 'assistant', content: 'קיבלתי את ההודעה, איתי יראה אותה ויחזור אליך.' },
      ]
    )
    // Degraded or not, nothing was filed - the batch pass must get the message.
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
    await flushAfter()

    expect(sentTexts()[0]).toEqual({ chatId: 'lookalike@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE })
  })

  it('holds an unknown number and notifies the owner', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0539999999')

    await POST(webhookRequest(incoming('stranger@lid', 'היי, אפשר הצעת מחיר?')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()
    expect(ownerLineMock.rememberOwnerChat).not.toHaveBeenCalled()

    expect(sentTexts()).toEqual([{ chatId: 'stranger@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE }])
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(
      expect.stringContaining('0539999999'),
      { about: 'an unknown sender', unlessChatId: 'stranger@lid' }
    )
    const [notice] = ownerLineMock.notifyOwner.mock.calls[0]
    expect(notice).toContain('היי, אפשר הצעת מחיר?')
  })

  it('treats a lead (contact without a client) like an unknown sender', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0541234567')
    prismaMock.contact.findMany.mockResolvedValue([
      { id: 'contact-2', name: 'יוסי', clientId: null, phone: '0541234567', userId: 'user-1', client: null },
    ])

    await POST(webhookRequest(incoming('lead-chat@lid', 'רוצה אתר')))

    expect(agentMock.processMessage).not.toHaveBeenCalled()

    expect(sentTexts()).toEqual([{ chatId: 'lead-chat@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE }])
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(expect.stringContaining('יוסי'), {
      about: 'an unknown sender',
      unlessChatId: 'lead-chat@lid',
    })
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
    // The route no longer knows whether the excluded chat is his own - it just
    // tells the module who not to notify, and the module makes the call.
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(expect.any(String), {
      about: 'an unknown sender',
      unlessChatId: OWNER_CHAT_ID,
    })
  })

  it('still holds the sender when no owner chat id is available', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0539999999')
    ownerLineMock.notifyOwner.mockResolvedValue(false)

    await POST(webhookRequest(incoming('stranger@lid')))

    expect(sentTexts()).toEqual([{ chatId: 'stranger@lid', text: UNKNOWN_SENDER_HOLD_MESSAGE }])
    // The route does not read the result - delivery is the module's concern.
    expect(ownerLineMock.notifyOwner).toHaveBeenCalledWith(expect.any(String), {
      about: 'an unknown sender',
      unlessChatId: 'stranger@lid',
    })
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

describe('bot pause switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.OWNER_PHONE = OWNER_PHONE
    process.env.WHATSAPP_BOT_PAUSED = '1'

    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' })
    prismaMock.contact.findMany.mockResolvedValue([])
    agentMock.processMessage.mockResolvedValue('תשובת הסוכן')
    ownerLineMock.notifyOwner.mockResolvedValue(true)
    ownerLineMock.rememberOwnerChat.mockResolvedValue(undefined)
    conversationMock.exists.mockResolvedValue(true)
    wahaMock.sendMessage.mockResolvedValue(undefined)
    wahaMock.getPhoneFromChatId.mockResolvedValue(null)
  })

  afterEach(() => {
    delete process.env.WHATSAPP_BOT_PAUSED
  })

  it('drops a client message without a reply, an archive row, or a support turn', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0521234567')
    prismaMock.contact.findMany.mockResolvedValue([CLIENT_CONTACT])

    const response = await POST(webhookRequest(incoming('client-chat@lid', 'יש באג באתר')))
    await flushAfter()

    expect(response.status).toBe(200)
    expect(supportMock.handleMessage).not.toHaveBeenCalled()
    expect(prismaMock.whatsAppMessage.create).not.toHaveBeenCalled()
    expect(prismaMock.contact.update).not.toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
    expect(wahaMock.sendSeen).not.toHaveBeenCalled()
    expect(wahaMock.startTyping).not.toHaveBeenCalled()
  })

  it('drops an unknown sender without the hold message or the owner notice', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue('0529999999')

    const response = await POST(webhookRequest(incoming('stranger@lid', 'היי')))
    await flushAfter()

    expect(response.status).toBe(200)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  // The pause is aimed at the client-facing agent. Itay's own line into the CRM
  // is not what got paused, and he needs it most while the bot is off.
  it('still serves the owner', async () => {
    wahaMock.getPhoneFromChatId.mockResolvedValue(OWNER_LOCAL_PHONE)

    await POST(webhookRequest(incoming(OWNER_CHAT_ID, 'מה יש היום?')))

    expect(agentMock.processMessage).toHaveBeenCalledWith('user-1', 'מה יש היום?')
    expect(sentTexts()).toEqual([{ chatId: OWNER_CHAT_ID, text: 'תשובת הסוכן' }])
  })
})

describe('bot webhook secret enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OWNER_PHONE = OWNER_PHONE
    delete process.env.WHATSAPP_BOT_PAUSED
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
