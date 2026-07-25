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
