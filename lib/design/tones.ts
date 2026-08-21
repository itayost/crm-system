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

import type { LedgerState } from '@/lib/money/ledger'

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

/**
 * How loudly a tone speaks. Orthogonal to which tone it is: danger is the same
 * red whether it marks a resolved bug or an overdue payment, but only one of
 * them is allowed to shout.
 *
 *   solid   - the exception. At most one per row, usually none.
 *   soft    - the primary signal. The column you scan.
 *   outline - elevated, not critical.
 *   quiet   - metadata. A dot and plain body text, no chip.
 *
 * A row with four soft pills says the same as a row with none, which is the
 * problem this axis exists to solve.
 */
export type Emphasis = 'solid' | 'soft' | 'outline' | 'quiet'

/**
 * Priority is an exception column, not a category column. MEDIUM is the modal
 * value, so giving it a chip turns the column into a wall of identical pills
 * that carries no information. Only HIGH and URGENT earn one.
 */
export const PRIORITY_EMPHASIS: Record<string, Emphasis> = {
  LOW: 'quiet',
  MEDIUM: 'quiet',
  HIGH: 'outline',
  URGENT: 'solid',
}

/** The support agent's own lifecycle. Had no colour at all before. */
export const AGENT_STATUS_TONES: Record<string, Tone> = {
  ACTIVE: 'success',
  PAUSED: 'caution',
  DISABLED: 'neutral',
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

/**
 * A billing phase. Only APPROVED is success - PENDING_APPROVAL and REVISIONS
 * are the two states where the ball is in someone else's court, and they read
 * as things to chase rather than things that went wrong.
 */
export const PHASE_STATUS_TONES: Record<string, Tone> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'progress',
  PENDING_APPROVAL: 'caution',
  REVISIONS: 'warning',
  APPROVED: 'success',
}

/**
 * Money is not a status: an unpaid invoice is not a success just because the
 * work behind it was approved. collectable is the one that wants attention.
 */
export const LEDGER_STATE_TONES: Record<LedgerState, Tone> = {
  scheduled: 'neutral',
  inProgress: 'progress',
  awaitingClient: 'caution',
  collectable: 'warning',
  paid: 'success',
}

export const TASK_STATUS_TONES: Record<string, Tone> = {
  TODO: 'neutral',
  // `progress`, not `info` - "in progress" now reads the same here as it does
  // on a request and on a billing phase, instead of being blue in one place
  // and indigo in the other two.
  IN_PROGRESS: 'progress',
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

/**
 * Who pays. Only BILLABLE is accent - it is the one that costs the client
 * money, and it should be the word their eye lands on. WARRANTY reads as
 * success because "we broke it, we fix it" is good news, not a warning.
 */
export const REQUEST_BILLING_TONES: Record<string, Tone> = {
  INCLUDED: 'info',
  BILLABLE: 'accent',
  WARRANTY: 'success',
  QUOTE_REQUIRED: 'caution',
}

/**
 * The client's view of a request, which follows a different lifecycle from the
 * internal one - see clientStatusOf() in lib/services/client-view.ts.
 *
 * AWAITING_YOU is `caution` for the same reason PHASE_STATUS_TONES makes
 * PENDING_APPROVAL caution: the ball is in someone else's court and it is a
 * thing to chase, not a thing that went wrong. IN_PROGRESS stays `progress` so
 * "in progress" is one colour here too.
 */
export const CLIENT_REQUEST_STATUS_TONES: Record<string, Tone> = {
  RECEIVED: 'info',
  SCHEDULED: 'neutral',
  AWAITING_YOU: 'caution',
  IN_PROGRESS: 'progress',
  DONE: 'success',
  DECLINED: 'neutral',
}

/**
 * The client's view of a billing phase. AWAITING_YOU is caution for the same
 * reason it is on a request: the ball is in their court.
 */
export const CLIENT_PHASE_STATUS_TONES: Record<string, Tone> = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'progress',
  AWAITING_YOU: 'caution',
  DONE: 'success',
  PAID: 'success',
}

/** Falls back to neutral so an unmapped value is plain rather than invisible. */
export function toneOf(map: Record<string, Tone>, value: string | null | undefined): Tone {
  return map[value ?? ''] ?? 'neutral'
}

/** Falls back to soft, which is what an un-triaged value should look like. */
export function emphasisOf(
  map: Record<string, Emphasis>,
  value: string | null | undefined,
): Emphasis {
  return map[value ?? ''] ?? 'soft'
}

/**
 * The class-name form, for the few elements that are not StatusPills.
 *
 * Prefer `<StatusPill tone={toneOf(MAP, value)} />` anywhere a pill will do:
 * the prop is checked against Tone, where this returns a bare string that
 * nothing verifies, and the pill cannot end up beside a competing background
 * utility the way a Badge could.
 */
export function tone(map: Record<string, Tone>, value: string | null | undefined): string {
  return toneClass[toneOf(map, value)]
}
