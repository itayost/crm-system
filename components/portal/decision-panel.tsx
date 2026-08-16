'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
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
      <div className="space-y-3">
        <label htmlFor="decline-note" className="block text-sm font-medium text-content-strong">
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
          className="w-full rounded-md border border-border bg-background p-3 text-sm"
        />
        {error && <p className="text-sm text-tone-danger-foreground">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => submit('DECLINED', decliningNote)}
          >
            שליחת התשובה
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setDecliningNote(null)}
          >
            ביטול
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-tone-danger-foreground">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => submit('APPROVED')}
        >
          {pending ? 'רגע...' : 'אישור הצעת המחיר'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => setDecliningNote('')}
        >
          לא עכשיו
        </Button>
      </div>
    </div>
  )
}
