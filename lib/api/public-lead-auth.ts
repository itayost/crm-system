import { timingSafeMatch } from '@/lib/api/shared-secret'

/**
 * Shared secret check for the public lead endpoint.
 *
 * "Public" here means unauthenticated by a *user* session, not open to the
 * world. The endpoint is server-to-server: itayost.com takes the visitor's form
 * on its own /api/leads route and forwards it from the server, so the secret
 * never reaches a browser and no CORS grant is needed.
 *
 * Fails closed, like the WAHA webhooks: an unset PUBLIC_LEAD_SECRET rejects
 * every submission rather than leaving a write endpoint open. Read per request
 * so rotating the value does not wait on a cold start.
 *
 * Why it exists: until 2026-08-13 anyone who knew the URL could write Contact
 * rows and make the CRM send WhatsApp to its owner. Six were written from
 * outside in six minutes, from a repo that is public.
 */
export function isLeadSubmissionAuthorized(req: Request): boolean {
  const configured = process.env.PUBLIC_LEAD_SECRET ?? ''
  if (!configured) return false

  const provided = req.headers.get('x-lead-secret')
  if (!provided) return false

  return timingSafeMatch(provided, configured)
}
