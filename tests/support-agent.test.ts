import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

/**
 * Drives the real support agent (persona loop + tools + persistence) with the AI
 * Gateway stubbed: the fake generateText plays the part of the model and calls the
 * same tools the model would. Everything below the model is production code.
 */

type ToolMap = Record<string, { execute: (input: unknown) => Promise<unknown> }>
type GenerateTextArgs = {
  system: string
  messages: Array<{ role: string; content: string }>
  tools: ToolMap
}

let driver: (args: GenerateTextArgs) => Promise<{ text: string }>
const generateTextSpy = vi.fn(async (args: GenerateTextArgs) => driver(args))

vi.mock('ai', () => ({
  generateText: (args: GenerateTextArgs) => generateTextSpy(args),
  stepCountIs: (n: number) => n,
  tool: <T>(definition: T) => definition,
}))
vi.mock('@ai-sdk/gateway', () => ({ gateway: (id: string) => id }))

const conversations = new Map<string, Record<string, unknown>>()

function applyUpdate(current: Record<string, unknown>, data: Record<string, unknown>) {
  const next = { ...current, ...data }
  // Prisma writes DbNull as SQL NULL and reads it back as null.
  if (data.pendingDraft === Prisma.DbNull) next.pendingDraft = null
  return next
}

type CompoundWhere = { userId_chatId: { userId: string; chatId: string } }

/** Mirrors the (userId, chatId) unique key the real table is scoped on. */
function conversationKey(where: CompoundWhere) {
  return `${where.userId_chatId.userId}:${where.userId_chatId.chatId}`
}

const prismaMock = {
  supportConversation: {
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: CompoundWhere
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) => {
        const key = conversationKey(where)
        const existing = conversations.get(key)
        const row = existing
          ? applyUpdate(existing, update)
          : { id: 'conv-1', pendingDraft: null, confirmationAskedAt: null, ...create }
        conversations.set(key, row as Record<string, unknown>)
        return row
      }
    ),
    findUnique: vi.fn(async ({ where }: { where: CompoundWhere }) => {
      return conversations.get(conversationKey(where)) ?? null
    }),
    update: vi.fn(
      async ({ where, data }: { where: CompoundWhere; data: Record<string, unknown> }) => {
        const key = conversationKey(where)
        const row = applyUpdate(conversations.get(key) ?? {}, data)
        conversations.set(key, row)
        return row
      }
    ),
  },
  project: { findMany: vi.fn(), findFirst: vi.fn() },
  request: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  // Stands in for the atomic jsonb append: UPDATE ... SET pendingMedia =
  // pendingMedia || $1 WHERE userId = $2 AND chatId = $3 AND length < $4
  $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    const [json, userId, chatId, max] = values as [string, string, string, number]
    const key = `${userId}:${chatId}`
    const row = conversations.get(key)
    if (!row) return 0

    const current = Array.isArray(row.pendingMedia) ? (row.pendingMedia as unknown[]) : []
    if (current.length >= max) return 0

    conversations.set(key, { ...row, pendingMedia: [...current, ...JSON.parse(json)] })
    return 1
  }),
}

