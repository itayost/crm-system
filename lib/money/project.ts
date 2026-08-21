/**
 * The project-scoped surface of the ledger.
 *
 * These three names predate the ledger module and are used at 25 call sites,
 * six of them in the browser. They keep their exact signatures and defer every
 * decision to ./ledger, so per-project figures and owner-wide figures cannot
 * drift apart. projectOutstanding stays deliberately narrower than
 * collectable(): see לתשלום in CONTEXT.md.
 */
import {
  agreed,
  entriesOf,
  received,
  signedOffUnpaid,
  type Money,
  type PhaseAmount,
} from '@/lib/money/ledger'

export type { Money, PhaseAmount }

/** Everything the client has agreed to pay: the advance plus every phase. */
export function projectTotal(advance: Money, phases: PhaseAmount[] = []): number {
  return agreed(entriesOf(advance, null, phases))
}

/**
 * Money actually received. Payment is tracked separately from approval - an
 * approved phase is finished work, not a settled invoice.
 */
export function projectPaid(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
  phases: PhaseAmount[] = [],
): number {
  return received(entriesOf(advance, advancePaidAt, phases))
}

/** Work signed off but not paid for. Never the advance. */
export function projectOutstanding(phases: PhaseAmount[] = []): number {
  return signedOffUnpaid(entriesOf(null, null, phases))
}
