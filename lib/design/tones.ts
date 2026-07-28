/**
 * What every status in this CRM looks like, decided once.
 *
 * These maps used to live inline in eight page files, which is why "urgent" was
 * one red on the tasks screen and a slightly different red on projects, and why
 * priority badges used a -700 foreground while contact statuses used -800.
 *
 * A tone is a semantic name, not a colour. The colour lives in globals.css and
 * can be changed there for the whole product at once.
 */

export type Tone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'caution'
  | 'danger'
  | 'accent'
  | 'progress'

export const toneClass: Record<Tone, string> = {
  neutral: 'tone-neutral',
  info: 'tone-info',
  success: 'tone-success',
  warning: 'tone-warning',
  caution: 'tone-caution',
  danger: 'tone-danger',
  accent: 'tone-accent',
  progress: 'tone-progress',
}

/** Rising urgency: quiet, ordinary, notable, critical. */
export const PRIORITY_TONES: Record<string, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}

/**
 * A lead warming up towards being a client, then going quiet.
 *
 * The pipeline reads as rising heat - info, caution, accent, warning - so a
 * row's colour tells you how close the deal is without reading the label.
 * The two endings are deliberately opposite: LOST is danger (a deal that got
 * away), INACTIVE is neutral (a client who simply stopped buying).
 */
export const CONTACT_STATUS_TONES: Record<string, Tone> = {
  NEW: 'info',
  CONTACTED: 'caution',
  MEETING_SCHEDULED: 'accent',
  QUOTED: 'warning',
  CLIENT: 'success',
  LOST: 'danger',
  INACTIVE: 'neutral',
}

export const PROJECT_STATUS_TONES: Record<string, Tone> = {
  ACTIVE: 'success',
  COMPLETED: 'neutral',
}

export const TASK_STATUS_TONES: Record<string, Tone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

export const TASK_CATEGORY_TONES: Record<string, Tone> = {
  CLIENT_WORK: 'info',
  MARKETING: 'accent',
  LEAD_FOLLOWUP: 'warning',
  ADMIN: 'neutral',
}

export const REQUEST_TYPE_TONES: Record<string, Tone> = {
  REQUEST: 'info',
  BUG: 'danger',
  IMPROVEMENT: 'accent',
  QUESTION: 'caution',
  OTHER: 'neutral',
}

export const REQUEST_STATUS_TONES: Record<string, Tone> = {
  PENDING_REVIEW: 'caution',
  OPEN: 'info',
  IN_PROGRESS: 'progress',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
}

export const REQUEST_SOURCE_TONES: Record<string, Tone> = {
  WHATSAPP: 'success',
  FORM: 'info',
  EMAIL: 'accent',
  MANUAL: 'neutral',
  OTHER: 'neutral',
}

/** Falls back to neutral so an unmapped value is plain rather than invisible. */
export function tone(map: Record<string, Tone>, value: string | null | undefined): string {
  return toneClass[map[value ?? ''] ?? 'neutral']
}
