/**
 * Hebrew copy for the messages the bot session sends on its own initiative.
 * Kept out of the route files so tests and future agent slices share one source.
 */

export const CLIENT_ACK_MESSAGE =
  'קיבלתי את ההודעה שלך. איתי יעבור עליה ויחזור אליך בהקדם.'

export const UNKNOWN_SENDER_HOLD_MESSAGE =
  'שלום! הגעת לקו השירות של איתי אוסטרייך. ההודעה שלך הועברה אליו והוא יחזור אליך בהקדם.'

export const PROCESSING_ERROR_MESSAGE = 'שגיאה בעיבוד ההודעה. נסה שוב.'

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
