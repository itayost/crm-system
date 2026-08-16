'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { projectOutstanding, projectPaid, projectTotal } from '@/lib/utils/project-money'
import { formatCurrency } from '@/lib/utils'
import type { MoneyProject } from './client-money-card'

/**
 * The answer to "where do I stand with this client", above everything else.
 *
 * The page previously opened with the client's address and tax id, and showed
 * no money anywhere - despite already holding every phase row needed to compute
 * it. Business details are reference; these four numbers are the reason you
 * opened the page.
 *
 * The portal link is promoted out of its own card for the same reason: it is
 * something you hand over mid-conversation, not a settings screen.
 */
export function ClientSummaryBand({
  projects,
  openRequests,
  formUrl,
  onRegenerate,
  regenerating,
}: {
  projects: MoneyProject[]
  openRequests: number | null
  formUrl: string | null
  onRegenerate: () => void
  regenerating: boolean
}) {
  const [copied, setCopied] = useState(false)

  const total = projects.reduce((sum, p) => sum + projectTotal(p.advanceAmount, p.phases ?? []), 0)
  const paid = projects.reduce(
    (sum, p) => sum + projectPaid(p.advanceAmount, p.advancePaidAt, p.phases ?? []),
    0,
  )
  const owed = projects.reduce((sum, p) => sum + projectOutstanding(p.phases ?? []), 0)

  const copy = async () => {
    if (!formUrl) return
    await navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure term='סה"כ מוסכם' value={formatCurrency(total)} />
        <Figure term="שולם" value={formatCurrency(paid)} tone={paid > 0 ? 'success' : undefined} />
        <Figure term="לגבייה" value={formatCurrency(owed)} tone={owed > 0 ? 'warning' : undefined} />
        <Figure
          term="פניות פתוחות"
          value={openRequests === null ? '—' : String(openRequests)}
          tone={openRequests ? 'info' : undefined}
        />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-content-faint">קישור הפניות של הלקוח:</span>
        {formUrl ? (
          <>
            <code className="min-w-0 flex-1 truncate rounded bg-surface-muted px-2 py-1 text-xs" dir="ltr">
              {formUrl}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="mr-1">{copied ? 'הועתק' : 'העתק'}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerating}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="mr-1">אפס</span>
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-xs text-content-subtle">
              עדיין לא נוצר. בלי קישור הלקוח לא יכול לראות את הפניות שלו ולא לאשר הצעות מחיר.
            </span>
            <Button size="sm" onClick={onRegenerate} disabled={regenerating}>
              צור קישור
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Figure({
  term,
  value,
  tone,
}: {
  term: string
  value: string
  tone?: 'success' | 'warning' | 'info'
}) {
  const colour =
    tone === 'success'
      ? 'text-tone-success-foreground'
      : tone === 'warning'
        ? 'text-tone-warning-foreground'
        : tone === 'info'
          ? 'text-tone-info-foreground'
          : 'text-content-strong'

  return (
    <div>
      <dt className="text-xs text-content-faint">{term}</dt>
      <dd className={`text-xl font-bold tabular-nums ${colour}`}>
        <bdi>{value}</bdi>
      </dd>
    </div>
  )
}
