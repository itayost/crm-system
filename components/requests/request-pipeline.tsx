'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toneClass } from '@/lib/design/tones'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'

interface Stage {
  key: string
  label: string
  value: number
  /** The one stage that needs Itay to do something is the only one with hue. */
  hot?: boolean
  href: string
}

/**
 * Where every request stands, as proportional bars.
 *
 * No chart library, and none needed: the bar width is the count and the tone
 * custom properties already ship. The point of the panel is not the shape, it
 * is that exactly one stage is saturated - the one that needs pricing. A row of
 * five coloured bars would say the same as a row of none.
 */
export function RequestPipeline({ metrics }: { metrics: RequestMetrics }) {
  const { pipeline, decisions } = metrics

  const stages: Stage[] = [
    {
      key: 'pricing',
      label: 'ממתין לתמחור',
      value: decisions.needsPricing,
      hot: true,
      href: '/requests?queue=needsPricing',
    },
    { key: 'review', label: 'ממתין לאישור', value: pipeline.pendingReview, href: '/requests?status=PENDING_REVIEW' },
    { key: 'open', label: 'פתוח', value: pipeline.open, href: '/requests?status=OPEN' },
    { key: 'progress', label: 'בטיפול', value: pipeline.inProgress, href: '/requests?status=IN_PROGRESS' },
    { key: 'done', label: 'טופל', value: pipeline.resolved, href: '/requests?status=RESOLVED' },
  ]

  const max = Math.max(...stages.map((s) => s.value), 1)

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>צינור הפניות</CardTitle>
        <span className="text-xs text-content-faint">
          {pipeline.resolved + pipeline.dismissed + pipeline.open + pipeline.inProgress + pipeline.pendingReview} פניות
          מאז ההתחלה
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {stages.map((stage) => (
          <Link
            key={stage.key}
            href={stage.href}
            className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 rounded-md px-1 py-0.5 hover:bg-surface-subtle"
          >
            <span
              className={
                stage.hot && stage.value > 0
                  ? 'text-sm font-semibold text-content-strong'
                  : 'text-sm text-content-muted'
              }
            >
              {stage.label}
            </span>
            <span className="block h-5 overflow-hidden rounded bg-surface-muted">
              {/* toneClass defines --t-mark; the inline background reads it and
                  beats the bare-tone rule, which would paint the pale surface -
                  invisible at 20px. Same pattern as the dashboard KPI icon. */}
              <span
                className={`block h-full rounded ${toneClass[stage.hot && stage.value > 0 ? 'caution' : 'neutral']}`}
                style={{
                  width: `${Math.max((stage.value / max) * 100, stage.value > 0 ? 4 : 0)}%`,
                  backgroundColor: 'hsl(var(--t-mark))',
                  opacity: stage.hot && stage.value > 0 ? 1 : 0.45,
                }}
              />
            </span>
            <span className="text-end text-sm font-bold tabular-nums text-content-strong">
              {stage.value}
            </span>
          </Link>
        ))}
        <p className="pt-1 text-xs text-content-faint">
          הרוחב הוא הכמות. הצבע שמור לשלב שדורש פעולה ממך.
        </p>
      </CardContent>
    </Card>
  )
}
