'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toneClass } from '@/lib/design/tones'
import { buildTimeline } from '@/lib/services/request-timeline'
import type { RequestRecord } from '@/lib/types/request'
import { formatDate } from '@/lib/utils'

/**
 * The life of one request.
 *
 * Derived, not stored - see lib/services/request-timeline.ts for what that can
 * and cannot show. Future steps are drawn as dashed outlines so the page ends
 * with what is left to do rather than with the last thing that happened.
 */
export function RequestTimeline({ request }: { request: RequestRecord }) {
  const events = buildTimeline(request)

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>ציר זמן</CardTitle>
        <span className="text-xs text-content-faint">נגזר מהתאריכים של הפניה</span>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {events.map((event, i) => (
            <li key={event.key} className="relative grid grid-cols-[1.5rem_1fr] gap-3 pb-4 last:pb-0">
              {i < events.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-6 bottom-0 right-[0.7rem] w-px bg-border"
                />
              )}

              <span
                className={
                  event.future
                    ? 'z-10 flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border bg-background'
                    : `z-10 flex h-6 w-6 items-center justify-center rounded-full ${toneClass[event.tone]}`
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: event.future ? 'transparent' : 'hsl(var(--t-mark))' }}
                />
              </span>

              <span className="min-w-0">
                <span
                  className={
                    event.future
                      ? 'block text-sm text-content-faint'
                      : 'block text-sm font-medium text-content-strong'
                  }
                >
                  {event.label}
                </span>
                <span className="block text-xs text-content-faint">
                  {event.at ? <bdi>{formatDate(event.at)}</bdi> : 'טרם קרה'}
                  {event.note ? ` · ${event.note}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
