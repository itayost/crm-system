'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'

import { StatusPill } from '@/components/ui/status-pill'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RequestRecord } from '@/lib/types/request'

/** Whole days since the quote went out. */
function daysWaiting(quotedAt: string | null): number {
  if (!quotedAt) return 0
  const sent = new Date(quotedAt).getTime()
  if (Number.isNaN(sent)) return 0
  return Math.max(0, Math.floor((Date.now() - sent) / 86_400_000))
}

/**
 * Quotes the client has not answered.
 *
 * Its own card rather than a filter you have to remember to apply, for the same
 * reason PendingReviewCard is: this is the queue that turns into money, and a
 * quote nobody chased is indistinguishable from a quote nobody sent. Sorted
 * longest-wait first, because that is the one worth a phone call.
 */
export function AwaitingClientCard({ awaiting }: { awaiting: RequestRecord[] }) {
  if (awaiting.length === 0) return null

  const sorted = [...awaiting].sort(
    (a, b) => new Date(a.quotedAt ?? 0).getTime() - new Date(b.quotedAt ?? 0).getTime(),
  )

  return (
    <Card className="border-tone-caution-mark/40 bg-tone-caution-surface/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-tone-caution-foreground">
          <Clock className="w-5 h-5" />
          ממתין לתשובת הלקוח ({awaiting.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((request) => {
            const days = daysWaiting(request.quotedAt)

            return (
              <div
                key={request.id}
                className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-white"
              >
                <div className="flex-1">
                  <Link
                    href={`/requests/${request.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {request.title}
                  </Link>
                  <p className="text-xs text-content-subtle mt-1">
                    {request.client?.name ?? '-'}
                    {' · נשלחה ב'}
                    <bdi>{formatDate(request.quotedAt)}</bdi>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">
                    <bdi>{formatCurrency(request.quotedPrice)}</bdi>
                  </span>
                  {days >= 3 && (
                    <StatusPill tone="warning" emphasis="outline">
                      <bdi>{days}</bdi> ימים
                    </StatusPill>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
