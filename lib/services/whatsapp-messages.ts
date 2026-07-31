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

export function resolvedRequestClientNotice(contactName: string | null, title: string): string {
  return `${greeting(contactName)}סיימתי לטפל בפנייה שלך בנושא *${title}* ✅\nאם יש עוד משהו, אני כאן.`
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
