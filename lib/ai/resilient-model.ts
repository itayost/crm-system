import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { GatewayError } from '@ai-sdk/gateway'
import type { LanguageModel } from 'ai'
import { models } from './models'

/**
 * The lifeline: a small local model on the VPS behind the AI Gateway.
 *
 * The gateway is one shared dependency for every model call in the system,
 * and it has one failure mode that takes all of them down at once (a zero
 * credit balance rejects every request, BYOK included). The support bot must
 * degrade instead of dying: gateway first, the VPS's Ollama second, canned
 * copy last. The same runner flips direction for background work that should
 * run locally by default.
 *
 * Everything here is env-gated: with OLLAMA_BASE_URL unset, the local tier
 * silently steps aside and the chain still works (gateway -> canned).
 */

/** Ollama on a CPU is slow; the degraded reply gets this long and no longer. */
export const DEGRADED_TIMEOUT_MS = 120_000
/** One WhatsApp paragraph. The degraded reply must not ramble. */
export const DEGRADED_MAX_OUTPUT_TOKENS = 200

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_API_KEY)
}

/**
 * The local model, or null when the endpoint is not configured. Rebuilt per
 * call on purpose: it is cheap, and a lazy singleton would pin env values
 * across tests.
 */
export function ollamaModel(): LanguageModel | null {
  if (!isOllamaConfigured()) return null
  const provider = createOpenAICompatible({
    name: 'ollama',
    // Must include the /v1 suffix - Ollama's OpenAI-compatible surface.
    baseURL: process.env.OLLAMA_BASE_URL!,
    apiKey: process.env.OLLAMA_API_KEY,
  })
  return provider(models.local())
}

/**
 * Two-tier runner. Catches everything from the primary - for user-facing
 * work every failure deserves degradation, not discrimination by error type.
 */
export async function withModelFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  onFallback?: (error: unknown) => void
): Promise<T> {
  try {
    return await primary()
  } catch (error) {
    onFallback?.(error)
    return fallback()
  }
}

/** For logs: name the gateway failure class instead of dumping the object. */
export function describeModelError(error: unknown): string {
  if (GatewayError?.isInstance?.(error)) {
    const gatewayError = error as InstanceType<typeof GatewayError>
    return `${gatewayError.name} (${gatewayError.statusCode}): ${gatewayError.message}`
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

const DEGRADED_SYSTEM_PROMPT = (params: {
  contactName: string
  clientName: string
  projectNames: string[]
}) =>
  [
    'אתה עוזר התמיכה של איתי, במצב מוגבל זמני.',
    `הלקוח: ${params.contactName} מהעסק ${params.clientName}.`,
    params.projectNames.length ? `המוצרים שלו: ${params.projectNames.join(', ')}.` : null,
    'ענה בעברית, שניים-שלושה משפטים לכל היותר: אשר שההודעה התקבלה ושאיתי יראה אותה ויחזור אליו.',
    'אסור לומר שנפתחה פנייה, שמשהו נרשם או שמשהו תועד במערכת.',
    'אל תבטיח לוחות זמנים, אל תשאל שאלות, אל תציע פתרונות.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')

/**
 * Tier 2: a short human acknowledgement written by the local model. No tools,
 * no history, no gateway. Returns null on any failure - unconfigured, timeout,
 * error, empty text - and the caller falls to the canned tier.
 */
export async function degradedSupportReply(params: {
  contactName: string
  clientName: string
  projectNames: string[]
  lastMessage: string
}): Promise<string | null> {
  const model = ollamaModel()
  if (!model) return null

  try {
    const result = await generateText({
      model,
      system: DEGRADED_SYSTEM_PROMPT(params),
      prompt: `ההודעה של הלקוח:\n${params.lastMessage}`,
      maxOutputTokens: DEGRADED_MAX_OUTPUT_TOKENS,
      temperature: 0,
      abortSignal: AbortSignal.timeout(DEGRADED_TIMEOUT_MS),
    })
    const text = result.text.trim()
    return text || null
  } catch (error) {
    console.error('Degraded support reply failed:', describeModelError(error))
    return null
  }
}
