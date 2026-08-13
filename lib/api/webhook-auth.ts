import { timingSafeMatch } from '@/lib/api/shared-secret'

/**
 * Shared secret check for the WAHA webhooks.
 *
 * Fails closed: an unset WHATSAPP_WEBHOOK_SECRET rejects every request rather
 * than letting anyone post to the webhooks. The env var is read per request so a
 * deployment can rotate it without a cold start being able to open the door.
 */
export function isWebhookAuthorized(req: Request): boolean {
  const configured = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''
  if (!configured) return false

  const provided = req.headers.get('x-webhook-secret')
  if (!provided) return false

  return timingSafeMatch(provided, configured)
}
