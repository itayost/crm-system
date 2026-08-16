'use server'

import { revalidatePath } from 'next/cache'
import { RequestsService } from '@/lib/services/requests.service'
import { resolveClientAttachment } from '@/lib/services/client-view'
import { StorageService } from '@/lib/services/storage.service'
import { clientDecisionSchema } from '@/lib/validations/request'
import { checkRateLimit } from '@/lib/utils/rate-limit'

/**
 * The client's answer to a quote.
 *
 * A Server Action rather than a public JSON route, deliberately. The portal's
 * reads are server components talking to Prisma directly, so there is no public
 * GET API to enumerate; making the one write an action keeps it that way, and
 * Next's action endpoint is same-origin and not something a page on another
 * host can invoke.
 *
 * The token is re-resolved here and the request is scoped by it inside
 * RequestsService.recordClientDecision. A caller can pass any requestId they
 * like and still only ever reach their own client's rows - that scoping is the
 * portal's entire security model, and it lives in a where clause rather than in
 * a check that could be forgotten.
 */
export async function decideOnQuote(
  token: string,
  requestId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  // Defence in depth for a link that leaked: the decision is one click per
  // request, so anything above a trickle is not a client making up their mind.
  const limit = checkRateLimit(`portal-decision:${token}`, 10, 60_000)
  if (!limit.allowed) {
    return { ok: false, error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' }
  }

  const parsed = clientDecisionSchema.safeParse({
    decision: formData.get('decision'),
    note: formData.get('note') || undefined,
  })

  if (!parsed.success) {
    return { ok: false, error: 'החלטה לא תקינה' }
  }

  try {
    await RequestsService.recordClientDecision(token, requestId, parsed.data)
    revalidatePath(`/r/${token}`)
    revalidatePath(`/r/${token}/${requestId}`)
    return { ok: true }
  } catch (error) {
    // Service errors are already written in Hebrew and are safe to show: they
    // say "not found" for anything that is not this client's, so they cannot
    // be used to probe which request ids exist.
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'שגיאה ברישום התשובה',
    }
  }
}

/**
 * A signed URL for a file this client attached to their own request.
 *
 * Until now a client could not open the file they themselves uploaded - the
 * only signed-URL route is session-authed for the owner.
 *
 * Addressed by index, never by path. resolveClientAttachment scopes the request
 * by formToken and then indexes into that request's own array, so a caller
 * cannot name a path at all - which matters because the storage bucket is
 * shared with support media uploaded over WhatsApp.
 *
 * 60 seconds rather than the owner route's 300: a portal link travels over
 * WhatsApp and gets forwarded, and so does anything opened from it.
 */
export async function openAttachment(
  token: string,
  requestId: string,
  index: number,
): Promise<{ url: string } | { error: string }> {
  const limit = checkRateLimit(`portal-file:${token}`, 30, 60_000)
  if (!limit.allowed) {
    return { error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' }
  }

  const allowed = await resolveClientAttachment(token, requestId, index)
  if (!allowed) {
    return { error: 'הקובץ לא נמצא' }
  }

  try {
    return { url: await StorageService.getSignedUrl(allowed, 60) }
  } catch {
    return { error: 'שגיאה בפתיחת הקובץ' }
  }
}
