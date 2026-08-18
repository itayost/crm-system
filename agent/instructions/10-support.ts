import { defineDynamic, defineInstructions } from 'eve/instructions'

/**
 * The client-facing support persona, for turns that arrive over WhatsApp.
 *
 * The prompt itself is not composed here. `buildSystemPrompt` in the CRM builds
 * it per turn and the channel carries it, so this resolver only hands it over.
 * That is deliberate and load-bearing: the prompt's own comment explains that
 * client-dictated text must never be interpolated into a system prompt, and a
 * resolver that assembled anything here would be a second place for that rule
 * to be got wrong.
 *
 * Returns null on any turn that did not come through the WhatsApp channel, so a
 * session Itay opens from the terminal never gets a client persona.
 */
export default defineDynamic({
  events: {
    'turn.started': (_event, ctx) => {
      const prompt = supportPromptFrom(ctx.channel?.metadata)
      return prompt ? defineInstructions({ content: prompt, role: 'system' }) : null
    },
  },
})

/** The channel projects `systemPrompt`; anything else is not a support turn. */
export function supportPromptFrom(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null

  const value = (metadata as { systemPrompt?: unknown }).systemPrompt
  return typeof value === 'string' && value.trim() ? value : null
}
