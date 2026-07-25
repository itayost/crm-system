import { timingSafeEqual } from 'crypto'

/**
 * Shared secret check for the Vercel cron routes.
 *
 * Fails closed: an unset CRON_SECRET rejects every call rather than leaving the
 * endpoints open. Compared in constant time, like the WhatsApp webhook secret.
 */
export function isCronAuthorized(req: Request): boolean {
  const configured = process.env.CRON_SECRET ?? ''
  if (!configured) return false

  const header = req.headers.get('authorization')
  if (!header) return false

  return safeEqual(header, `Bearer ${configured}`)
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) return false

  return timingSafeEqual(left, right)
}
