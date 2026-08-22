import { defineState } from 'eve/context'
import {
  SupportConversationService,
  type PendingDraft,
} from '@/lib/services/support-conversation.service'
import type { SupportToolContext } from '@/lib/services/support-tools'
import type { TurnCell } from '@/lib/services/support-turn-cell'
import { readIdentity, type AuthCarrier } from './identity'

/**
 * The turn-local state the support tools share.
 *
 * On the AI SDK path this lived in two closure bindings inside
 * `createSupportTools`, which works because every tool is built once per turn
 * inside one function call. eve builds tools from separate modules, so the
 * bindings have nowhere to live and this durable slot stands in for them.
 *
 * `defineState` does not reset between turns - it is session-scoped and this
 * session lasts as long as the WhatsApp conversation - so the slot records
 * which turn it was seeded for and reseeds when that changes.
 */
interface SupportTurnState {
  turnId: string
  /** The summary this turn may file; null once a re-proposal revoked it. */
  confirmable: PendingDraft | null
  /** The wording the client demonstrably read. Frozen for the turn. */
  seenByClient: PendingDraft | null
  /** Asks already spent on this unfiled request, snapshotted at turn start. */
  confirmationRounds: number
  filed: boolean
  repoFired: boolean
}

const supportTurn = defineState<SupportTurnState>('crm.support.turn', () => ({
  turnId: '',
  confirmable: null,
  seenByClient: null,
  confirmationRounds: 0,
  filed: false,
  repoFired: false,
}))

export interface SupportTurnRuntime {
  context: SupportToolContext
  /** Set when a ticket was filed this turn; read after the turn settles. */
  wasFiled(): boolean
  /** Set when any repo tool ran; drives the findings GC. */
  didSearchRepo(): boolean
}

/**
 * Builds the tool context for the current turn, seeding the shared state from
 * the conversation the first time it is asked for within that turn.
 *
 * Returns null when this is not a support turn, so tools fail closed rather than
 * running with an empty identity.
 */
export async function supportRuntime(
  ctx: AuthCarrier & { session: { turn: { id: string } } }
): Promise<SupportTurnRuntime | null> {
  const identity = readIdentity(ctx)
  if (!identity) return null

  const conversationContext = {
    chatId: identity.chatId,
    clientId: identity.clientId,
    contactId: identity.contactId,
    userId: identity.userId,
  }

  const turnId = ctx.session.turn.id
  if (supportTurn.get().turnId !== turnId) {
    // The draft as it stood when this turn began. A draft already on the
    // conversation is one the client has seen, which is the only thing that
    // makes their message a confirmation of it.
    const conversation = await SupportConversationService.open(conversationContext)
    supportTurn.update(() => ({
      turnId,
      confirmable: conversation.pendingDraft,
      seenByClient: conversation.pendingDraft,
      confirmationRounds: conversation.confirmationRounds ?? 0,
      filed: false,
      repoFired: false,
    }))
  }

  const turnCell: TurnCell = {
    getConfirmable: () => supportTurn.get().confirmable,
    setConfirmable: (next) => supportTurn.update((s) => ({ ...s, confirmable: next })),
    getSeenByClient: () => supportTurn.get().seenByClient,
  }

  // `filingActivity` is the mutable object the AI SDK path passes through so the
  // post-turn safety net can see whether anything was filed. Mirroring writes to
  // it into durable state keeps that signal available after the turn settles.
  const filingActivity = {
    get filed() {
      return supportTurn.get().filed
    },
    set filed(next: boolean) {
      supportTurn.update((s) => ({ ...s, filed: next }))
    },
  }

  return {
    context: {
      ...identity,
      turnCell,
      filingActivity,
      confirmationRounds: supportTurn.get().confirmationRounds,
    },
    wasFiled: () => supportTurn.get().filed,
    didSearchRepo: () => supportTurn.get().repoFired,
  }
}

/** Repo tools report through this so the findings GC can run after the turn. */
export function markRepoSearched(): void {
  supportTurn.update((s) => ({ ...s, repoFired: true }))
}
