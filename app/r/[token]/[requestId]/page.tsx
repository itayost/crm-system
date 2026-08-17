import Link from 'next/link'

import { AttachmentGrid } from '@/components/portal/attachment-grid'
import { ClientStatePill, BillingPill } from '@/components/portal/client-state-pill'
import { IntakePlayback } from '@/components/portal/intake-playback'
import { JourneyRail, timelineSteps } from '@/components/portal/journey-rail'
import { PortalBack, PortalSection, PortalTitle } from '@/components/portal/portal-page'
import { QuoteDecision } from '@/components/portal/quote-decision'
import { buildClientTimeline, getClientRequest } from '@/lib/services/client-view'
import { whatsappLink } from '@/lib/portal/whatsapp-link'

export const dynamic = 'force-dynamic'

/**
 * One request, still scoped by the token.
 *
 * getClientRequest queries `where: { id, client: { formToken: token } }`, so a
 * request id belonging to another client resolves to nothing and lands on the
 * same "not found" screen as a typo. Identical output for both is deliberate:
 * a different message would confirm which ids exist.
 *
 * The page has two modes. When a quote is outstanding the decision is the
 * spine - price, scope, what happens next, and the buttons - and the history
 * moves below it. Otherwise the journey rail leads, because the question a
 * client arrives with then is "is this moving?" rather than "what do I owe?".
 */
export default async function PortalRequestPage({
  params,
}: {
  params: Promise<{ token: string; requestId: string }>
}) {
  const { token, requestId } = await params
  const request = await getClientRequest(token, requestId)

  if (!request) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
        <PortalTitle>הפנייה לא נמצאה</PortalTitle>
        <Link
          href={`/r/${token}/requests`}
          className="text-portal-sm font-semibold text-link underline underline-offset-4"
        >
          חזרה לפניות שלך
        </Link>
      </div>
    )
  }

  const deciding = request.awaitingDecision
  const timeline = buildClientTimeline(request)
  const whatsapp = whatsappLink()

  return (
    <div className="flex flex-col gap-7">
      <PortalBack href={`/r/${token}/requests`}>חזרה לפניות שלך</PortalBack>

      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <ClientStatePill state={request.clientStatus} />
          <BillingPill billingKind={request.billingKind} />
        </div>
        <PortalTitle>{request.title}</PortalTitle>
      </header>

      <QuoteDecision request={request} token={token} />

      {/* The description is the quote's scope while a quote is open, so
          QuoteDecision has already shown it. Repeating it here would be the same
          paragraph twice on one screen. */}
      {!deciding && request.description && (
        <PortalSection heading="מה ביקשתם">
          <p className="whitespace-pre-wrap text-portal-sm text-content-body">
            {request.description}
          </p>
        </PortalSection>
      )}

      {!deciding && (
        <PortalSection heading="איפה זה עומד">
          <div className="rounded-lg border p-4">
            <JourneyRail steps={timelineSteps(timeline)} />
          </div>
        </PortalSection>
      )}

      {request.intake.length > 0 && (
        <PortalSection heading="כך הבנתי אותך">
          <IntakePlayback answers={request.intake} />
          <p className="text-portal-xs text-content-muted">
            משהו כאן לא מדויק? כתבו לנו והפנייה תתעדכן.
          </p>
        </PortalSection>
      )}

      {request.attachments.length > 0 && (
        <PortalSection heading="קבצים שצירפת">
          <AttachmentGrid token={token} requestId={request.id} attachments={request.attachments} />
        </PortalSection>
      )}

      {/* The conversation already lives in WhatsApp. A deep link back to it
          beats a comment thread the client would have to learn and check. */}
      {whatsapp && (
        <p className="text-portal-xs text-content-muted">
          יש שאלה על הפנייה הזו?{' '}
          <a
            href={whatsapp}
            className="font-semibold text-link underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            אפשר לכתוב לנו בוואטסאפ
          </a>
          .
        </p>
      )}
    </div>
  )
}
