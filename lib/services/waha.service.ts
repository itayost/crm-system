const WAHA_API_URL = process.env.WAHA_API_URL ?? ''
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_BOT_SESSION = process.env.WAHA_BOT_SESSION ?? 'bot'

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
        session: session ?? WAHA_BOT_SESSION,
      }),
    })
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
