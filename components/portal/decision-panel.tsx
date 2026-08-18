'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { PortalButton } from '@/components/portal/portal-button'
import { decideOnQuote } from '@/app/r/[token]/actions'

/**
 * Approve or decline a quote.
 *
 * Declining opens a note field rather than firing straight away: a client who
 * says no almost always means "not at that price" or "not this month", and that
 * sentence is the difference between a lost job and a re-quote. Approving has
 * no such step - making someone confirm a yes they already meant is friction
 * for nothing.
 *
 * There is deliberately no third "discuss" button here. That is a wa.me link on
 * the page, because the conversation already lives in WhatsApp and a comment
 * thread nobody opens would be a worse version of it.
 */
export function DecisionPanel({ token, requestId }: { token: string; requestId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [decliningNote, setDecliningNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = (decision: 'APPROVED' | 'DECLINED', note?: string) => {
    setError(null)
    const formData = new FormData()
    formData.set('decision', decision)
    if (note) formData.set('note', note)

    startTransition(async () => {
      const result = await decideOnQuote(token, requestId, formData)
      if (!result.ok) {
        setError(result.error ?? 'שגיאה ברישום התשובה')
        return
      }
      router.refresh()
    })
  }

  if (decliningNote !== null) {
    return (
      <div className="flex flex-col gap-3">
        <label htmlFor="decline-note" className="text-portal-xs font-semibold text-content-strong">
          מה לא מתאים? (לא חובה)
        </label>
        <textarea
          id="decline-note"
          rows={3}
          // Matches clientDecisionSchema. Without it a client writes a long
          // explanation, presses send, and gets "החלטה לא תקינה" back.
          maxLength={1000}
          value={decliningNote}
          onChange={(e) => setDecliningNote(e.target.value)}
          placeholder="המחיר גבוה מדי, אפשר בלי החלק השני, נדבר על זה בחודש הבא..."
          className="w-full rounded-md border border-border-strong bg-card p-3.5 text-portal-sm text-content-body placeholder:text-content-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DecisionError error={error} />
        <div className="flex flex-wrap gap-2.5">
          <PortalButton
            type="button"
            disabled={pending}
            onClick={() => submit('DECLINED', decliningNote)}
          >
            {pending ? 'רגע...' : 'שליחת התשובה'}
          </PortalButton>
          <PortalButton
            type="button"
            tone="ghost"
            disabled={pending}
            onClick={() => setDecliningNote(null)}
          >
            ביטול
          </PortalButton>
        </div>
      </div>
    )
  }

  /**
   * Pinned to the bottom of the viewport on a phone.
   *
   * This portal is almost always opened from a WhatsApp link on a phone, and
   * the client arrives to answer exactly one question. Leaving the answer at
   * the natural end of the document means scrolling past the quote, the
   * description, the intake answers and the attachments to find it. The bar
   * follows; above `sm` it settles back into the flow.
   */
  return (
    <div className="flex flex-col gap-3">
      <DecisionError error={error} />
      <div className="fixed inset-x-0 bottom-0 z-sticky flex flex-col gap-2 border-t bg-surface-app/95 px-gutter pb-4 pt-3 shadow-e2 backdrop-blur-xs sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-2xl gap-2.5">
          <PortalButton
            type="button"
            className="flex-2"
            disabled={pending}
            onClick={() => submit('APPROVED')}
          >
            {pending ? 'רגע...' : 'אישור ההצעה'}
          </PortalButton>
          <PortalButton
            type="button"
            tone="ghost"
            className="flex-1"
            disabled={pending}
            onClick={() => setDecliningNote('')}
          >
            לא עכשיו
          </PortalButton>
        </div>
        <p className="text-center text-portal-2xs text-content-muted sm:text-start">
          לא מתחילים לעבוד על זה לפני שתאשרו.
        </p>
      </div>
    </div>
  )
}

/** Announced, because a failure here is the one thing on the page that matters. */
function DecisionError({ error }: { error: string | null }) {
  return (
    <p role="status" aria-live="polite" className="text-portal-xs text-tone-danger-foreground">
      {error}
    </p>
  )
}
