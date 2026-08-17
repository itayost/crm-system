import { JourneyRail } from '@/components/portal/journey-rail'
import { PortalCard, PortalSection } from '@/components/portal/portal-page'
import { DecisionPanel } from '@/components/portal/decision-panel'
import type { ClientRequestView } from '@/lib/services/client-view'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * The money moment.
 *
 * This used to be a card two thirds of the way down a request page, under the
 * description and the details list. A client opens this surface from a WhatsApp
 * message that says "I prepared a quote" and arrives to answer exactly one
 * question, so when a quote is outstanding the quote *is* the page: price
 * first, what they get, what happens after they say yes, and the two buttons
 * pinned above the fold.
 *
 * It deliberately does not get its own route. Quote notices already deep-link to
 * /r/{token}/{requestId} and those links are sitting in clients' WhatsApp
 * history; making this the awaiting mode of that page puts the answer in front
 * of them without an extra tap and without breaking a link we already sent.
 */
export function QuoteDecision({ request, token }: { request: ClientRequestView; token: string }) {
  if (!request.quotedAt) return null

  if (request.awaitingDecision) {
    return (
      <div className="flex flex-col gap-6">
        <PortalCard className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-portal-2xs text-content-muted">עלות</span>
              <span className="font-display text-[2.125rem] font-medium leading-none tabular-nums text-content-strong">
                <bdi>{formatCurrency(request.quotedPrice)}</bdi>
              </span>
            </div>
            {request.estimateHours != null && (
              <span className="pb-1 text-portal-xs text-content-muted">
                היקף משוער
                <br />
                <bdi className="font-mono font-semibold tabular-nums text-content-body">
                  {request.estimateHours}
                </bdi>{' '}
                שעות
              </span>
            )}
          </div>

          {request.description && (
            <>
              <hr className="border-border" />
              <div className="flex flex-col gap-1.5">
                <h2 className="text-portal-sm font-semibold text-content-strong">מה זה כולל</h2>
                <p className="whitespace-pre-wrap text-portal-sm text-content-body">
                  {request.description}
                </p>
              </div>
            </>
          )}
        </PortalCard>

        {/* The same ghosted-future device as the timeline, used before there is
            any past to show. It answers "what am I agreeing to" with the shape
            of the work rather than with more prose. */}
        <PortalSection heading="מה קורה אחרי שתאשרו">
          <div className="rounded-lg bg-surface-subtle p-4">
            <JourneyRail
              steps={[
                { key: 'plan', title: 'נכנס לתוכנית העבודה', state: 'ahead' },
                { key: 'dev', title: 'בפיתוח — נעדכן אותך כשנתחיל', state: 'ahead' },
                { key: 'deliver', title: 'נמסר לבדיקה שלך', state: 'ahead' },
              ]}
            />
          </div>
          {/* Says the thing the phase model actually guarantees: approving a
              quote creates a billing phase born NOT_STARTED, and nothing is due
              until the work is signed off. */}
          <p className="text-portal-xs text-content-muted">
            התשלום נכנס כשלב בפרויקט ומשולם בסיום העבודה.
          </p>
        </PortalSection>

        <DecisionPanel token={token} requestId={request.id} />
      </div>
    )
  }

  const approved = request.decision === 'APPROVED'

  return (
    <PortalCard
      className={
        approved ? 'border-tone-success-mark/40 bg-tone-success-surface/40 shadow-none' : 'shadow-none'
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-portal-2xs text-content-muted">הצעת מחיר</span>
        <span className="font-display text-portal-title font-medium tabular-nums text-content-strong">
          <bdi>{formatCurrency(request.quotedPrice)}</bdi>
        </span>
        <span className="text-portal-xs text-content-muted">
          {approved ? 'אושרה על ידך ב' : 'לא אושרה ב'}
          <bdi>{formatDate(request.decidedAt)}</bdi>
        </span>
        {/* The decline note deliberately does not repeat here. It rides the
            timeline's `decided` event instead, where it is dated and sits in
            the story - printing it in both places puts the same paragraph on
            one screen twice. */}
      </div>
    </PortalCard>
  )
}
