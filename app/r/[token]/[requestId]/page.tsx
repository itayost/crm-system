import Link from 'next/link'

import { ClientStatePill, BillingPill } from '@/components/portal/client-state-pill'
import { QuoteCard } from '@/components/portal/quote-card'
import { PortalAttachments } from '@/components/portal/portal-attachments'
import { getClientRequest } from '@/lib/services/client-view'
import { REQUEST_TYPE_LABELS, label } from '@/lib/design/labels'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * One request, still scoped by the token.
 *
 * getClientRequest queries `where: { id, client: { formToken: token } }`, so a
 * request id belonging to another client resolves to nothing and lands on the
 * same "not found" screen as a typo. Identical output for both is deliberate:
 * a different message would confirm which ids exist.
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-content-strong">הפנייה לא נמצאה</h1>
          <Link href={`/r/${token}/requests`} className="mt-3 inline-block text-sm underline">
            חזרה לפניות שלך
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Link href={`/r/${token}/requests`} className="text-sm text-content-muted underline">
        חזרה לפניות שלך
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-content-strong">{request.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ClientStatePill state={request.clientStatus} />
          <BillingPill billingKind={request.billingKind} />
        </div>
      </header>

      <div className="space-y-6">
        <QuoteCard request={request} token={token} />

        {request.description && (
          <section>
            <h2 className="mb-2 font-semibold text-content-strong">מה ביקשתם</h2>
            <p className="whitespace-pre-wrap text-content-muted">{request.description}</p>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-semibold text-content-strong">פרטים</h2>
          <dl className="space-y-1 text-sm">
            <Row term="נפתחה" value={<bdi>{formatDate(request.openedAt)}</bdi>} />
            <Row term="סוג" value={label(REQUEST_TYPE_LABELS, request.type)} />
            {request.projectName && <Row term="פרויקט" value={request.projectName} />}
            {request.resolvedAt && (
              <Row term="הושלמה" value={<bdi>{formatDate(request.resolvedAt)}</bdi>} />
            )}
          </dl>
        </section>

        <PortalAttachments
          token={token}
          requestId={request.id}
          count={request.attachmentCount}
        />

        {/* The conversation already lives in WhatsApp. A deep link back to it
            beats a comment thread the client would have to learn and check.
            Rendered only when there is a number to link to. */}
        {whatsappLink() && (
          <p className="text-sm text-content-muted">
            יש שאלה על הפנייה הזו?{' '}
            <a href={whatsappLink()!} className="underline" target="_blank" rel="noreferrer">
              אפשר לכתוב לנו בוואטסאפ
            </a>
            .
          </p>
        )}
      </div>
    </>
  )
}

/**
 * The business WhatsApp number as a wa.me link, or nothing.
 *
 * Read server-side per render rather than baked into a NEXT_PUBLIC_ var: this
 * page is force-dynamic, so there is no build-time inlining to gain, and the
 * number stays out of the client bundle for every other page in the app.
 */
function whatsappLink(): string | null {
  const raw = (process.env.OWNER_PHONE ?? '').replace(/\D/g, '')
  if (!raw) return null

  const international = raw.startsWith('0') ? `972${raw.slice(1)}` : raw
  return `https://wa.me/${international}`
}

function Row({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-content-muted">{term}:</dt>
      <dd className="text-content-strong">{value}</dd>
    </div>
  )
}
