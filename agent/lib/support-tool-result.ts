/**
 * What a support tool returns when the turn is not a client conversation.
 *
 * Every one of these tools scopes its queries on ids that arrive on the
 * session's auth. Without them there is nothing to scope by, so the tool refuses
 * rather than running unscoped. That case should be unreachable in practice -
 * the tools only exist for turns the WhatsApp channel started - which is exactly
 * why it must fail loudly rather than return something plausible.
 */
export const NOT_A_SUPPORT_TURN = {
  success: false,
  reason: 'not_a_support_turn',
  message: 'This tool is only available on a client support conversation.',
} as const
