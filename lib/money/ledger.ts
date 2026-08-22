/**
 * What is owed, what arrived, and what the client agreed to pay.
 *
 * One module, because this question used to have four implementations that
 * agreed only because a test grepped their source for matching string
 * literals - and before that test existed, the כספים badge and the /money page
 * it links to disagreed by ₪3,000 in production.
 *
 * Pure and dependency-free on purpose: six of the nine surfaces that ask these
 * questions are client components computing from JSON. Nothing here may import
 * Prisma. The server-side loaders live in ./ledger.server.
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

export type LedgerKind = 'phase' | 'advance'

/**
 * Where one billable thing stands. Derived, never stored, and deliberately not
 * PhaseStatus: a מקדמה has no approval step, so it can never have one.
 */
export type LedgerState =
  | 'scheduled'
  | 'inProgress'
  | 'awaitingClient'
  | 'collectable'
  | 'paid'

export interface LedgerEntry {
  kind: LedgerKind
  state: LedgerState
  price: number
  paidAt: string | null
  /** Phases only. Null on an advance, which has no status to carry. */
  phaseStatus: string | null
}

function amount(value: Money): number {
  if (value == null) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

/**
 * REVISIONS is the owner's turn, not the client's, so it reads as work in
 * progress. The client is told the same thing by client-view.ts, and the two
 * must not diverge.
 */
const PHASE_STATE: Record<string, LedgerState> = {
  NOT_STARTED: 'scheduled',
  IN_PROGRESS: 'inProgress',
  REVISIONS: 'inProgress',
  PENDING_APPROVAL: 'awaitingClient',
  APPROVED: 'collectable',
}

export function phaseEntry(phase: PhaseAmount): LedgerEntry {
  const paidAt = iso(phase.paidAt)

  return {
    kind: 'phase',
    // Payment wins over status: an approved phase already settled is not owed.
    state: paidAt ? 'paid' : (PHASE_STATE[phase.status ?? ''] ?? 'scheduled'),
    price: amount(phase.price),
    paidAt,
    phaseStatus: phase.status ?? null,
  }
}

/**
 * A מקדמה is owed on signature rather than on sign-off, so an unpaid one is
 * collectable the moment the project exists. Returns null when there is no
 * advance, so callers never carry a zero row.
 */
export function advanceEntry(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
): LedgerEntry | null {
  const price = amount(advance)
  if (price <= 0) return null

  const paidAt = iso(advancePaidAt)

  return { kind: 'advance', state: paidAt ? 'paid' : 'collectable', price, paidAt, phaseStatus: null }
}

export function entriesOf(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
  phases: PhaseAmount[] = [],
): LedgerEntry[] {
  const advanceRow = advanceEntry(advance, advancePaidAt)
  const phaseRows = phases.map(phaseEntry)

  return advanceRow ? [advanceRow, ...phaseRows] : phaseRows
}

export const isCollectable = (entry: LedgerEntry): boolean => entry.state === 'collectable'
/** Work signed off and unpaid. Excludes the advance: see לתשלום in CONTEXT.md. */
export const isSignedOffUnpaid = (entry: LedgerEntry): boolean =>
  entry.kind === 'phase' && entry.state === 'collectable'
export const isAwaitingApproval = (entry: LedgerEntry): boolean => entry.state === 'awaitingClient'
export const isPaid = (entry: LedgerEntry): boolean => entry.state === 'paid'

const sum = (entries: LedgerEntry[]): number => entries.reduce((total, e) => total + e.price, 0)

/** גבייה: everything invoiceable right now, advances included. */
export function collectable(entries: LedgerEntry[]): number {
  return sum(entries.filter(isCollectable))
}

/** לתשלום: signed-off unpaid work on one project, advance excluded. */
export function signedOffUnpaid(entries: LedgerEntry[]): number {
  return sum(entries.filter(isSignedOffUnpaid))
}

export function awaitingApproval(entries: LedgerEntry[]): number {
  return sum(entries.filter(isAwaitingApproval))
}

/** Money that actually arrived. */
export function received(entries: LedgerEntry[]): number {
  return sum(entries.filter(isPaid))
}

/** Everything the client agreed to pay, whatever state it is in. */
export function agreed(entries: LedgerEntry[]): number {
  return sum(entries)
}

export function receivedSince(entries: LedgerEntry[], since: Date): number {
  return sum(entries.filter((e) => e.paidAt !== null && new Date(e.paidAt) >= since))
}
