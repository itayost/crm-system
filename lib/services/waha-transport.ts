import { createWahaTransport, type WahaTransport } from '@itayost/wa'

/**
 * One transport per WAHA session.
 *
 * This CRM runs two — the bot session and the personal one — which is the
 * reason the Kit takes configuration per instance rather than reading the
 * environment for itself. Memoised per session name so the LID cache inside a
 * transport survives between requests and is not shared across sessions.
 */
const transports = new Map<string, WahaTransport>()

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} environment variable`)
  return value
}

export function botSessionName(): string {
  return process.env.WAHA_BOT_SESSION ?? 'bot'
}

export function personalSessionName(): string {
  return process.env.WAHA_PERSONAL_SESSION ?? 'personal'
}

export function transportFor(session: string): WahaTransport {
  let transport = transports.get(session)
  if (!transport) {
    transport = createWahaTransport({
      gatewayUrl: required('WAHA_API_URL'),
      apiKey: required('WAHA_API_KEY'),
      session,
    })
    transports.set(session, transport)
  }
  return transport
}

export function botTransport(): WahaTransport {
  return transportFor(botSessionName())
}
