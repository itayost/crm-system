import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.WAHA_API_URL = 'http://waha.local:3001'
process.env.WAHA_API_KEY = 'waha-secret'

const { WahaService } = await import('@/lib/services/waha.service')
const { validateAttachment } = await import('@/lib/services/storage.service')

const MAX_BYTES = 1024

function bodyResponse(bytes: Buffer, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'audio/ogg', ...headers },
  })
}

describe('WAHA media download', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('downloads media served by the configured WAHA host', async () => {
    const fetchMock = vi.fn(async () => bodyResponse(Buffer.from('hello')))
    vi.stubGlobal('fetch', fetchMock)

    const result = await WahaService.downloadMedia('http://waha.local:3001/api/files/a.oga', {
      maxBytes: MAX_BYTES,
    })

    expect(result.contentType).toBe('audio/ogg')
    expect(result.bytes.toString()).toBe('hello')
  })

  it('refuses a URL pointing anywhere but the configured WAHA host', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      WahaService.downloadMedia('http://169.254.169.254/latest/meta-data', { maxBytes: MAX_BYTES })
    ).rejects.toThrow(/WAHA host/)

    // The API key must never leave the network the key belongs to.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a declared length over the cap before reading the body', async () => {
    const fetchMock = vi.fn(async () =>
      bodyResponse(Buffer.alloc(10), { 'content-length': String(MAX_BYTES + 1) })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      WahaService.downloadMedia('http://waha.local:3001/api/files/big.mp4', { maxBytes: MAX_BYTES })
    ).rejects.toThrow(/too large/)
  })

  it('abandons a body that grows past the cap while streaming', async () => {
    const fetchMock = vi.fn(async () => bodyResponse(Buffer.alloc(MAX_BYTES + 10)))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      WahaService.downloadMedia('http://waha.local:3001/api/files/big.mp4', { maxBytes: MAX_BYTES })
    ).rejects.toThrow(/too large/)
  })
})

describe('form attachment validation', () => {
  it('still rejects the audio and video types only the support agent accepts', () => {
    expect(validateAttachment({ size: 1000, type: 'audio/ogg' }).ok).toBe(false)
    expect(validateAttachment({ size: 1000, type: 'video/mp4' }).ok).toBe(false)
    expect(validateAttachment({ size: 1000, type: 'image/png' }).ok).toBe(true)
  })
})
