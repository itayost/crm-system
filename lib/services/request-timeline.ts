import type { Tone } from '@/lib/design/tones'
import type { RequestRecord } from '@/lib/types/request'

/**
 * A request's history, without a history table.
 *
 * There is no audit model in the schema and this does not need one: every
 * moment worth showing already has a column. createdAt, quotedAt,
 * clientDecisionAt and resolvedAt are the four the request itself records, and
 * the linked Task and billing phase supply the rest.
 *
 * The limit of the approach, stated plainly: these are the events the data can
 * prove, not every event that happened. A status moved to IN_PROGRESS and back
 * leaves no trace, because nothing stores it. If that ever matters, it wants a
 * real event table - but for the story a client or a future reader needs, the
 * columns are enough, and a pure function over them cannot drift out of sync
 * with the row it describes.
 */

export interface TimelineEvent {
  key: string
  label: string
  at: string
  tone: Tone
  /** Not yet reached. Rendered as an outline, so the shape of what's left reads. */
  future?: boolean
  note?: string
}

export function buildTimeline(request: RequestRecord): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    key: 'created',
    label: 'הפניה נפתחה',
    at: request.createdAt,
    tone: 'info',
    note: request.isAiGenerated ? 'נוצרה אוטומטית מהודעה' : undefined,
  })

  if (request.billingKind) {
    events.push({
      key: 'classified',
      label: billingLabel(request.billingKind),
      // No column records when the classification happened, and inventing one
      // would be a lie. updatedAt is the closest honest anchor.
      at: request.updatedAt,
      tone: 'neutral',
    })
  }

  if (request.quotedAt) {
    events.push({
      key: 'quoted',
      label: 'הצעת מחיר נשלחה ללקוח',
      at: request.quotedAt,
      tone: 'caution',
    })
  }

  if (request.clientDecisionAt) {
    const approved = request.clientDecision === 'APPROVED'
    events.push({
      key: 'decided',
      label: approved ? 'הלקוח אישר' : 'הלקוח לא אישר',
      at: request.clientDecisionAt,
      tone: approved ? 'success' : 'danger',
      note: request.clientDecisionNote ?? undefined,
    })
  }

  if (request.task) {
    events.push({
      key: 'task',
      label: 'נוצרה משימה',
      at: request.updatedAt,
      tone: 'progress',
      note: request.task.title,
    })
  }

  if (request.resolvedAt) {
    events.push({
      key: 'resolved',
      label: 'טופל',
      at: request.resolvedAt,
      tone: 'success',
    })
  }

  return [...events, ...remaining(request)]
}

/**
 * What has not happened yet, so the page shows the shape of the rest rather
 * than stopping dead at the last thing that did.
 */
function remaining(request: RequestRecord): TimelineEvent[] {
  if (request.resolvedAt || request.status === 'DISMISSED') return []

  const pending: TimelineEvent[] = []
  const chargeable =
    request.billingKind === 'BILLABLE' || request.billingKind === 'QUOTE_REQUIRED'

  if (chargeable && !request.quotedAt) {
    pending.push({ key: 'to-quote', label: 'לשלוח הצעת מחיר', at: '', tone: 'caution', future: true })
  }
  if (chargeable && request.quotedAt && !request.clientDecisionAt) {
    pending.push({ key: 'to-decide', label: 'הלקוח מאשר', at: '', tone: 'caution', future: true })
  }
  if (!request.task) {
    pending.push({ key: 'to-task', label: 'נוצרת משימה', at: '', tone: 'neutral', future: true })
  }

  pending.push({ key: 'to-resolve', label: 'טופל', at: '', tone: 'neutral', future: true })

  return pending
}

function billingLabel(kind: string): string {
  const map: Record<string, string> = {
    INCLUDED: 'סווג ככלול בתחזוקה',
    BILLABLE: 'סווג כבתשלום',
    WARRANTY: 'סווג כבאחריות',
    QUOTE_REQUIRED: 'סווג כדורש הצעת מחיר',
  }
  return map[kind] ?? 'סווג לחיוב'
}
