import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sweep is driven entirely by timestamps, so every case here is a
 * conversation with a chosen confirmationAskedAt and a fixed "now".
 */

const conversationRows: Array<Record<string, unknown>> = []

const prismaMock = {
  supportConversation: {
    findMany: vi.fn(async ({ where }: { where: { confirmationAskedAt: { lte: Date } } }) =>
      conversationRows.filter(
        (row) =>
          row.confirmationAskedAt instanceof Date &&
          row.confirmationAskedAt <= where.confirmationAskedAt.lte
      )
    ),
    findUnique: vi.fn(async ({ where }: { where: { userId_chatId: { chatId: string } } }) =>
      conversationRows.find((row) => row.chatId === where.userId_chatId.chatId) ?? null
    ),
    updateMany: vi.fn(),
  },
}

const filingMock = { fileDraftAsRequest: vi.fn() }
const wahaMock = { sendMessage: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/support-filing', () => filingMock)
vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))

const { SupportFollowupsService } = await import('@/lib/services/support-followups.service')

const NOW = new Date('2026-07-25T12:00:00.000Z')
const HOUR = 60 * 60 * 1000

const DRAFT = {
  title: 'תיקון כפתור בעמוד הבית',
  description: 'הכפתור לא מגיב',
  type: 'BUG',
  priority: 'HIGH',
  projectId: null,
  sourceMessageId: 'msg-1',
}

function seedConversation(hoursSilent: number, overrides: Record<string, unknown> = {}) {
  conversationRows.length = 0
  conversationRows.push({
    chatId: 'client-chat@lid',
    userId: 'user-1',
    clientId: 'client-1',
    contactId: 'contact-1',
    confirmationAskedAt: new Date(NOW.getTime() - hoursSilent * HOUR),
    remindersSent: 0,
    pendingDraft: DRAFT,
    client: { name: 'מסעדת הגן' },
    contact: { name: 'דנה' },
    ...overrides,
  })
}

function sentText() {
  return (wahaMock.sendMessage.mock.calls[0]?.[0] as { text: string } | undefined)?.text
}

describe('confirmation follow-ups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wahaMock.sendMessage.mockResolvedValue(undefined)
    filingMock.fileDraftAsRequest.mockResolvedValue({ requestId: 'request-1' })
    // Re-established every test: mockResolvedValue in one test would otherwise
    // leak into the next.
    prismaMock.supportConversation.updateMany.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { chatId: string; remindersSent?: { lt: number } }
        data: Record<string, unknown>
      }) => {
        const row = conversationRows.find((candidate) => candidate.chatId === where.chatId)
        if (!row) return { count: 0 }
        if (where.remindersSent && (row.remindersSent as number) >= where.remindersSent.lt) {
          return { count: 0 }
        }
        Object.assign(row, data)
        return { count: 1 }
      }
    )
  })

  it('leaves a conversation alone before the first threshold', async () => {
    seedConversation(2)

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats).toMatchObject({ firstReminders: 0, secondReminders: 0, filedUnconfirmed: 0 })
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends the first reminder after three hours of silence', async () => {
    seedConversation(4)

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.firstReminders).toBe(1)
    expect(sentText()).toContain('תיקון כפתור בעמוד הבית')
    expect(conversationRows[0].remindersSent).toBe(1)
  })

  it('does not repeat the first reminder on the next sweep', async () => {
    seedConversation(5)

    await SupportFollowupsService.sweep(NOW)
    wahaMock.sendMessage.mockClear()
    const second = await SupportFollowupsService.sweep(new Date(NOW.getTime() + HOUR))

    expect(second.firstReminders).toBe(0)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends the second reminder after a day, exactly once', async () => {
    seedConversation(25, { remindersSent: 1 })

    const first = await SupportFollowupsService.sweep(NOW)
    wahaMock.sendMessage.mockClear()
    const second = await SupportFollowupsService.sweep(NOW)

    expect(first.secondReminders).toBe(1)
    expect(second.secondReminders).toBe(0)
    expect(conversationRows[0].remindersSent).toBe(2)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('files the draft flagged as unconfirmed after two days', async () => {
    seedConversation(49, { remindersSent: 2 })

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.filedUnconfirmed).toBe(1)
    expect(filingMock.fileDraftAsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'client-chat@lid',
        clientId: 'client-1',
        contactId: 'contact-1',
        clientName: 'מסעדת הגן',
        contactName: 'דנה',
      }),
      expect.objectContaining({ title: 'תיקון כפתור בעמוד הבית' }),
      { unconfirmed: true }
    )
    // No client message: filing without confirmation is Itay's business.
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends the first reminder wording even when a sweep was missed', async () => {
    // Cron downtime: 25 hours of silence but no reminder has gone out yet.
    seedConversation(25, { remindersSent: 0 })

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.firstReminders).toBe(1)
    expect(sentText()).toContain('רק מוודא')
    expect(conversationRows[0].remindersSent).toBe(1)
  })

  it('sends nothing when another sweep already claimed the reminder', async () => {
    seedConversation(5)
    prismaMock.supportConversation.updateMany.mockResolvedValue({ count: 0 })

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.firstReminders).toBe(0)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('does not count a filing another sweep already claimed', async () => {
    seedConversation(49, { remindersSent: 2 })
    filingMock.fileDraftAsRequest.mockResolvedValue({ requestId: undefined, skipped: true })

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.filedUnconfirmed).toBe(0)
  })

  it('skips a conversation whose draft was answered in the meantime', async () => {
    seedConversation(49, { pendingDraft: null })

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.filedUnconfirmed).toBe(0)
    expect(filingMock.fileDraftAsRequest).not.toHaveBeenCalled()
  })

  it('keeps sweeping when one conversation fails', async () => {
    seedConversation(49, { remindersSent: 2 })
    conversationRows.push({
      ...conversationRows[0],
      chatId: 'other-chat@lid',
      confirmationAskedAt: new Date(NOW.getTime() - 5 * HOUR),
      remindersSent: 0,
    })
    filingMock.fileDraftAsRequest.mockRejectedValueOnce(new Error('db down'))

    const stats = await SupportFollowupsService.sweep(NOW)

    expect(stats.filedUnconfirmed).toBe(0)
    expect(stats.firstReminders).toBe(1)
  })
})
