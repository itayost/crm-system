'use server'

import { revalidatePath } from 'next/cache'
import { RequestsService } from '@/lib/services/requests.service'
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
