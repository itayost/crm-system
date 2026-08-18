'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { PortalButton } from '@/components/portal/portal-button'
import { reviewPhase } from '@/app/r/[token]/actions'
import type { ClientPhaseView } from '@/lib/services/client-view'
import { formatCurrency } from '@/lib/utils'

/**
 * Delivered work, waiting on the client.
 *
 * The two paths are deliberately balanced. Approving a phase is not a
 * formality: it stamps approvedAt, which is what projectOutstanding() counts,
 * so the amount stops being "not yet due" and becomes an invoice the moment
 * this button is pressed. Making that the easy path and "something is wrong" a
 * trip to another app would be a nudge toward signing off on work the client
 * has not actually checked - on a control that bills them.
 *
 * So: same size, same row, one ink and one outlined, and the sentence that says
 * what approving means sits above them rather than in a confirmation after.
 *
 * A revision request requires a note, which is the one place friction is the
 * point - "needs changes" with nothing else in it is a bounce, not a message,
 * and Itay would have to go and ask.
 */
export function PhaseReview({
  token,
  phase,
  projectName,
}: {
  token: string
  phase: ClientPhaseView
  projectName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = (decision: 'APPROVED' | 'REVISIONS', text?: string) => {
    setError(null)
    const formData = new FormData()
    formData.set('decision', decision)
    if (text) formData.set('note', text)

    startTransition(async () => {
      const result = await reviewPhase(token, phase.id, formData)
      if (!result.ok) {
        setError(result.error ?? 'שגיאה ברישום התשובה')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-tone-caution-mark/45 bg-tone-caution-surface/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-portal-2xs text-content-muted">{projectName}</span>
          <span className="text-portal-base font-semibold text-content-strong">{phase.name}</span>
        </div>
        {phase.price > 0 && (
          <span className="shrink-0 font-display text-portal-title font-medium leading-none tabular-nums text-content-strong">
            <bdi>{formatCurrency(phase.price)}</bdi>
          </span>
        )}
      </div>

      <p className="text-portal-sm text-content-body">
        סיימנו את השלב הזה והוא ממתין לבדיקה שלך.
      </p>

      {note === null ? (
        <>
          {/* Said before the button, not after it. */}
          <p className="text-portal-2xs text-tone-caution-foreground">
            אישור אומר שהעבודה הושלמה לשביעות רצונך, והשלב עובר לתשלום.
          </p>
          <ReviewError error={error} />
          <div className="flex gap-2.5">
            <PortalButton
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={() => submit('APPROVED')}
            >
              {pending ? 'רגע…' : 'אישור השלב'}
            </PortalButton>
            <PortalButton
              type="button"
              tone="ghost"
              className="flex-1"
              disabled={pending}
              onClick={() => setNote('')}
            >
              צריך תיקון
            </PortalButton>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <label
            htmlFor={`phase-note-${phase.id}`}
            className="text-portal-xs font-semibold text-content-strong"
          >
            מה צריך לתקן?
          </label>
          <textarea
            id={`phase-note-${phase.id}`}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ככל שתהיו ספציפיים יותר, כך נתקן מהר יותר."
            className="w-full rounded-md border border-border-strong bg-card p-3.5 text-portal-sm text-content-body placeholder:text-content-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <ReviewError error={error} />
          <div className="flex flex-wrap gap-2.5">
            <PortalButton
              type="button"
              disabled={pending || !note.trim()}
              onClick={() => submit('REVISIONS', note)}
            >
              {pending ? 'רגע…' : 'שליחה'}
            </PortalButton>
            <PortalButton
              type="button"
              tone="ghost"
              disabled={pending}
              onClick={() => setNote(null)}
            >
              ביטול
            </PortalButton>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewError({ error }: { error: string | null }) {
  if (!error) return null

  return (
    <p role="status" aria-live="polite" className="text-portal-xs text-tone-danger-foreground">
      {error}
    </p>
  )
}
