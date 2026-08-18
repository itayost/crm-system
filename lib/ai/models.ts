/**
 * Every model id the app can reach, in one place.
 *
 * Model choice used to live in six services in three different shapes: an
 * env-overridable const, a hardcoded const with no override at all, and a
 * bare literal at the call site. The same gateway id was written out six
 * times, so changing the default meant editing six files, and four of those
 * sites could not be moved without a deploy.
 *
 * Note the roles rather than one shared default. They are not
 * interchangeable: media understanding needs a vision-capable model, so a
 * single flat default would quietly break image handling the first time
 * someone switched it.
 *
 * Every id here is an AI Gateway id except `local`, which names a model on
 * the VPS's Ollama and is resolved by resilient-model.ts.
 */

/** The workhorse for chat, extraction, and summarisation. */
const TEXT_DEFAULT = 'anthropic/claude-sonnet-4.6'
/** Cheap and vision-capable, which is the whole reason it differs. */
const VISION_DEFAULT = 'google/gemini-2.5-flash'
/** Small enough to answer on a CPU when the gateway is down. */
const LOCAL_DEFAULT = 'gemma4:e4b'

/**
 * Read at call time, never at import. A module-level constant would pin
 * whatever the environment held when the module first loaded, which ignores
 * `vi.stubEnv` in tests and pins values across them.
 */
function fromEnv(name: string, fallback: string): string {
  const configured = process.env[name]?.trim()
  return configured ? configured : fallback
}

export const models = {
  /** The WhatsApp support bot's conversational turn. */
  supportChat: () => fromEnv('SUPPORT_CHAT_MODEL', TEXT_DEFAULT),
  /** The outbound WhatsApp agent's tool-calling loop. */
  whatsappAgent: () => fromEnv('WHATSAPP_AGENT_MODEL', TEXT_DEFAULT),
  /** Pulls structured lead details out of a free-text intake. */
  intake: () => fromEnv('INTAKE_MODEL', TEXT_DEFAULT),
  /** Turns an inbound message into a structured request. */
  requestExtraction: () => fromEnv('REQUEST_EXTRACTION_MODEL', TEXT_DEFAULT),
  /** Writes the daily brief's next actions. */
  morningBrief: () => fromEnv('MORNING_BRIEF_MODEL', TEXT_DEFAULT),
  /** Composes a product card from catalogue data. */
  productCard: () => fromEnv('PRODUCT_CARD_MODEL', TEXT_DEFAULT),
  /**
   * Reads images and documents a customer sends. This role must stay
   * vision-capable; text-only models such as GLM 5.2 cannot serve it.
   */
  media: () => fromEnv('SUPPORT_MEDIA_MODEL', VISION_DEFAULT),
  /** The degraded local tier. An Ollama model name, not a gateway id. */
  local: () => fromEnv('OLLAMA_MODEL', LOCAL_DEFAULT),
} as const
