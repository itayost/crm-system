const WAHA_API_URL = process.env.WAHA_API_URL ?? ''
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''

/** Interactive session: owner agent and (from slice 2) the client support agent. */
export function botSessionName(): string {
  return process.env.WAHA_BOT_SESSION ?? 'bot'
}

/** Passive session: archives Itay's personal-number conversations. */
export function personalSessionName(): string {
  return process.env.WAHA_PERSONAL_SESSION ?? 'personal'
}

const MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000

/** Reads the body incrementally so an oversized file is dropped, not buffered whole. */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.from(await response.arrayBuffer())

  const chunks: Buffer[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`Media too large: over ${maxBytes} bytes`)
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks)
}

interface SendMessageParams {
  chatId: string
  text: string
  session?: string
}

export class WahaService {
  private static async request(path: string, options: RequestInit = {}) {
    const url = `${WAHA_API_URL}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WAHA API error ${response.status}: ${body}`)
    }

    return response.json()
  }

  static async sendMessage({ chatId, text, session }: SendMessageParams) {
    return this.request(`/api/sendText`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        text,
        session: session ?? botSessionName(),
      }),
    })
  }

  /**
   * Download a media file WAHA saved for an incoming message.
   *
   * The URL arrives inside a webhook payload, so it is treated as untrusted: it
   * is only fetched when it points at the configured WAHA host, because the
   * request carries the WAHA API key. Anything larger than maxBytes or slower
   * than the timeout is abandoned rather than buffered.
   */
  static async downloadMedia(
    url: string,
    { maxBytes, timeoutMs = MEDIA_DOWNLOAD_TIMEOUT_MS }: { maxBytes: number; timeoutMs?: number }
  ): Promise<{ bytes: Buffer; contentType: string }> {
    if (!this.isOwnMediaUrl(url)) {
      throw new Error('Media URL does not belong to the configured WAHA host')
    }

    const response = await fetch(url, {
      headers: { 'X-Api-Key': WAHA_API_KEY },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`WAHA media download failed ${response.status}`)
    }

    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Media too large: ${declaredLength} bytes`)
    }

    const bytes = await readCapped(response, maxBytes)
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'

    return { bytes, contentType }
  }

  /** True only for URLs served by the configured WAHA instance. */
  static isOwnMediaUrl(url: string): boolean {
    if (!WAHA_API_URL) return false

    try {
      return new URL(url).origin === new URL(WAHA_API_URL).origin
    } catch {
      return false
    }
  }

  /**
   * Presence signals. Every one is best-effort: a client waiting on an answer
   * must never lose it because a typing indicator failed.
   */
  private static async presence(path: string, chatId: string, session?: string) {
    try {
      await this.request(path, {
        method: 'POST',
        body: JSON.stringify({ chatId, session: session ?? botSessionName() }),
      })
    } catch (error) {
      console.warn(`WAHA ${path} failed:`, error)
    }
  }

  /** Blue ticks, so the client knows the message landed. */
  static async sendSeen(chatId: string, session?: string) {
    await this.presence('/api/sendSeen', chatId, session)
  }

  static async startTyping(chatId: string, session?: string) {
    await this.presence('/api/startTyping', chatId, session)
  }

  static async stopTyping(chatId: string, session?: string) {
    await this.presence('/api/stopTyping', chatId, session)
  }

  static formatChatId(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[-\s+]/g, '')
    const international = cleaned.startsWith('0')
      ? `972${cleaned.slice(1)}`
      : cleaned
    return `${international}@c.us`
  }

  static extractPhoneNumber(chatId: string): string {
    const number = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '')
    if (number.startsWith('972')) {
      return `0${number.slice(3)}`
    }
    return number
  }

  static isLidFormat(chatId: string): boolean {
    return chatId.endsWith('@lid')
  }

  static async resolveLidToPhone(lid: string, session: string): Promise<string | null> {
    try {
      const lids: Array<{ lid: string; pn: string }> = await this.request(
        `/api/${session}/lids?limit=500`
      )
      const match = lids.find((entry) => entry.lid === lid)
      if (match) {
        return this.extractPhoneNumber(match.pn)
      }
      return null
    } catch (error) {
      console.error('Failed to resolve LID:', error)
      return null
    }
  }

  static async getPhoneFromChatId(chatId: string, session: string): Promise<string | null> {
    if (this.isLidFormat(chatId)) {
      return this.resolveLidToPhone(chatId, session)
    }
    return this.extractPhoneNumber(chatId)
  }
}

/** WhatsApp drops the typing state on its own after about 25 seconds. */
const TYPING_REFRESH_MS = 10_000

/**
 * Show typing for as long as the work takes.
 *
 * A single startTyping is not enough for a repo search that runs half a minute,
 * so it is re-sent on a heartbeat. The timer is always cleared and the state
 * always closed, including when the work throws.
 */
export async function withTyping<T>(chatId: string, work: () => Promise<T>): Promise<T> {
  await WahaService.startTyping(chatId)
  const heartbeat = setInterval(() => {
    void WahaService.startTyping(chatId)
  }, TYPING_REFRESH_MS)

  try {
    return await work()
  } finally {
    clearInterval(heartbeat)
    await WahaService.stopTyping(chatId)
  }
}
