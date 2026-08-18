import { z } from 'zod'
import { phaseStatus } from './enums'

export const createPhaseSchema = z.object({
  name: z.string().min(1, 'שם שלב חובה'),
  // Zero is a real answer - a phase can be bundled into another one's price.
  price: z.number().min(0).default(0),
})

export const updatePhaseSchema = z.object({
  name: z.string().min(1, 'שם שלב חובה').optional(),
  price: z.number().min(0).optional(),
  status: phaseStatus.optional(),
  // Payment is its own verb. Approving a phase does not pay for it, and
  // un-approving it does not claw the money back.
  paid: z.boolean().optional(),
  // Reordering comes through the same PUT rather than a separate endpoint,
  // because it is still "change this phase".
  move: z.enum(['UP', 'DOWN']).optional(),
})

export type CreatePhaseInput = z.infer<typeof createPhaseSchema>
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>

/**
 * The client's answer on a delivered phase.
 *
 * Separate from updatePhaseSchema for the same reason sendQuoteSchema is
 * separate from updateRequestSchema: this transition moves money - an approved
 * phase is what projectOutstanding() counts as an invoice worth chasing - and
 * it must not be reachable through a generic update path.
 *
 * The note is required on a revision request and forbidden nowhere else. "Needs
 * changes" with no explanation is not a message, it is a bounce, and the whole
 * content of the action is what has to change.
 */
export const phaseReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REVISIONS']),
    note: z.string().max(1000).optional(),
  })
  .refine((value) => value.decision !== 'REVISIONS' || !!value.note?.trim(), {
    message: 'צריך לכתוב מה לתקן',
    path: ['note'],
  })

export type PhaseReviewInput = z.infer<typeof phaseReviewSchema>
