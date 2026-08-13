const OFF_VALUES = new Set(['', '0', 'false', 'off', 'no'])

/**
 * The pause switch for the client-facing WhatsApp bot.
 *
 * Read per request, like the webhook secret, so nothing warm keeps serving
 * clients after a deployment flipped it. What it stops is the bot talking to
 * anyone who is not Itay: the support turn and the follow-up reminders. The
 * owner agent and the morning brief stay up - pausing the bot is not the same
 * as losing your own line into the CRM.
 *
 * A paused turn is dropped whole: no reply, no archived message, and so no
 * ticket from the batch extraction either. Whatever a client sends while the
 * bot is paused reaches WhatsApp and nothing else.
 *
 * Anything other than a recognised "off" pauses, so a typo in the value leaves
 * the bot quiet rather than answering clients while its owner believes it is
 * stopped. To resume, remove the variable (or set it to 0) and redeploy.
 */
export function isBotPaused(): boolean {
  const value = (process.env.WHATSAPP_BOT_PAUSED ?? '').trim().toLowerCase()

  return !OFF_VALUES.has(value)
}
