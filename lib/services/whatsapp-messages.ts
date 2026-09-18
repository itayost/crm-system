/**
 * Hebrew copy for the WhatsApp notices the CRM sends on its own initiative -
 * quote sent, work started/finished, and the owner notices for a client's
 * decision on a quote or a phase. Kept out of the service files so tests and
 * `requests.service.ts` / `phases.service.ts` share one source.
 *
 * No session listens on the other end: WhatsApp survives here only as an
 * outbound pipe (see docs/adr/0004-the-crm-has-no-ai.md).
 */

/** People are greeted the way a person would greet them, not by their full record. */
function firstName(contactName: string): string {
  return contactName.trim().split(/\s+/)[0]
}

/** "היי דנה, " when we know who is on the other side, plain "היי, " when we do not. */
function greeting(contactName: string | null): string {
  const name = contactName?.trim() ? firstName(contactName) : null
  return name ? `היי ${name}, ` : 'היי, '
}

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
  followUp: string,
): string {
  return `${greeting(contactName)}סיימתי לטפל בפנייה שלך בנושא *${title}* ✅\n${followUp}`
}

/**
 * Where to send a client who wants to answer back.
 *
 * There is no bot listening on any WhatsApp number, so "אני כאן" would be a
 * promise nobody keeps - the client replies, nobody hears it, and they
 * conclude they were ignored. The portal is always the correct answer.
 */
export function replyInvitation(portalUrl: string | null): string {
  if (portalUrl) return `אם יש עוד משהו, אפשר לפתוח פנייה חדשה כאן:\n${portalUrl}`
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
