import { z } from 'zod'

/**
 * Enum shapes shared by more than one validation module.
 *
 * They live here rather than in request.ts because the intake schema needs them
 * too, and request.ts needs the intake schema - importing across those two
 * directly is a cycle, and the loser of the cycle resolves to undefined at
 * module init.
 */

export const requestType = z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER'])
export const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

export const requestStatus = z.enum([
  'PENDING_REVIEW',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'DISMISSED',
])

export const requestSource = z.enum(['WHATSAPP', 'MANUAL', 'EMAIL', 'FORM', 'OTHER'])

export const contactStatus = z.enum([
  'NEW',
  'CONTACTED',
  'MEETING_SCHEDULED',
  'QUOTED',
  'CLIENT',
  'LOST',
  'INACTIVE',
])

export const contactSource = z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER'])

/**
 * The lead pipeline, in the order a lead actually moves through it.
 *
 * LOST is deliberately absent. It is a terminal lead state, not a stage, and
 * the לידים tab is meant to answer "what do I still have to chase" - a dead
 * lead in that list is noise, and in the "לידים בצנרת" KPI it is a lie.
 * LOST leads stay visible under "הכל" and through the status filter.
 */
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'QUOTED'] as const

export const CLIENT_STATUSES = ['CLIENT', 'INACTIVE'] as const

/** No next action survives these - the chasing is over, won or lost. */
export const TERMINAL_CONTACT_STATUSES = ['CLIENT', 'LOST', 'INACTIVE'] as const

/**
 * A billing phase's life. Not a straight line: PENDING_APPROVAL and REVISIONS
 * cycle for as long as the client keeps finding things, which is why the UI
 * offers a Select rather than a "next stage" button.
 */
export const phaseStatus = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_APPROVAL',
  'REVISIONS',
  'APPROVED',
])
