import Link from 'next/link'

import { ClientStatePill } from './client-state-pill'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { ClientRequestView, ClientStatus } from '@/lib/services/client-view'

/**
 * The client's own requests, grouped by whose turn it is.
 *
 * One flat list of forty-four sorted by date answers "what did I ask for" and
 * not "what needs me", which is the question someone opens this page holding.
 * Three groups instead, and the first is usually empty - which is itself the
 * answer.
 *
 * Every amount and date is wrapped in <bdi>. They are LTR runs of digits and
 * punctuation dropped into RTL Hebrew, and without isolation the bidi algorithm
 * reorders them - "1,200 ₪" renders with the shekel on the wrong side and a
 * date can come out backwards.
 */
const GROUPS: Array<{ key: string; heading: string; statuses: ClientStatus[] }> = [
  { key: 'you', heading: 'ממתין לך', statuses: ['AWAITING_YOU'] },
  { key: 'open', heading: 'בעבודה', statuses: ['RECEIVED', 'SCHEDULED', 'IN_PROGRESS'] },
  { key: 'closed', heading: 'הושלם', statuses: ['DONE', 'DECLINED'] },
]

/**
 * What happens next, in one sentence.
 *
 * A status chip tells a client which bucket their request is in; it does not
 * tell them whether anyone is going to do anything. These do, and they are
 * deliberately promises we can keep - "we will let you know when we finish" is
 * true because resolving a request sends a WhatsApp message.
 */
const NEXT: Record<ClientStatus, string> = {
  AWAITING_YOU: 'ממתין לאישור שלך.',
  RECEIVED: 'התקבלה. נעבור עליה ונחזור אליך.',
  SCHEDULED: 'בתור. נעדכן אותך כשנתחיל.',
  IN_PROGRESS: 'בעבודה עכשיו. נעדכן אותך כשנסיים.',
  DONE: '',
  DECLINED: 'לא אושרה. אפשר לחזור לזה בכל שלב.',
}

export function PortalRequestList({
  token,
  requests,
}: {
  token: string
  requests: ClientRequestView[]
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-portal-base font-semibold text-content-strong">עדיין אין פניות</p>
        <p className="mt-1 text-portal-sm text-content-muted">
          כל בקשה שתשלחו תופיע כאן, עם הסטטוס שלה.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map((group) => {
        const rows = requests.filter((r) => group.statuses.includes(r.clientStatus))
        if (rows.length === 0) return null

        return (
          <section key={group.key} className="flex flex-col gap-2.5">
            <h2 className="flex items-center gap-2.5 text-portal-2xs font-semibold text-content-muted">
              {group.heading}
              <span aria-hidden className="h-px flex-1 bg-border" />
            </h2>

            <ul className="flex flex-col gap-2.5">
              {rows.map((request) => (
                <li key={request.id}>
                  <RequestCard token={token} request={request} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function RequestCard({ token, request }: { token: string; request: ClientRequestView }) {
  const awaiting = request.clientStatus === 'AWAITING_YOU'
  const closed = request.clientStatus === 'DONE' || request.clientStatus === 'DECLINED'

  return (
    <Link
      href={`/r/${token}/${request.id}`}
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border p-4 transition-colors duration-fast',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        // Exactly one group is tinted, and it is the one holding something the
        // client has to do. Tinting more would make the tint mean nothing.
        awaiting
          ? 'border-tone-caution-mark/45 bg-tone-caution-surface/40 hover:bg-tone-caution-surface/60'
          : closed
            ? 'bg-transparent hover:bg-surface-subtle'
            : 'bg-card shadow-e1 hover:bg-surface-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-portal-base font-semibold',
            closed ? 'text-content-body' : 'text-content-strong',
          )}
        >
          {request.title}
        </span>
        <ClientStatePill state={request.clientStatus} />
      </div>

      {closed ? (
        <span className="text-portal-xs text-content-muted">
          <bdi>{formatDate(request.resolvedAt ?? request.decidedAt ?? request.openedAt)}</bdi>
        </span>
      ) : (
        <span className="text-portal-xs text-content-muted">
          {awaiting && request.quotedPrice != null ? (
            <>
              הצעת מחיר על{' '}
              <bdi className="font-mono font-semibold tabular-nums text-content-strong">
                {formatCurrency(request.quotedPrice)}
              </bdi>{' '}
              — {NEXT[request.clientStatus]}
            </>
          ) : (
            NEXT[request.clientStatus]
          )}
        </span>
      )}
    </Link>
  )
}
