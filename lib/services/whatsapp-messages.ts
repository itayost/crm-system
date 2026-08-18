import { REQUEST_TYPE_LABELS } from '@/lib/design/labels'

/**
 * Hebrew copy for the messages the bot session sends on its own initiative.
 * Kept out of the route files so tests and future agent slices share one source.
 */

export const CLIENT_ACK_MESSAGE =
  'קיבלתי את ההודעה שלך. איתי יעבור עליה ויחזור אליך בהקדם.'

export const UNKNOWN_SENDER_HOLD_MESSAGE =
  'שלום! הגעת לקו השירות של איתי אוסטרייך. ההודעה שלך הועברה אליו והוא יחזור אליך בהקדם.'

export const PROCESSING_ERROR_MESSAGE = 'שגיאה בעיבוד ההודעה. נסה שוב.'

/**
 * First contact in a conversation. The client has just written to a number that
 * has never answered them before, and the next thing they see may be half a
 * minute of nothing while the agent reads the repo.
 */
export function greetingMessage(contactName: string): string {
  return `היי ${firstName(contactName)}! קיבלתי את ההודעה שלך, בודק את זה ואחזור אליך עוד רגע 🙏`
}

/** People are greeted the way a person would greet them, not by their full record. */
function firstName(contactName: string): string {
  return contactName.trim().split(/\s+/)[0]
}

/** "היי דנה, " when we know who is on the other side, plain "היי, " when we do not. */
function greeting(contactName: string | null): string {
  const name = contactName?.trim() ? firstName(contactName) : null
  return name ? `היי ${name}, ` : 'היי, '
}

/** Mid-conversation, when this particular turn is going to take a while. */
export const CHECKING_MESSAGE = 'רגע, בודק את זה ואחזור אליך.'

/** Stands in for a media-only message when only text makes sense. */
export const MEDIA_ONLY_PLACEHOLDER = '[הודעת מדיה ללא טקסט]'

/** The owner agent is text-only; say so rather than going quiet. */
export const OWNER_MEDIA_UNSUPPORTED_MESSAGE =
  'אני עדיין לא יודע לקרוא הודעות קוליות או קבצים בערוץ הזה. כתוב לי בטקסט.'

/** Sent to the client when Itay approves what they asked for. Dismissals stay silent. */
export function approvedRequestClientNotice(title: string): string {
  return `הבקשה שלך אושרה ונכנסה לתוכנית העבודה:\n*${title}*\n\nנעדכן אותך כשהיא תטופל.`
}

/**
 * The two updates a client actually wants: someone has started, and someone has
 * finished. Written the way Itay would write them himself, because as far as the
 * client is concerned that is who is typing.
 */
export function startedWorkClientNotice(contactName: string | null, title: string): string {
  return `${greeting(contactName)}רציתי לעדכן שהתחלתי לטפל בפנייה שלך בנושא *${title}*.\nאעדכן אותך כשאסיים 🔧`
}

export function resolvedRequestClientNotice(
  contactName: string | null,
  title: string,
  followUp: string = 'אם יש עוד משהו, אני כאן.',
): string {
  return `${greeting(contactName)}סיימתי לטפל בפנייה שלך בנושא *${title}* ✅\n${followUp}`
}

/**
 * Where to send a client who wants to answer back.
 *
 * Every one of these notices goes out from the bot number, and while the bot is
 * paused each inbound message on that session is dropped whole - it reaches
 * WhatsApp and nothing else. So "אני כאן" is not a nicety then, it is false:
 * the client replies, nobody hears it, and they conclude they were ignored.
 * The portal works in both states, so that is where a paused bot points them.
 */
export function replyInvitation(params: { paused: boolean; portalUrl: string | null }): string {
  if (!params.paused) return 'אם יש עוד משהו, אני כאן.'
  if (params.portalUrl) return `אם יש עוד משהו, אפשר לפתוח פנייה חדשה כאן:\n${params.portalUrl}`
  return 'אם יש עוד משהו, אפשר להתקשר אליי.'
}

/**
 * A quote is waiting. This message is what makes the portal work at all - a
 * price nobody knows about is a price nobody answers, and the client has no
 * reason to open the link unprompted.
 *
 * The link goes in because it is where the אישור button lives; the amount goes
 * in because a client should be able to decide from the message alone.
 */
export function quoteSentClientNotice(params: {
  contactName: string | null
  title: string
  price: number
  estimateHours: number | null
  portalUrl: string
}): string {
  const { contactName, title, price, estimateHours, portalUrl } = params
  const effort = estimateHours ? `\nהיקף משוער: ${estimateHours} שעות` : ''

  return (
    `${greeting(contactName)}הכנתי הצעת מחיר לבקשה שלך בנושא *${title}*.` +
    `\n\nעלות: *${price.toLocaleString('he-IL')} ₪*${effort}` +
    `\n\nאפשר לאשר או לחזור אליי כאן:\n${portalUrl}` +
    `\n\nלא מתחיל לעבוד על זה לפני שתאשר.`
  )
}

