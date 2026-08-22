import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = { botConversation: { findFirst: vi.fn(), upsert: vi.fn() } }
const wahaMock = { sendMessage: vi.fn(), formatChatId: vi.fn() }

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/waha.service', () => ({ WahaService: wahaMock }))

const { notifyOwner, rememberOwnerChat } = await import('@/lib/services/owner-line')

const STORED = '972500000000@lid'

// The label content is inert here - these tests exercise resolution and
// fallback, not what gets logged - so any real OwnerNoticeSubject will do.
const ABOUT = 'a phase review'

describe('resolving where to reach Itay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    wahaMock.sendMessage.mockResolvedValue(undefined)
    wahaMock.formatChatId.mockImplementation((p: string) => `${p}@c.us`)
  })

  it('prefers the chat id he actually writes from', async () => {
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: STORED })
    vi.stubEnv('OWNER_PHONE', '0501111111')

    await notifyOwner('שלום', { about: ABOUT })

    expect(wahaMock.sendMessage).toHaveBeenCalledWith({ chatId: STORED, text: 'שלום' })
  })

  it('falls back to the configured phone before he has ever written', async () => {
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: null })
    vi.stubEnv('OWNER_PHONE', '0501111111')

    await expect(notifyOwner('שלום', { about: ABOUT })).resolves.toBe(true)

    expect(wahaMock.sendMessage).toHaveBeenCalledWith({
      chatId: '0501111111@c.us',
      text: 'שלום',
    })
  })

  it('reports undelivered when there is no stored id and no phone', async () => {
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: null })
    vi.stubEnv('OWNER_PHONE', '')

    await expect(notifyOwner('שלום', { about: ABOUT })).resolves.toBe(false)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('reports undelivered rather than throwing when the phone is not Israeli', async () => {
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: null })
    vi.stubEnv('OWNER_PHONE', 'not-a-number')
    wahaMock.formatChatId.mockImplementation(() => {
      throw new Error('bad number')
    })

    await expect(notifyOwner('שלום', { about: ABOUT })).resolves.toBe(false)
  })
})

describe('not telling Itay about his own message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: STORED })
    wahaMock.sendMessage.mockResolvedValue(undefined)
  })

  it('skips when the excluded chat is his own', async () => {
    await expect(
      notifyOwner('שלום', { about: ABOUT, unlessChatId: STORED }),
    ).resolves.toBe(false)
    expect(wahaMock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends when the excluded chat is somebody else', async () => {
    await expect(
      notifyOwner('שלום', { about: ABOUT, unlessChatId: 'someone-else@lid' }),
    ).resolves.toBe(true)
    expect(wahaMock.sendMessage).toHaveBeenCalled()
  })

  it('sends when nothing is excluded', async () => {
    await expect(notifyOwner('שלום', { about: ABOUT })).resolves.toBe(true)
    expect(wahaMock.sendMessage).toHaveBeenCalled()
  })
})

describe('a failure never reaches the caller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.botConversation.findFirst.mockResolvedValue({ ownerChatId: STORED })
  })

  it('reports undelivered rather than throwing when WAHA fails', async () => {
    wahaMock.sendMessage.mockRejectedValue(new Error('WAHA down'))

    await expect(notifyOwner('שלום', { about: 'a phase review' })).resolves.toBe(false)
  })

  it('reports undelivered rather than throwing when the database fails', async () => {
    prismaMock.botConversation.findFirst.mockRejectedValue(new Error('db down'))

    await expect(notifyOwner('שלום', { about: 'a phase review' })).resolves.toBe(false)
  })

  it('names what failed, without putting the notice in the log', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    wahaMock.sendMessage.mockRejectedValue(new Error('WAHA down'))

    await notifyOwner('הלקוח אישר את שלב העיצוב', { about: 'a phase review' })

    const logged = spy.mock.calls.flat().join(' ')
    expect(logged).toContain('a phase review')
    expect(logged).not.toContain('הלקוח')
    spy.mockRestore()
  })
})

describe('remembering his chat id', () => {
  it('upserts the singleton conversation row', async () => {
    vi.clearAllMocks()
    await rememberOwnerChat(STORED)

    const arg = prismaMock.botConversation.upsert.mock.calls[0][0]
    expect(arg.where.id).toBe('singleton')
    expect(arg.create.id).toBe('singleton')
    expect(arg.update).toEqual({ ownerChatId: STORED })
    expect(arg.create.ownerChatId).toBe(STORED)
  })
})
