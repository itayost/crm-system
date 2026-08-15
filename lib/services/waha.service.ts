import { fromChatId, parseIlPhone, toChatId, toStorage } from '@itayost/il'
import { isLid } from '@itayost/wa'
import { botSessionName, personalSessionName, transportFor } from './waha-transport'

export { botSessionName, personalSessionName }

/**
 * The WAHA surface this CRM uses.
 *
 * The HTTP calls, the media guard, the LID lookup and the presence signals are
 * @itayost/wa's now. What is left is the chat-id boundary: this app addresses
 * people by chat id, the Kit addresses them by parsed phone, and the twenty-five
 * call sites should not have to care which.
 *
 * Two behaviours changed, both improvements, and both were the reason to adopt:
 *
 *   downloadMedia used to refuse any url whose origin was not the gateway.
 *   That is safe and it also broke media entirely under Docker, because the
 *   internal address WAHA reports is exactly such a url. It is now pinned to
 *   the gateway instead — protocol, host and port replaced, path kept — which
 *   is the stronger guard and fixes the Docker case at once.
 *
 *   resolveLidToPhone used to list five hundred mappings and scan them, once
 *   per message, returning nothing at all past the five hundredth. It now
 *   reads the alternative identifier the payload already carries where there
 *   is one, and asks for the single mapping otherwise, cached.
 */

interface SendMessageParams {
  readonly chatId: string
  readonly text: string
  readonly session?: string
}

/**
 * A chat id this app holds, as a phone the Kit will accept, or null.
 *
 * Null is the normal case rather than an error: a multi-device sender arrives
 * as a LID and this CRM replies to that LID directly, which the gateway
 * accepts. Refusing to address one would have stopped every such conversation.
 */
function phoneOf(chatId: string) {
  return fromChatId(chatId) ?? parseIlPhone(chatId)
}

export class WahaService {
  static async sendMessage({ chatId, text, session }: SendMessageParams) {
    const transport = transportFor(session ?? botSessionName())
    const phone = phoneOf(chatId)
    // A parsed phone goes through the typed path, which cannot be handed a
    // group or a broadcast by mistake. Anything else — a LID — is addressed
    // as the gateway addresses it.
    const result = phone === null
      ? await transport.sendToChat(chatId, text)
      : await transport.sendText(phone, text)
    if (!result.ok) {
      // The code says whether retrying could ever help: WA_RECIPIENT never,
      // WA_SESSION after the session is fixed, WA_TRANSIENT on its own.
      throw new Error(`WhatsApp send failed: ${result.code}`)
    }
    return { id: result.data.id }
  }

  /**
   * Download media a webhook pointed at.
   *
   * The url is attacker-controlled and the request carries the API key, so the
   * transport pins it to the configured gateway before fetching.
   */
  static async downloadMedia(
    url: string,
    { maxBytes, timeoutMs }: { maxBytes: number; timeoutMs?: number },
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const media = await transportFor(botSessionName()).fetchMedia(url, {
      maxBytes,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    })
    return { bytes: Buffer.from(media.bytes), contentType: media.contentType }
  }

  /** Blue ticks and the typing indicator. Best-effort: never fails a reply. */
  static async sendSeen(chatId: string, session?: string) {
    try {
      const phone = phoneOf(chatId)
      if (phone !== null) await transportFor(session ?? botSessionName()).sendSeen(phone)
    } catch (error) {
      console.warn('WAHA sendSeen failed:', error)
    }
  }

  static formatChatId(phoneNumber: string): string {
    const parsed = parseIlPhone(phoneNumber)
    if (parsed === null) throw new Error(`Not an Israeli phone number: ${phoneNumber}`)
    return toChatId(parsed)
  }

  static extractPhoneNumberOrNull(chatId: string): string | null {
    const parsed = phoneOf(chatId)
    return parsed === null ? null : toStorage(parsed, 'local')
  }

  static extractPhoneNumber(chatId: string): string {
    const parsed = fromChatId(chatId) ?? parseIlPhone(chatId)
    // Kept returning the local form the callers store.
    return parsed === null ? chatId : toStorage(parsed, 'local')
  }

  static isLidFormat(chatId: string): boolean {
    return isLid(chatId)
  }

  static async resolveLidToPhone(lid: string, session: string): Promise<string | null> {
    const phone = await transportFor(session).lids.resolve(lid)
    return phone === null ? null : toStorage(phone, 'local')
  }

  static async getPhoneFromChatId(chatId: string, session: string): Promise<string | null> {
    const phone = await transportFor(session).lids.resolve(chatId)
    return phone === null ? null : toStorage(phone, 'local')
  }

  static isOwnMediaUrl(url: string): boolean {
    // Kept for callers that still ask. Pinning made the question moot: a url
    // is never fetched as given, so one that is not ours is rewritten rather
    // than refused.
    try {
      return new URL(url).origin === new URL(process.env.WAHA_API_URL ?? '').origin
    } catch {
      return false
    }
  }
}

/**
 * Show a typing indicator for as long as `work` runs.
 *
 * The heartbeat and its shutdown are the transport's. The version this
 * replaces fired each heartbeat with `void` and never awaited the one in
 * flight, so a lingering startTyping could resolve after stopTyping and leave
 * the indicator showing for good, reading as someone permanently about to
 * reply.
 */
export async function withTyping<T>(chatId: string, work: () => Promise<T>): Promise<T> {
  const phone = phoneOf(chatId)
  // Degrades rather than refusing: an indicator is best-effort, and a LID
  // sender must still get their answer.
  if (phone === null) return work()
  return transportFor(botSessionName()).withTyping(phone, work)
}