/** Itay's own line. The client answered, and the answer decides what happens next. */
export function clientDecisionOwnerNotice(params: {
  clientName: string
  title: string
  decision: 'APPROVED' | 'DECLINED'
  price: number | null
  note: string | null
  /**
   * A live Task on work the client just refused to pay for. Reachable whenever
   * the request was approved before it was classified, which is the default
   * habit - the gate only bites when billingKind is set first. Nothing is
   * cancelled automatically; this line exists so the decision stays Itay's and
   * the task does not quietly stay on the list.
   */
  openTaskTitle?: string | null
}): string {
  const { clientName, title, decision, price, note, openTaskTitle } = params
  const amount = price ? ` (${price.toLocaleString('he-IL')} ₪)` : ''
  const reason = note ? `\nהערה: ${note}` : ''

  if (decision === 'APPROVED') {
    return `${clientName} אישר את ההצעה לבקשה *${title}*${amount}.\nנוצרו שלב חיוב ומשימה.${reason}`
  }

  const openTask = openTaskTitle
    ? `\n\n⚠️ יש משימה פתוחה על העבודה הזו: *${openTaskTitle}*.\nהיא לא בוטלה - תחליט אם לבטל אותה או לשלוח הצעה מתוקנת.`
    : ''

  return `${clientName} לא אישר את ההצעה לבקשה *${title}*${amount}.${reason}${openTask}`
}

/**
 * Itay's line when a client answers on a delivered phase.
 *
 * An approval is not just good news - it is the moment the amount becomes an
 * invoice worth chasing, so the message says so rather than leaving him to
 * infer it from a dashboard number that moved.
 */
export function phaseReviewOwnerNotice(params: {
  clientName: string
  projectName: string
  phaseName: string
  price: number
  decision: 'APPROVED' | 'REVISIONS'
  note: string | null
}): string {
  const { clientName, projectName, phaseName, price, decision, note } = params
  const amount = price > 0 ? ` (${price.toLocaleString('he-IL')} ₪)` : ''
  const where = `*${phaseName}*${amount}\nבפרויקט ${projectName}`

  if (decision === 'APPROVED') {
    return `✅ ${clientName} אישר את השלב:\n${where}\n\nהשלב עבר לתשלום.`
  }

  return `🔄 ${clientName} ביקש תיקון בשלב:\n${where}\n\n"${note ?? ''}"`
}

interface FiledRequestNoticeParams {
  clientName: string
  contactName: string
  projectName?: string | null
  title: string
  description?: string | null
  type: string
  priority: string
  /** Filed after the reminder window expired, without the client ever agreeing. */
  unconfirmed?: boolean
}

/** First nudge after a few hours of silence on a summary awaiting confirmation. */
export function firstConfirmationReminder(title: string): string {
  return `היי, רק מוודא: רשמתי את הבקשה שלך כ*${title}*.\nזה מדויק? אשמח לאישור כדי להעביר את זה לאיתי.`
}

/** Second and last nudge, a day later. */
export function secondConfirmationReminder(title: string): string {
  return `תזכורת אחרונה בנוגע לבקשה *${title}*.\nאם זה מדויק, כתוב לי "כן" ואעביר את זה לאיתי. אם לא, ספר לי מה לתקן.`
}

// Not the shared PRIORITY_LABELS from lib/design/labels: these agree in gender
// with עדיפות for the client-facing WhatsApp message ("עדיפות גבוהה").
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוכה',
  MEDIUM: 'רגילה',
  HIGH: 'גבוהה',
  URGENT: 'דחופה',
}

export function filedRequestOwnerNotice({
  clientName,
  contactName,
  projectName,
  title,
  description,
  type,
  priority,
  unconfirmed = false,
}: FiledRequestNoticeParams): string {
  const lines = [
    unconfirmed ? '*בקשה חדשה - הלקוח לא אישר את הסיכום*' : '*בקשה חדשה ממתינה לאישור*',
    '',
    `*לקוח:* ${clientName} (${contactName})`,
  ]

  if (projectName) lines.push(`*פרויקט:* ${projectName}`)

  lines.push(
    `*סוג:* ${REQUEST_TYPE_LABELS[type] ?? type}`,
    `*עדיפות:* ${PRIORITY_LABELS[priority] ?? priority}`,
    '',
    `*${title}*`
  )

  if (description) lines.push(description)

  return lines.join('\n')
}

interface DegradedTurnNoticeParams {
  contactName: string
  clientName: string
  snippet: string
}

/**
 * Sent to Itay on every turn the support agent could not run (gateway outage).
 * The client got a receipt but nothing was filed - this is the handoff.
 */
export function degradedTurnOwnerNotice({
  contactName,
  clientName,
  snippet,
}: DegradedTurnNoticeParams): string {
  return [
    '⚠️ *הבוט במצב חירום (תקלת AI Gateway)*',
    '',
    `עניתי ל-${contactName} (${clientName}) בתשובה מוגבלת ולא נפתחה פנייה.`,
    `ההודעה: "${snippet.slice(0, 120)}"`,
    '',
    'צריך טיפול ידני.',
  ].join('\n')
}

interface UnknownSenderNoticeParams {
  phone: string | null
  chatId: string
  contactName?: string | null
  message: string
}

export function unknownSenderOwnerNotice({
  phone,
  chatId,
  contactName,
  message,
}: UnknownSenderNoticeParams): string {
  const lines = [
    '*פנייה חדשה לבוט*',
    '',
    `*טלפון:* ${phone ?? chatId}`,
  ]

  if (contactName) {
    lines.push(`*ליד קיים:* ${contactName}`)
  } else {
    lines.push('*לא מזוהה במערכת*')
  }

  lines.push('', '*ההודעה:*', message)

  return lines.join('\n')
}
