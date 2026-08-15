import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.WAHA_API_URL = 'http://waha.local:3001'
process.env.WAHA_API_KEY = 'waha-secret'

const { WahaService, withTyping } = await import('@/lib/services/waha.service')
const { validateAttachment } = await import('@/lib/services/storage.service')

const MAX_BYTES = 1024
const GATEWAY_HOST = 'waha.local:3001'

function bodyResponse(bytes: Buffer, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'audio/ogg', ...headers },
  })
}

/** Records every url contacted, which is how the media guard is actually proven. */
function spyFetch(reply: () => Response) {
  const contacted: string[] = []
  const mock = vi.fn(async (input: unknown) => {
    contacted.push(String(input))
    return reply()
  })
  vi.stubGlobal('fetch', mock)
  return { contacted, mock }
}

describe('WAHA media download', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('downloads media served by the configured WAHA host', async () => {
    spyFetch(() => bodyResponse(Buffer.from('hello')))

    const result = await WahaService.downloadMedia('http://waha.local:3001/api/files/a.oga', {
      maxBytes: MAX_BYTES,
    })

    expect(result.contentType).toBe('audio/ogg')
    expect(result.bytes.toString()).toBe('hello')
  })

  it('never contacts a host the payload chose', async () => {
    const { contacted } = spyFetch(() => bodyResponse(Buffer.from('x')))

    // The metadata endpoint is the classic target, and the request carries the
    // gateway API key. This used to be refused outright; it is pinned to the
    // gateway instead, which is the stronger guard and is also what finally
    // makes WAHA's own Docker-internal address reachable.
    await WahaService.downloadMedia('http://169.254.169.254/latest/meta-data', {
      maxBytes: MAX_BYTES,
    })

    expect(new URL(contacted[0]!).host).toBe(GATEWAY_HOST)
    expect(contacted[0]).not.toContain('169.254.169.254')
  })

  it('reaches the gateway for the Docker-internal address WAHA reports', async () => {
    const { contacted } = spyFetch(() => bodyResponse(Buffer.from('x')))

    // Refusing this is what broke media downloads under Docker entirely.
    await WahaService.downloadMedia('http://localhost:3000/api/files/a.oga', {
      maxBytes: MAX_BYTES,
    })

    expect(new URL(contacted[0]!).host).toBe(GATEWAY_HOST)
  })

  it('refuses a scheme that pinning cannot reach', async () => {
    const { contacted } = spyFetch(() => bodyResponse(Buffer.from('x')))

    // A blob: or data: url ignores the URL setters, so rewriting is a no-op and
    // the only safe answer is to refuse before fetching.
    await expect(
      WahaService.downloadMedia('blob:https://attacker.example/x', { maxBytes: MAX_BYTES })
    ).rejects.toThrow()
    expect(contacted).toEqual([])
  })

  it('refuses a declared length over the cap before reading the body', async () => {
    spyFetch(() => bodyResponse(Buffer.alloc(10), { 'content-length': String(MAX_BYTES + 1) }))

    await expect(
      WahaService.downloadMedia('http://waha.local:3001/api/files/big.mp4', { maxBytes: MAX_BYTES })
    ).rejects.toThrow(/cap/)
  })

  it('abandons a body that grows past the cap while streaming', async () => {
    // content-length is a claim, not a promise.
    spyFetch(() => bodyResponse(Buffer.alloc(MAX_BYTES + 10)))

    await expect(
      WahaService.downloadMedia('http://waha.local:3001/api/files/big.mp4', { maxBytes: MAX_BYTES })
    ).rejects.toThrow(/cap/)
  })
})

describe('form attachment validation', () => {
  it('still rejects the audio and video types only the support agent accepts', () => {
    expect(validateAttachment({ size: 1000, type: 'audio/ogg' }).ok).toBe(false)
    expect(validateAttachment({ size: 1000, type: 'video/mp4' }).ok).toBe(false)
    expect(validateAttachment({ size: 1000, type: 'image/png' }).ok).toBe(true)
  })
})

describe('typing indicator', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('delegates the heartbeat to the transport and closes it', async () => {
    // The heartbeat itself, and the race where a lingering startTyping could
    // resolve after stopTyping and leave the indicator showing for good, are
    // @itayost/wa's and are tested there. What this owns is the delegation.
    const { contacted } = spyFetch(() => new Response('{}', { status: 200 }))

    await expect(withTyping('972501234567@c.us', async () => 'done')).resolves.toBe('done')

    const paths = contacted.map((url) => new URL(url).pathname)
    expect(paths[0]).toBe('/api/startTyping')
    expect(paths.at(-1)).toBe('/api/stopTyping')
  })

  it('still runs the work for a LID it cannot address', async () => {
    // A multi-device sender arrives as a LID. Refusing to run the turn because
    // the indicator cannot be addressed would lose the answer itself.
    const { contacted } = spyFetch(() => new Response('{}', { status: 200 }))

    await expect(withTyping('167740702781568@lid', async () => 'done')).resolves.toBe('done')
    expect(contacted).toEqual([])
  })
})
