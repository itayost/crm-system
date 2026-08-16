'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, Tag, Wrench } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import { toneClass, type Tone } from '@/lib/design/tones'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'

interface Decision {
  key: string
  label: string
  detail: string
  count: number
  tone: Tone
  chip: string
  href: string
  icon: typeof Tag
}

/**
 * Everything blocked on a decision, in one list.
 *
 * The CRM had no equivalent: you could see "16 open" on the dashboard and still
 * have no idea that six of them were waiting on a price from you. Each row is a
 * question with a name, and clicking it lands on the filtered list rather than
 * a screen you then have to filter yourself.
 *
 * Rows with a zero count stay visible and go quiet instead of disappearing -
 * "no quotes waiting on a client" is information, and a card whose contents
 * change shape every day is one you stop trusting.
 */
export function DecisionsCard({ metrics }: { metrics: RequestMetrics }) {
  const { decisions } = metrics

  const rows: Decision[] = [
    {
      key: 'pricing',
      label: 'ממתין לתמחור',
      detail: 'סווגו כדורשות תשלום ואין להן מחיר. לא ייווצרו משימות עד שיתומחרו ויאושרו',
      count: decisions.needsPricing,
      tone: 'caution',
      chip: 'לתמחר',
      href: '/requests?queue=needsPricing',
      icon: Tag,
    },
    {
      key: 'unclassified',
      label: 'ללא סיווג חיוב',
      detail: 'פניות פתוחות שאיש לא החליט מי משלם עליהן. השער לא נכנס לפעולה',
      count: decisions.unclassified,
      tone: 'danger',
      chip: 'לסווג',
      href: '/requests?queue=unclassified',
      icon: AlertTriangle,
    },
    {
      key: 'client',
      label: 'ממתין לתשובת הלקוח',
      detail: 'הצעות מחיר שנשלחו וטרם נענו',
      count: decisions.awaitingClient,
      tone: 'accent',
      chip: 'אצל הלקוח',
      href: '/requests?queue=awaitingClient',
      icon: Clock,
    },
    {
      key: 'notask',
      label: 'ללא משימה',
      detail: 'פניות חיות שלא הפכו לעבודה - חלקן חסומות בכוונה, חלקן פשוט נשכחו',
      count: decisions.withoutTask,
      tone: 'neutral',
      chip: 'בלי משימה',
      href: '/requests?queue=withoutTask',
      icon: Wrench,
    },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>החלטות שמחכות לך</CardTitle>
        <span className="text-xs text-content-faint">
          {decisions.needsPricing + decisions.unclassified} דורשות אותך
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <ul>
          {rows.map((row) => {
            const Icon = row.icon
            const live = row.count > 0

            return (
              <li key={row.key} className="border-b border-border last:border-b-0">
                <Link
                  href={row.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass[live ? row.tone : 'neutral']}`}
                  >
                    <Icon className="h-4 w-4" style={{ color: 'hsl(var(--t-mark))' }} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-content-strong">{row.label}</span>
                    <span className="block truncate text-xs text-content-subtle">{row.detail}</span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-bold tabular-nums text-content-strong">
                      {row.count}
                    </span>
                    {live && (
                      <StatusPill tone={row.tone} emphasis="soft" dot>
                        {row.chip}
                      </StatusPill>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
