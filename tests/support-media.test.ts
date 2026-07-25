import { beforeEach, describe, expect, it, vi } from 'vitest'

const wahaMock = { downloadMedia: vi.fn() }
const storageMock = { uploadBytes: vi.fn() }
const understandingMock = { describe: vi.fn() }

vi.mock('@/lib/services/waha.service', () => ({
  WahaService: wahaMock,
  botSessionName: () => 'bot',
  personalSessionName: () => 'personal',
}))
vi.mock('@/lib/services/media-understanding.service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/media-understanding.service')>(
    '@/lib/services/media-understanding.service'
  )
  return { ...actual, MediaUnderstandingService: understandingMock }
})
vi.mock('@/lib/services/storage.service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/storage.service')>(
    '@/lib/services/storage.service'
  )
  return { ...actual, StorageService: storageMock }
})

const { processIncomingMedia } = await import('@/lib/services/support-media.service')

const VOICE_NOTE = {
  url: 'http://waha.local/api/files/abc.oga',
  mimeType: 'audio/ogg; codecs=opus',
  filename: null,
}

describe('incoming support media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wahaMock.downloadMedia.mockResolvedValue({
      bytes: Buffer.from('audio-bytes'),
      contentType: 'audio/ogg',
    })
    storageMock.uploadBytes.mockResolvedValue('client-1/uuid/audio.ogg')
    understandingMock.describe.mockResolvedValue({
      ok: true,
      transcript: 'הכפתור בעמוד הבית לא עובד',
      kind: 'audio',
    })
  })

  it('stores a voice note and feeds its transcript to the agent', async () => {
    const result = await processIncomingMedia({ clientId: 'client-1', media: VOICE_NOTE })

    expect(storageMock.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', contentType: 'audio/ogg', name: 'audio.ogg' })
    )
    expect(result).toMatchObject({
      path: 'client-1/uuid/audio.ogg',
      transcript: 'הכפתור בעמוד הבית לא עובד',
      transcribed: true,
      failure: null,
    })
    expect(result.agentText).toContain('הכפתור בעמוד הבית לא עובד')
  })

  it('stores an image and describes it for the conversation', async () => {
    wahaMock.downloadMedia.mockResolvedValue({
      bytes: Buffer.from('png-bytes'),
      contentType: 'image/png',
    })
    storageMock.uploadBytes.mockResolvedValue('client-1/uuid/image.png')
    understandingMock.describe.mockResolvedValue({
      ok: true,
      transcript: 'צילום מסך עם הודעת שגיאה אדומה',
      kind: 'image',
    })

    const result = await processIncomingMedia({
      clientId: 'client-1',
      media: { ...VOICE_NOTE, mimeType: 'image/png' },
    })

    expect(storageMock.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png', name: 'image.png' })
    )
    expect(result).toMatchObject({ path: 'client-1/uuid/image.png', transcribed: true })
    expect(result.agentText).toContain('הודעת שגיאה')
  })

  it('keeps the caption the client typed alongside the media', async () => {
    const result = await processIncomingMedia({
      clientId: 'client-1',
      media: { ...VOICE_NOTE, mimeType: 'image/png' },
      caption: 'ככה זה נראה אצלי',
    })

    expect(result.agentText).toContain('ככה זה נראה אצלי')
  })

  it('describes a screen recording', async () => {
    understandingMock.describe.mockResolvedValue({
      ok: true,
      transcript: 'בסרטון רואים שהעמוד נתקע אחרי לחיצה על שליחה',
      kind: 'video',
    })

    const result = await processIncomingMedia({
      clientId: 'client-1',
      media: { ...VOICE_NOTE, mimeType: 'video/mp4', filename: 'screen.mp4' },
    })

    expect(storageMock.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'screen.mp4' })
    )
    expect(result.agentText).toContain('העמוד נתקע')
    expect(result.transcribed).toBe(true)
  })

  it('refuses media over the size cap without storing it', async () => {
    wahaMock.downloadMedia.mockResolvedValue({
      bytes: Buffer.alloc(26 * 1024 * 1024),
      contentType: 'video/mp4',
    })

    const result = await processIncomingMedia({
      clientId: 'client-1',
      media: { ...VOICE_NOTE, mimeType: 'video/mp4' },
    })

    expect(storageMock.uploadBytes).not.toHaveBeenCalled()
    expect(understandingMock.describe).not.toHaveBeenCalled()
    expect(result).toMatchObject({ path: null, transcribed: false })
    expect(result.failure).toContain('גדול מדי')
    expect(result.agentText).toContain('בקש ממנו לכתוב את הבקשה בטקסט')
  })

  it('refuses a media type outside the support allowlist', async () => {
    wahaMock.downloadMedia.mockResolvedValue({
      bytes: Buffer.from('x'),
      contentType: 'application/zip',
    })

    const result = await processIncomingMedia({
      clientId: 'client-1',
      media: { ...VOICE_NOTE, mimeType: 'application/zip' },
    })

    expect(storageMock.uploadBytes).not.toHaveBeenCalled()
    expect(result.transcribed).toBe(false)
    expect(result.failure).toContain('סוג קובץ לא נתמך')
  })

  it('keeps the stored original when transcription fails', async () => {
    understandingMock.describe.mockResolvedValue({ ok: false, transcript: null, kind: 'audio' })

    const result = await processIncomingMedia({ clientId: 'client-1', media: VOICE_NOTE })

    expect(result.path).toBe('client-1/uuid/audio.ogg')
    expect(result.transcribed).toBe(false)
    expect(result.agentText).toContain('בקש ממנו לכתוב את הבקשה בטקסט')
  })

  it('survives a download failure', async () => {
    wahaMock.downloadMedia.mockRejectedValue(new Error('waha down'))

    const result = await processIncomingMedia({ clientId: 'client-1', media: VOICE_NOTE })

    expect(result).toMatchObject({ path: null, transcript: null, transcribed: false })
    expect(result.failure).toContain('להוריד')
  })

  it('still answers when storage is down', async () => {
    storageMock.uploadBytes.mockRejectedValue(new Error('bucket missing'))

    const result = await processIncomingMedia({ clientId: 'client-1', media: VOICE_NOTE })

    expect(result.path).toBeNull()
    expect(result.transcribed).toBe(true)
    expect(result.agentText).toContain('הכפתור בעמוד הבית לא עובד')
  })
})
