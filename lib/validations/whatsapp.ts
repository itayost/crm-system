import { z } from 'zod'

/**
 * WAHA webhook payloads. Both webhooks are public endpoints, so nothing from the
 * body is used before it parses — a malformed payload is ignored, never stored.
 */

export const wahaEventSchema = z.object({
  event: z.string(),
  payload: z.unknown().optional(),
})

export const wahaMessageSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1).optional(),
  body: z.string().min(1),
  fromMe: z.boolean().optional(),
  /** Unix seconds. */
  timestamp: z.number().int().nonnegative(),
})

export type WahaMessage = z.infer<typeof wahaMessageSchema>

/** Returns the message payload of a `message` event, or null for anything else. */
export function parseWahaMessageEvent(body: unknown): WahaMessage | null {
  const event = wahaEventSchema.safeParse(body)
  if (!event.success || event.data.event !== 'message') return null

  const message = wahaMessageSchema.safeParse(event.data.payload)
  return message.success ? message.data : null
}
