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
