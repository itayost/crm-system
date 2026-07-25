import { z } from 'zod'
import { requestType } from './enums'

/**
 * The shape of a support ticket before it becomes prose.
 *
 * The agent's job is to fill these in - mostly from what the client already said
 * in a voice note or a screen recording - and to ask only for what is still
 * empty. Every field is nullable on purpose: "not known yet" is the normal state
 * for most of a conversation, and a null is what tells the agent to ask.
 */

export const intakeFrequency = z.enum(['ALWAYS', 'SOMETIMES', 'ONCE'])

export const intakeSchema = z.object({
  /** Screen, page or area, in the client's own words. */
  where: z.string().nullable(),
  /** What the client observed. */
  whatHappened: z.string().nullable(),
  /** What they expected instead. */
  expected: z.string().nullable(),
  frequency: intakeFrequency.nullable(),
  /** Whether it used to work. Separates a regression from something never built. */
  workedBefore: z.boolean().nullable(),
  /** Whether it blocks them right now. Feeds the request priority. */
  blocking: z.boolean().nullable(),
  /** For a change request: the outcome they are after. */
  goal: z.string().nullable(),
  /** For a change request: how they manage today. */
  today: z.string().nullable(),
  /**
   * The agent's read of what kind of request this is. A hint for Itay only -
   * the client is never asked, and Request.type stays his decision.
   */
  suggestedType: requestType.nullable(),
})

export type Intake = z.infer<typeof intakeSchema>

export const EMPTY_INTAKE: Intake = {
  where: null,
  whatHappened: null,
  expected: null,
  frequency: null,
  workedBefore: null,
  blocking: null,
  goal: null,
  today: null,
  suggestedType: null,
}

/**
 * Which question set applies. Derived from the agent's read, never from a
 * question put to the client.
 */
export type IntakeKind = 'broken' | 'change' | 'question'

export function intakeKind(intake: Intake): IntakeKind {
  switch (intake.suggestedType) {
    case 'QUESTION':
      return 'question'
    case 'IMPROVEMENT':
    case 'REQUEST':
      return 'change'
    default:
      // BUG, OTHER, or nothing decided yet. Something-is-broken is both the most
      // common case and the one whose questions are hardest to recover later.
      return 'broken'
  }
}

const REQUIRED_BY_KIND: Record<IntakeKind, Array<keyof Intake>> = {
  broken: ['where', 'whatHappened', 'expected'],
  change: ['goal', 'today'],
  question: [],
}

export interface MissingFieldsOptions {
  /** A consultation has no screens, so "where" is meaningless for it. */
  skipWhere?: boolean
}

/** The required fields still empty. An empty array means a summary can be proposed. */
export function missingIntakeFields(
  intake: Intake,
  { skipWhere = false }: MissingFieldsOptions = {}
): Array<keyof Intake> {
  const required = REQUIRED_BY_KIND[intakeKind(intake)]

  return required.filter((field) => {
    if (field === 'where' && skipWhere) return false
    const value = intake[field]
    return value === null || value === undefined || value === ''
  })
}

/** Later messages fill earlier gaps; a known value is never overwritten with null. */
export function mergeIntake(base: Intake, incoming: Partial<Intake> | null): Intake {
  if (!incoming) return base

  const merged = { ...base }
  for (const key of Object.keys(base) as Array<keyof Intake>) {
    const value = incoming[key]
    if (value !== null && value !== undefined && value !== '') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(merged as any)[key] = value
    }
  }
  return merged
}

/** Stored JSON is data, not a contract: anything that no longer parses is dropped. */
export function readIntake(value: unknown): Intake {
  const parsed = intakeSchema.safeParse(value)
  return parsed.success ? parsed.data : EMPTY_INTAKE
}

export const INTAKE_FIELD_LABELS: Record<keyof Intake, string> = {
  where: 'איפה',
  whatHappened: 'מה קרה',
  expected: 'מה ציפית שיקרה',
  frequency: 'תדירות',
  workedBefore: 'עבד קודם',
  blocking: 'חוסם עכשיו',
  goal: 'מה רוצים להשיג',
  today: 'איך זה עובד היום',
  suggestedType: 'הצעת הסוכן',
}

export const INTAKE_FREQUENCY_LABELS: Record<z.infer<typeof intakeFrequency>, string> = {
  ALWAYS: 'תמיד',
  SOMETIMES: 'לפעמים',
  ONCE: 'קרה פעם אחת',
}
