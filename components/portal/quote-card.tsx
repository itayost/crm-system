import { DecisionPanel } from './decision-panel'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ClientRequestView } from '@/lib/services/client-view'

/**
 * The price, and the decision it is waiting for.
 *
 * Three states, and the card only exists in the first place once a quote has
 * gone out: waiting on the client, they approved, they said no. The tinted
 * surfaces use the semantic tone custom properties, never a raw palette shade -
 * tests/design-tones.test.ts fails the build on the latter.
 */
export function QuoteCard({ request, token }: { request: ClientRequestView; token: string }) {
  if (!request.quotedAt) return null

  const price = <bdi className="font-semibold">{formatCurrency(request.quotedPrice)}</bdi>

  if (request.awaitingDecision) {
    return (
      <section className="rounded-lg border border-tone-caution-mark/40 bg-tone-caution-surface/40 p-5">
        <h2 className="font-semibold text-content-strong">הצעת מחיר</h2>

        <p className="mt-3 text-2xl text-content-strong">{price}</p>
        {request.estimateHours != null && (
          <p className="mt-1 text-sm text-content-muted">
            היקף משוער: <bdi>{request.estimateHours}</bdi> שעות
          </p>
        )}

        <p className="mt-4 text-sm text-content-muted">
          לא מתחילים לעבוד על זה לפני שתאשרו.
        </p>

        <div className="mt-4">
          <DecisionPanel token={token} requestId={request.id} />
        </div>
      </section>
    )
  }

  const approved = request.decision === 'APPROVED'

  return (
    <section
      className={
        approved
          ? 'rounded-lg border border-tone-success-mark/40 bg-tone-success-surface/40 p-5'
          : 'rounded-lg border border-border p-5'
      }
    >
      <h2 className="font-semibold text-content-strong">הצעת מחיר</h2>
      <p className="mt-3 text-2xl text-content-strong">{price}</p>
      <p className="mt-2 text-sm text-content-muted">
        {approved ? 'אושרה על ידך ב' : 'לא אושרה ב'}
        <bdi>{formatDate(request.decidedAt)}</bdi>
      </p>
    </section>
  )
}
