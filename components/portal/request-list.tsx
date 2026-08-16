import Link from 'next/link'

import { ClientStatePill, BillingPill } from './client-state-pill'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ClientRequestView } from '@/lib/services/client-view'

/**
 * The client's own requests.
 *
 * Every amount and date is wrapped in <bdi>. They are LTR runs of digits and
 * punctuation dropped into RTL Hebrew, and without isolation the bidi algorithm
 * reorders them - "1,200 ₪" renders with the shekel on the wrong side and a
 * date can come out backwards. This is the one place in the product where money
 * sits inside a Hebrew sentence, so it is the one place that needs it.
 */
export function PortalRequestList({
  token,
  requests,
}: {
  token: string
  requests: ClientRequestView[]
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="font-medium text-content-strong">עדיין אין פניות</p>
        <p className="mt-1 text-sm text-content-muted">
          כל בקשה שתשלחו תופיע כאן, עם הסטטוס שלה.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            href={`/r/${token}/${request.id}`}
            className="block rounded-lg border border-border p-4 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-content-strong">{request.title}</span>
              <ClientStatePill state={request.clientStatus} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-muted">
              {request.projectName && <span>{request.projectName}</span>}
              <BillingPill billingKind={request.billingKind} />
              <bdi>{formatDate(request.openedAt)}</bdi>
            </div>

            {request.awaitingDecision && request.quotedPrice != null && (
              <p className="mt-2 text-sm font-medium text-content-strong">
                <bdi>{formatCurrency(request.quotedPrice)}</bdi>
                {request.estimateHours != null && (
                  <span className="font-normal text-content-muted">
                    {' · '}
                    <bdi>{request.estimateHours}</bdi> שעות
                  </span>
                )}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
