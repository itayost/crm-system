import { beforeEach, describe, expect, it, vi } from 'vitest'

type GenerateTextArgs = {
  messages: Array<{ content: Array<{ type: string; text?: string; mediaType?: string }> }>
}

let respond: (args: GenerateTextArgs) => Promise<{ text: string }>
const generateTextSpy = vi.fn((args: GenerateTextArgs) => respond(args))

vi.mock('ai', () => ({
  generateText: (args: GenerateTextArgs) => generateTextSpy(args),
  tool: <T>(definition: T) => definition,
  stepCountIs: (n: number) => n,
}))
vi.mock('@ai-sdk/gateway', () => ({ gateway: (id: string) => id }))

const { MediaUnderstandingService, mediaKind } = await import(
  '@/lib/services/media-understanding.service'
)

describe('mediaKind', () => {
  it('classifies WhatsApp mime types, codecs and all', () => {
    expect(mediaKind('audio/ogg; codecs=opus')).toBe('audio')
    expect(mediaKind('video/mp4')).toBe('video')
    expect(mediaKind('image/jpeg')).toBe('image')
    expect(mediaKind('application/pdf')).toBe('other')
  })
})

describe('media understanding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    respond = async () => ({ text: 'תמלול' })
  })

  it('sends the media as a file part with a normalized media type', async () => {
    const result = await MediaUnderstandingService.describe({
      bytes: Buffer.from('x'),
      mimeType: 'audio/ogg; codecs=opus',
    })

    const parts = generateTextSpy.mock.calls[0][0].messages[0].content
    expect(parts[1]).toMatchObject({ type: 'file', mediaType: 'audio/ogg' })
    expect(result).toMatchObject({ ok: true, transcript: 'תמלול', kind: 'audio' })
  })

  it('asks for a description rather than a transcript for a video', async () => {
    await MediaUnderstandingService.describe({
      bytes: Buffer.from('x'),
      mimeType: 'video/mp4',
    })

    const parts = generateTextSpy.mock.calls[0][0].messages[0].content
    expect(parts[0].text).toContain('סרטון')
  })

  it('reports failure instead of throwing when the model errors', async () => {
    respond = async () => {
      throw new Error('gateway down')
    }

    await expect(
      MediaUnderstandingService.describe({ bytes: Buffer.from('x'), mimeType: 'audio/ogg' })
    ).resolves.toEqual({ ok: false, transcript: null, kind: 'audio' })
  })

  it('treats an empty answer as a failure', async () => {
    respond = async () => ({ text: '   ' })

    await expect(
      MediaUnderstandingService.describe({ bytes: Buffer.from('x'), mimeType: 'image/png' })
    ).resolves.toMatchObject({ ok: false, transcript: null })
  })
})
