/**
 * What a project is worth, what has been paid for it, and what is owed.
 *
 * A project used to have one `price`, so "revenue" could only mean "sum of
 * price on completed projects" - a project half delivered and half paid
 * contributed nothing. Money now lives on the phases, and these three
 * functions are the only place that knows how to add it up, so the dashboard,
 * the project page, the list and the WhatsApp agent cannot disagree.
 *
 * Amounts arrive as strings whenever they have been through JSON, because
 * that is what a Prisma Decimal serialises to. Pure and dependency-free on
 * purpose: server services and client components both import this.
 */

/**
 * A Prisma Decimal on the server, the string JSON turned it into on the
 * client, or a plain number. Structurally typed rather than importing
 * Prisma.Decimal, so this module stays safe to import from a client component.
 */
interface DecimalLike {
  toFixed(digits?: number): string
}

export type Money = number | string | DecimalLike | null | undefined

export interface PhaseAmount {
  price: Money
  status?: string
  paidAt?: string | Date | null
}

function amount(value: Money): number {
  if (value == null) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

const sum = (values: Money[]) => values.reduce<number>((total, v) => total + amount(v), 0)

/** Everything the client has agreed to pay: the advance plus every phase. */
export function projectTotal(advance: Money, phases: PhaseAmount[] = []): number {
  return amount(advance) + sum(phases.map((p) => p.price))
}

/**
 * Money actually received. Payment is tracked separately from approval - an
 * approved phase is finished work, not a settled invoice - so this counts
 * paidAt, never status.
 */
export function projectPaid(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
  phases: PhaseAmount[] = []
): number {
  const advancePart = advancePaidAt ? amount(advance) : 0
  return advancePart + sum(phases.filter((p) => p.paidAt).map((p) => p.price))
}

/** Work signed off but not yet paid for - the invoices worth chasing. */
export function projectOutstanding(phases: PhaseAmount[] = []): number {
  return sum(phases.filter((p) => p.status === 'APPROVED' && !p.paidAt).map((p) => p.price))
}
