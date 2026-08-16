'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import api from '@/lib/api/client'
import { REQUEST_BILLING_LABELS, label } from '@/lib/design/labels'
import { REQUEST_BILLING_TONES, toneOf } from '@/lib/design/tones'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RequestBilling, RequestRecord } from '@/lib/types/request'

const KINDS: RequestBilling[] = ['INCLUDED', 'BILLABLE', 'WARRANTY', 'QUOTE_REQUIRED']

/** The two that cannot become work until the client has agreed to a price. */
/**
 * Both of these gate the work item until the client agrees. Only BILLABLE
 * carries a number, though - QUOTE_REQUIRED is "chargeable, not priced yet",
 * which is exactly the state a big unscoped job sits in before you have
 * scoped it.
 */
const GATED: RequestBilling[] = ['BILLABLE', 'QUOTE_REQUIRED']

/**
 * How this request gets paid for, and the quote the client answered.
 *
 * Sits above the description on the detail page because, for anything the
 * client has to pay for, this is the decision the screen exists to support:
 * until it is answered, approving the request creates no task.
 */
export function CommercialCard({
  request,
  onChanged,
}: {
  request: RequestRecord
  onChanged: () => void
}) {
  const [kind, setKind] = useState<RequestBilling | ''>(request.billingKind ?? '')
  const [price, setPrice] = useState(request.quotedPrice ?? '')
  const [hours, setHours] = useState(request.estimateHours ?? '')
  const [saving, setSaving] = useState(false)
  const [unreachable, setUnreachable] = useState(false)

  const awaiting = !!request.quotedAt && !request.clientDecisionAt
  const decided = !!request.clientDecisionAt
  // Only an approval closes the price. A decline is an answer, not an ending -
  // "יקר מדי" is exactly the moment to re-quote, and sendQuote supports it, so
  // the form has to stay on screen for it.
  const locked = request.clientDecision === 'APPROVED'
  const gated = GATED.includes(kind as RequestBilling)
  const priced = kind === 'BILLABLE'

  const send = async () => {
    if (!kind) return
    setSaving(true)
    setUnreachable(false)
    try {
      const { data } = await api.post(`/requests/${request.id}/quote`, {
        billingKind: kind,
        estimateHours: hours || undefined,
        quotedPrice: price || undefined,
      })

      // notified:false means there is no WhatsApp chat to reach them on, so
      // saying "נשלח" would be a lie. Tell Itay to send the link himself.
      // The route replies with the request itself - createResponse does not
      // wrap anything in a `data` envelope, so there is no second hop here.
      if (priced && data?.notified === false) setUnreachable(true)

      toast.success(priced ? 'ההצעה נשלחה' : 'הסיווג נשמר')
      onChanged()
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'שגיאה בשמירת ההצעה'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>חיוב והצעת מחיר</CardTitle>
        {request.billingKind && (
          <StatusPill tone={toneOf(REQUEST_BILLING_TONES, request.billingKind)} dot>
            {label(REQUEST_BILLING_LABELS, request.billingKind)}
          </StatusPill>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {decided ? (
          <DecisionSummary request={request} onChanged={onChanged} />
        ) : awaiting ? (
          <AwaitingSummary request={request} />
        ) : null}

        {!locked && (
          <>
            <div>
              <p className="mb-2 text-sm text-content-muted">
                {decided ? 'הצעה חדשה' : 'איך זה מחויב?'}
              </p>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={kind === option ? 'default' : 'outline'}
                    onClick={() => setKind(option)}
                  >
                    {label(REQUEST_BILLING_LABELS, option)}
                  </Button>
                ))}
              </div>
            </div>

            {priced && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-content-muted" htmlFor="quoted-price">
                    מחיר (₪)
                  </label>
                  <Input
                    id="quoted-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-content-muted" htmlFor="estimate-hours">
                    היקף משוער (שעות)
                  </label>
                  <Input
                    id="estimate-hours"
                    inputMode="decimal"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>
            )}

            {priced && !request.projectId && (
              <p className="text-sm text-tone-caution-foreground">
                יש לשייך את הפניה לפרויקט לפני שליחת הצעת מחיר. שלב החיוב נוצר על הפרויקט.
              </p>
            )}

            {/* The state a big unscoped job sits in: it already blocks work,
                but there is nothing to send yet. Saying so is what stops it
                looking like a quote that failed to go out. */}
            {gated && !priced && (
              <p className="text-sm text-content-muted">
                לא ייווצרו משימות עד שתישלח הצעת מחיר ותאושר. אחרי שתתמחר, שנו ל&quot;בתשלום&quot;.
              </p>
            )}

            <Button type="button" onClick={send} disabled={!kind || saving}>
              {saving ? 'שומר...' : priced ? 'שלח הצעת מחיר ללקוח' : 'שמור סיווג'}
            </Button>

            {unreachable && (
              <p className="text-sm text-tone-caution-foreground">
                ההצעה נשמרה אבל לא נשלחה בוואטסאפ - אין ללקוח שיחה פעילה. העתיקו את קישור הפניות
                שלו מעמוד הלקוח ושלחו ידנית.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AwaitingSummary({ request }: { request: RequestRecord }) {
  return (
    <div className="rounded-lg border border-tone-caution-mark/40 bg-tone-caution-surface/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-content-strong">
          <bdi>{formatCurrency(request.quotedPrice)}</bdi>
        </span>
        <StatusPill tone="caution" emphasis="solid" dot>
          ממתין לתשובת הלקוח
        </StatusPill>
      </div>
      <p className="mt-1 text-sm text-content-muted">
        נשלחה ב<bdi>{formatDate(request.quotedAt)}</bdi>
        {request.estimateHours && (
          <>
            {' · '}
            <bdi>{request.estimateHours}</bdi> שעות
          </>
        )}
      </p>
    </div>
  )
}

function DecisionSummary({
  request,
  onChanged,
}: {
  request: RequestRecord
  onChanged: () => void
}) {
  const approved = request.clientDecision === 'APPROVED'
  const [cancelling, setCancelling] = useState(false)

  // Work still on the list for something the client just refused to pay for.
  // Reachable whenever the request was approved before it was classified, which
  // is the ordinary habit - the gate only bites when billingKind is set first.
  const liveTask =
    !approved && request.task && ['TODO', 'IN_PROGRESS'].includes(request.task.status)
      ? request.task
      : null

  const cancelTask = async () => {
    if (!liveTask) return
    setCancelling(true)
    try {
      await api.put(`/tasks/${liveTask.id}`, { status: 'CANCELLED' })
      toast.success('המשימה בוטלה')
      onChanged()
    } catch {
      toast.error('שגיאה בביטול המשימה')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div
      className={
        approved
          ? 'rounded-lg border border-tone-success-mark/40 bg-tone-success-surface/40 p-4'
          : 'rounded-lg border border-tone-danger-mark/40 bg-tone-danger-surface/40 p-4'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-content-strong">
          <bdi>{formatCurrency(request.quotedPrice)}</bdi>
        </span>
        <StatusPill tone={approved ? 'success' : 'danger'} dot>
          {approved ? 'הלקוח אישר' : 'הלקוח לא אישר'}
        </StatusPill>
      </div>

      <p className="mt-1 text-sm text-content-muted">
        <bdi>{formatDate(request.clientDecisionAt)}</bdi>
        {approved && request.phaseId && ' · נוצר שלב חיוב על הפרויקט'}
      </p>

      {request.clientDecisionNote && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-content-strong">
          {request.clientDecisionNote}
        </p>
      )}

      {approved && !request.phaseId && (
        <p className="mt-2 text-sm text-tone-danger-foreground">
          הלקוח אישר אך לא נוצר שלב חיוב - הפניה אינה משויכת לפרויקט. שייכו אותה לפרויקט כדי
          שהכסף ייספר.
        </p>
      )}

      {/* Deliberately not cancelled for you. The work may be half done, or the
          decline may be the opening of a negotiation rather than the end of
          one - both are calls only Itay can make. Surfacing it beats both
          silence and an automatic cancel. */}
      {liveTask && (
        <div className="mt-3 border-t border-tone-danger-mark/30 pt-3">
          <p className="text-sm text-content-strong">
            יש משימה פתוחה על העבודה הזו: <strong>{liveTask.title}</strong>
          </p>
          <p className="mt-1 text-sm text-content-muted">
            היא לא בוטלה. אפשר לבטל אותה, או לשלוח הצעה מתוקנת.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={cancelling}
            onClick={cancelTask}
          >
            {cancelling ? 'מבטל...' : 'בטל משימה'}
          </Button>
        </div>
      )}
    </div>
  )
}