const wahaMock = { sendMessage: vi.fn() }
const agentMock = { resolveOwnerChatId: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/whatsapp-agent.service', () => ({ WhatsAppAgentService: agentMock }))

const { SupportAgentService } = await import('@/lib/services/support-agent.service')

const CHAT_ID = 'client-chat@lid'

const input = {
  userId: 'user-1',
  chatId: CHAT_ID,
  clientId: 'client-1',
  clientName: 'מסעדת הגן',
  contactId: 'contact-1',
  contactName: 'דנה',
  sourceMessageId: 'msg-1',
  text: 'הכפתור בעמוד הבית לא עובד',
}

function storedConversation() {
  return conversations.get(`${input.userId}:${CHAT_ID}`) as {
    messages: Array<{ role: string; content: string }>
    pendingDraft: Record<string, unknown> | null
    pendingMedia?: Array<Record<string, unknown>>
  }
}

/** Propose a summary in its own turn, the way the always-confirm rule requires. */
async function proposeInOwnTurn(overrides: Record<string, unknown> = {}) {
  driver = async ({ tools }) => {
    await tools.proposeSummary.execute({
      title: 'תיקון כפתור בעמוד הבית',
      description: 'הכפתור בעמוד הבית לא מגיב בלחיצה',
      type: 'BUG',
      priority: 'HIGH',
      projectName: 'האתר',
      ...overrides,
    })
    return { text: 'סיכמתי. זה מדויק?' }
  }

  await SupportAgentService.handleMessage(input)
}

function createdRequestData() {
  return prismaMock.request.create.mock.calls[0][0].data
}

describe('support agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    conversations.clear()

    prismaMock.project.findMany.mockResolvedValue([
      { id: 'project-1', name: 'האתר', status: 'ACTIVE' },
      { id: 'project-2', name: 'אפליקציה', status: 'ACTIVE' },
    ])
    prismaMock.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'האתר' })
    prismaMock.request.findMany.mockResolvedValue([])
    prismaMock.request.create.mockResolvedValue({ id: 'request-1' })
    agentMock.resolveOwnerChatId.mockResolvedValue('owner-chat@lid')
    wahaMock.sendMessage.mockResolvedValue(undefined)

    driver = async () => ({ text: 'שלום' })
  })

  it('opens a conversation for the chat and stores the exchange', async () => {
    driver = async () => ({ text: 'מה בדיוק לא עובד בכפתור?' })

    const reply = await SupportAgentService.handleMessage(input)

    expect(reply).toBe('מה בדיוק לא עובד בכפתור?')
    expect(prismaMock.supportConversation.upsert).toHaveBeenCalledTimes(1)
    expect(storedConversation().messages).toEqual([
      { role: 'user', content: 'הכפתור בעמוד הבית לא עובד' },
      { role: 'assistant', content: 'מה בדיוק לא עובד בכפתור?' },
    ])
  })

  it('stores a pending draft when the agent proposes a summary', async () => {
    await proposeInOwnTurn()

    expect(prismaMock.request.create).not.toHaveBeenCalled()
    expect(storedConversation().pendingDraft).toMatchObject({
      title: 'תיקון כפתור בעמוד הבית',
      type: 'BUG',
      projectId: 'project-1',
      sourceMessageId: 'msg-1',
    })
  })

  it('refuses to file a summary the client has not had a chance to answer', async () => {
    let toolResult: unknown
    driver = async ({ tools }) => {
      await tools.proposeSummary.execute({
        title: 'תיקון כפתור',
        description: 'לא מגיב',
        type: 'BUG',
        priority: 'HIGH',
      })
      toolResult = await tools.fileRequest.execute({})
      return { text: 'סיכמתי. זה מדויק?' }
    }

    await SupportAgentService.handleMessage(input)

    expect(toolResult).toMatchObject({ success: false, reason: 'awaiting_client_confirmation' })
    expect(prismaMock.request.create).not.toHaveBeenCalled()
    expect(storedConversation().pendingDraft).toMatchObject({ title: 'תיקון כפתור' })
  })

  it('files the confirmed draft as a pending-review WhatsApp ticket and clears it', async () => {
    await proposeInOwnTurn({ description: 'הכפתור לא מגיב' })

    driver = async ({ tools }) => {
      await tools.fileRequest.execute({})
      return { text: 'נפתחה פנייה, איתי יעבור עליה.' }
    }
    await SupportAgentService.handleMessage({ ...input, text: 'כן מדויק' })

    expect(createdRequestData()).toMatchObject({
      title: 'תיקון כפתור בעמוד הבית',
      status: 'PENDING_REVIEW',
      source: 'WHATSAPP',
      isAiGenerated: true,
      clientId: 'client-1',
      contactId: 'contact-1',
      projectId: 'project-1',
      sourceMessageId: 'msg-1',
      userId: 'user-1',
    })
    expect(storedConversation().pendingDraft).toBeNull()
  })

  it('notifies the owner when a request is filed', async () => {
    await proposeInOwnTurn({ title: 'תיקון כפתור', description: 'לא מגיב', priority: 'URGENT' })

    driver = async ({ tools }) => {
      await tools.fileRequest.execute({})
      return { text: 'נפתחה פנייה' }
    }
    await SupportAgentService.handleMessage({ ...input, text: 'כן' })

    expect(wahaMock.sendMessage).toHaveBeenCalledTimes(1)
    const notice = wahaMock.sendMessage.mock.calls[0][0] as { chatId: string; text: string }
    expect(notice.chatId).toBe('owner-chat@lid')
    expect(notice.text).toContain('מסעדת הגן')
    expect(notice.text).toContain('תיקון כפתור')
    expect(notice.text).toContain('דחופה')
  })

  it('refuses to file anything the client has not confirmed', async () => {
    let toolResult: unknown
    driver = async ({ tools }) => {
      toolResult = await tools.fileRequest.execute({})
      return { text: 'רגע, קודם נסכם' }
    }

    await SupportAgentService.handleMessage(input)

    expect(toolResult).toMatchObject({ success: false, reason: 'no_pending_summary' })
    expect(prismaMock.request.create).not.toHaveBeenCalled()
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('does not guess a project it cannot resolve', async () => {
    let toolResult: unknown
    driver = async ({ tools }) => {
      toolResult = await tools.proposeSummary.execute({
        title: 'שינוי',
        description: 'משהו',
        type: 'REQUEST',
        priority: 'MEDIUM',
        projectName: 'פרויקט שלא קיים',
      })
      return { text: 'לאיזה פרויקט הכוונה?' }
    }

    await SupportAgentService.handleMessage(input)

    expect(toolResult).toMatchObject({ success: false, reason: 'unknown_project' })
    expect(storedConversation().pendingDraft).toBeFalsy()
  })

  it('answers status questions only from the writing client own requests', async () => {
    prismaMock.request.findMany.mockResolvedValue([
      {
        title: 'תיקון כפתור',
        status: 'PENDING_REVIEW',
        createdAt: new Date('2026-07-01'),
        project: { name: 'האתר' },
      },
    ])

    let toolResult: { requests: Array<{ state: string }> } | undefined
    driver = async ({ tools }) => {
      toolResult = (await tools.getMyRequests.execute({})) as typeof toolResult
      return { text: 'הפנייה שלך ממתינה לבדיקה' }
    }

    await SupportAgentService.handleMessage(input)

    expect(prismaMock.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client-1', userId: 'user-1' }),
      })
    )
    expect(toolResult?.requests[0].state).toBe('התקבלה וממתינה לבדיקה של איתי')
  })

  it('hides dismissed requests from the client', async () => {
    driver = async ({ tools }) => {
      await tools.getMyRequests.execute({})
      return { text: 'הנה הסטטוס' }
    }

    await SupportAgentService.handleMessage(input)

    const where = prismaMock.request.findMany.mock.calls[0][0].where
    expect(where.status.in).not.toContain('DISMISSED')
  })

  it('only lists the writing client projects, without exposing ids', async () => {
    let toolResult: { projects: Array<Record<string, unknown>> } | undefined
    driver = async ({ tools }) => {
      toolResult = (await tools.listMyProjects.execute({})) as typeof toolResult
      return { text: 'לאיזה פרויקט?' }
    }

    await SupportAgentService.handleMessage(input)

    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', userId: 'user-1' },
      })
    )
    expect(toolResult?.projects).toEqual([
      { name: 'האתר', status: 'ACTIVE' },
      { name: 'אפליקציה', status: 'ACTIVE' },
    ])
  })

  it('trims the stored history to the last twenty turns', async () => {
    const longHistory = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `הודעה ${i}`,
    }))
    conversations.set(`${input.userId}:${CHAT_ID}`, {
      id: 'conv-1',
      chatId: CHAT_ID,
      clientId: input.clientId,
      contactId: input.contactId,
      userId: input.userId,
      messages: longHistory,
      pendingDraft: null,
    })

    driver = async ({ messages }) => ({ text: `ראיתי ${messages.length} הודעות` })

    await SupportAgentService.handleMessage(input)

    const stored = storedConversation().messages
    expect(stored).toHaveLength(20)
    expect(stored[stored.length - 1]).toEqual({ role: 'assistant', content: 'ראיתי 21 הודעות' })
  })

  it('attaches the conversation media to the filed request and flags what was not transcribed', async () => {
    driver = async () => ({ text: 'מה בדיוק לא עובד?' })
    await SupportAgentService.handleMessage({
      ...input,
      media: { path: 'client-1/uuid/audio.ogg', mimeType: 'audio/ogg', transcribed: true },
    })
    await SupportAgentService.handleMessage({
      ...input,
      text: 'הנה גם סרטון',
      media: { path: 'client-1/uuid/screen.mp4', mimeType: 'video/mp4', transcribed: false },
    })

    await proposeInOwnTurn()

    driver = async ({ tools }) => {
      await tools.fileRequest.execute({})
      return { text: 'נפתחה פנייה' }
    }
    await SupportAgentService.handleMessage({ ...input, text: 'כן' })

    const created = createdRequestData()
    expect(created.attachments).toEqual([
      'client-1/uuid/audio.ogg',
      'client-1/uuid/screen.mp4',
    ])
    expect(created.aiNote).toContain('1 קבצי מדיה לא תומללו')
    // Filing clears the media so the next request does not inherit it.
    expect(storedConversation().pendingMedia).toEqual([])
  })

  it('notes media that never made it to storage without attaching it', async () => {
    driver = async () => ({ text: 'תוכל לכתוב לי מה קרה?' })
    await SupportAgentService.handleMessage({
      ...input,
      media: { path: null, mimeType: 'video/mp4', transcribed: false },
    })

    await proposeInOwnTurn()

    driver = async ({ tools }) => {
      await tools.fileRequest.execute({})
      return { text: 'נפתחה פנייה' }
    }
    await SupportAgentService.handleMessage({ ...input, text: 'כן' })

    const created = createdRequestData()
    expect(created.attachments).toEqual([])
    expect(created.aiNote).toContain('1 קבצי מדיה לא תומללו')
  })

  it('ignores an attachment path outside the writing client folder', async () => {
    driver = async () => ({ text: 'קיבלתי' })
    await SupportAgentService.handleMessage({
      ...input,
      media: { path: 'client-9/uuid/other.png', mimeType: 'image/png', transcribed: true },
    })

    await proposeInOwnTurn()

    driver = async ({ tools }) => {
      await tools.fileRequest.execute({})
      return { text: 'נפתחה פנייה' }
    }
    await SupportAgentService.handleMessage({ ...input, text: 'כן' })

    expect(createdRequestData().attachments).toEqual([])
  })

  it('keeps conversations for the same chat id separate per owner', async () => {
    driver = async ({ messages }) => ({ text: `היסטוריה: ${messages.length}` })

    await SupportAgentService.handleMessage(input)
    await SupportAgentService.handleMessage({
      ...input,
      userId: 'user-2',
      clientId: 'client-2',
      contactId: 'contact-2',
      text: 'הודעה של דייר אחר',
    })

    expect(conversations.size).toBe(2)
    expect(
      (conversations.get('user-2:client-chat@lid') as { messages: unknown[] }).messages
    ).toHaveLength(2)
  })

  it('drops a pending draft when the chat changes hands', async () => {
    await proposeInOwnTurn()
    expect(storedConversation().pendingDraft).toBeTruthy()

    let toolResult: unknown
    driver = async ({ tools }) => {
      toolResult = await tools.fileRequest.execute({})
      return { text: 'שלום' }
    }

    // Same chat, different person and business behind it.
    await SupportAgentService.handleMessage({
      ...input,
      clientId: 'client-9',
      clientName: 'עסק אחר',
      contactId: 'contact-9',
      contactName: 'רון',
      text: 'כן',
    })

    expect(toolResult).toMatchObject({ success: false, reason: 'no_pending_summary' })
    expect(prismaMock.request.create).not.toHaveBeenCalled()
  })

  it('falls back to a safe reply when the model returns nothing', async () => {
    driver = async () => ({ text: '' })

    await expect(SupportAgentService.handleMessage(input)).resolves.toBe(
      'קיבלתי. אעביר לאיתי ואחזור אליך.'
    )
  })
})
