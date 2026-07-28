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
