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
