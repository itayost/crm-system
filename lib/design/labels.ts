/**
 * What every enum in the request domain is called in Hebrew, decided once.
 *
 * These maps used to live inline in five files, which is why a BUG was 'תקלה'
 * on every dashboard screen but 'באג' in the morning brief. tones.ts already
 * settled the colour half of this problem; this file settles the words.
 *
 * Pure data on purpose - no 'use client', no zod, no prisma - so server
 * services (morning brief, WhatsApp messages) and client components can both
 * import it.
 */

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  REQUEST: 'בקשה',
  BUG: 'תקלה',
  IMPROVEMENT: 'שיפור',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'ממתין לאישור',
  OPEN: 'פתוח',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופל',
  DISMISSED: 'נדחה',
}

export const REQUEST_SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: 'וואטסאפ',
  MANUAL: 'ידני',
  EMAIL: 'אימייל',
  FORM: 'טופס',
  OTHER: 'אחר',
}

/**
 * How a request is paid for, phrased for the client rather than the books.
 *
 * 'בתשלום' beside a price is the whole point of the field: the moment a client
 * reads it, "אפשר להוסיף עוד פילטר?" stops being free by default.
 */
export const REQUEST_BILLING_LABELS: Record<string, string> = {
  INCLUDED: 'כלול בתחזוקה',
  BILLABLE: 'בתשלום',
  WARRANTY: 'באחריות',
  QUOTE_REQUIRED: 'דורש הצעת מחיר',
}

/**
 * What the client sees, which is not what the enum says.
 *
 * A client should never read 'ממתין לאישור' and wonder whose approval, nor see
 * 'נדחה' at all. These are derived by clientStatusOf() in lib/services/
 * client-view.ts from the internal status plus the quote fields, and they are
 * the only request words the portal and the support bot are allowed to use.
 */
export const CLIENT_REQUEST_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'התקבלה',
  SCHEDULED: 'ממתין לביצוע',
  AWAITING_YOU: 'ממתין לאישורך',
  IN_PROGRESS: 'בפיתוח',
  DONE: 'הושלם',
  DECLINED: 'לא אושר',
}

/**
 * The same six states as sentences, for WhatsApp.
 *
 * A chip in a table and a line in a chat want different lengths - 'התקבלה' is
 * right beside a row of other chips and curt on its own in a message. Two
 * renderings, one vocabulary: both are keyed by the ClientStatus that
 * clientStatusOf() derives, so the portal and the bot cannot describe the same
 * ticket as two different things.
 */
/**
 * A billing phase in the client's words.
 *
 * Not the PhaseStatus enum: 'אושר' there means Itay signed off delivered work,
 * and a phase born from an approved quote sits at NOT_STARTED. Showing the raw
 * enum would tell a client their work is finished because they agreed to pay
 * for it.
 */
export const CLIENT_PHASE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'ממתין לביצוע',
  IN_PROGRESS: 'בעבודה',
  /**
   * 'ממתין לבדיקה שלך', not 'ממתין לאישורך'.
   *
   * A phase in PENDING_APPROVAL or REVISIONS genuinely is waiting on the client
   * - but the portal has no phase-approval control anywhere, so the old wording
   * asked for something the page could not accept and left them hunting for a
   * button that does not exist. Only PhasesService.update can move a phase, and
   * building that as a client action would stamp approvedAt, which is what
   * projectOutstanding() counts as an invoice worth chasing - a money change
   * that deserves its own decision rather than a redesign's coattails.
   *
   * So the label says the true thing: we are asking you to look. The portal
   * pairs it with a way to reply, which is WhatsApp, where the conversation is.
   */
  AWAITING_YOU: 'ממתין לבדיקה שלך',
  DONE: 'הושלם',
  PAID: 'שולם',
}

export const CLIENT_REQUEST_STATUS_SENTENCES: Record<string, string> = {
  RECEIVED: 'התקבלה וממתינה לבדיקה של איתי',
  SCHEDULED: 'אושרה וממתינה לתורה',
  AWAITING_YOU: 'נשלחה אליך הצעת מחיר וממתינה לאישורך',
  IN_PROGRESS: 'בטיפול',
  DONE: 'טופלה',
  DECLINED: 'לא אושרה',
}

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  NEW: 'חדש',
  CONTACTED: 'נוצר קשר',
  MEETING_SCHEDULED: 'נקבעה פגישת אפיון',
  QUOTED: 'הוגשה הצעת מחיר',
  CLIENT: 'לקוח',
  LOST: 'אבוד',
  INACTIVE: 'לא פעיל',
}

export const CONTACT_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'אתר',
  PHONE: 'טלפון',
  WHATSAPP: 'וואטסאפ',
  REFERRAL: 'הפניה',
  OTHER: 'אחר',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  COMPLETED: 'הושלם',
}

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
}

export const RETENTION_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'חודשי',
  YEARLY: 'שנתי',
}

export const PHASE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'לא פעיל',
  IN_PROGRESS: 'בעבודה',
  PENDING_APPROVAL: 'ממתין לאישור לקוח',
  REVISIONS: 'סבב תיקונים',
  APPROVED: 'אושר',
}

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  CLIENT_WORK: 'עבודת לקוח',
  MARKETING: 'שיווק',
  LEAD_FOLLOWUP: 'מעקב לידים',
  ADMIN: 'מנהלה',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'לביצוע',
  IN_PROGRESS: 'בתהליך',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוך',
  MEDIUM: 'בינוני',
  HIGH: 'גבוה',
  URGENT: 'דחוף',
}

/** Falls back to the raw value so an unmapped enum is odd-looking, not blank. */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '-'
  return map[value] ?? value
}
