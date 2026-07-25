/**
 * Hebrew copy for the messages the bot session sends on its own initiative.
 * Kept out of the route files so tests and future agent slices share one source.
 */

export const CLIENT_ACK_MESSAGE =
  'קיבלתי את ההודעה שלך. איתי יעבור עליה ויחזור אליך בהקדם.'

export const UNKNOWN_SENDER_HOLD_MESSAGE =
  'שלום! הגעת לקו השירות של איתי אוסטרייך. ההודעה שלך הועברה אליו והוא יחזור אליך בהקדם.'

export const PROCESSING_ERROR_MESSAGE = 'שגיאה בעיבוד ההודעה. נסה שוב.'

/** Stands in for a media-only message when only text makes sense. */
export const MEDIA_ONLY_PLACEHOLDER = '[הודעת מדיה ללא טקסט]'

/** The owner agent is text-only; say so rather than going quiet. */
export const OWNER_MEDIA_UNSUPPORTED_MESSAGE =
  'אני עדיין לא יודע לקרוא הודעות קוליות או קבצים בערוץ הזה. כתוב לי בטקסט.'

/** Sent to the client when Itay approves what they asked for. Dismissals stay silent. */
export function approvedRequestClientNotice(title: string): string {
  return `הבקשה שלך אושרה ונכנסה לתוכנית העבודה:\n*${title}*\n\nנעדכן אותך כשהיא תטופל.`
}

interface FiledRequestNoticeParams {
  clientName: string
  contactName: string
  projectName?: string | null
  title: string
  description?: string | null
  type: string
  priority: string
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  REQUEST: 'בקשה',
  BUG: 'תקלה',
  IMPROVEMENT: 'שיפור',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

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
}: FiledRequestNoticeParams): string {
  const lines = [
    '*בקשה חדשה ממתינה לאישור*',
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
