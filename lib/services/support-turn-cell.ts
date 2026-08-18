import type { PendingDraft } from './support-conversation.service'

/**
 * Where a turn keeps "which summary may be filed".
 *
 * `createSupportTools` used to hold this in two closure bindings, which works
 * because the AI SDK builds every tool once per turn and the loop runs inside
 * one function call. eve builds tools from static modules instead, so there is
 * no closure for `proposeSummary` and `fileRequest` to share, and the rule that
 * a client must have seen a summary before it is filed would have nowhere to
 * live.
 *
 * Making the storage an interface keeps that rule in one place. The AI SDK path
 * backs it with the same two bindings as before, so its behaviour is unchanged;
 * the eve path backs it with durable session state seeded once per turn.
 */
export interface TurnCell {
  /** The summary this turn may file, or null once a re-proposal revoked it. */
  getConfirmable(): PendingDraft | null
  setConfirmable(next: PendingDraft | null): void
  /**
   * The wording the client demonstrably read. Frozen for the whole turn: it
   * survives a revocation, because it is what gets filed when a confirmation
   * exchange has to be ended.
   */
  getSeenByClient(): PendingDraft | null
}

/**
 * The original behaviour: both values live for exactly one `createSupportTools`
 * call, seeded from the draft as it stood when the turn began.
 */
export function inMemoryTurnCell(confirmableDraft: PendingDraft | null): TurnCell {
  let confirmable = confirmableDraft
  const seenByClient = confirmableDraft

  return {
    getConfirmable: () => confirmable,
    setConfirmable: (next) => {
      confirmable = next
    },
    getSeenByClient: () => seenByClient,
  }
}
