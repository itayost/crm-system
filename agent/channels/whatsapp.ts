import { defineChannel, POST } from 'eve/channels'
import { timingSafeMatch } from '@/lib/api/shared-secret'
import { WahaService } from '@/lib/services/waha.service'
import { describeModelError } from '@/lib/ai/resilient-model'

/**
 * The client-facing WhatsApp surface.
 *
 * The chat id is the session address, so one durable session belongs to one
 * conversation and eve owns its history and turn ordering. The CRM still decides
 * who is allowed to reach here: the WAHA webhook authenticates the sender,
 * classifies them, honours the pause switch and archives the message, and only
 * then forwards a client turn to this route.
 *
 * Delivery lives here rather than in the webhook because the reply is produced
 * inside the runtime; there is no return value to hand back to the caller.
 */

/** Identity the CRM has already established. Never supplied by the model. */
interface InboundBody {
  chatId: string
  text: string
  /**
   * The turn's system prompt, already built.
   *
   * Built by `buildSystemPrompt` in the CRM, unchanged, and carried here rather
   * than rebuilt inside the agent. That keeps one source of prompt truth, avoids
   * repeating five database reads and the extractor's model call, and preserves
   * the injection defence by construction: the agent never interpolates client
   * text into a system prompt, because it never composes one.
   */
  systemPrompt: string
  identity: {
    userId: string
    clientId: string
    clientName: string
    contactId: string
    contactName: string
    sourceMessageId: string | null
  }
}

/**
 * Fails closed, like the WAHA webhook it sits behind: an unset secret rejects
 * every request rather than letting anyone post as a client. Read per request so
 * a rotation does not need a cold start.
 */
function isAuthorized(request: Request): boolean {
  const configured = process.env.SUPPORT_AGENT_CHANNEL_SECRET ?? ''
  if (!configured) return false

  const provided = request.headers.get('x-support-agent-secret')
  if (!provided) return false

  return timingSafeMatch(provided, configured)
}

export default defineChannel<{ systemPrompt: string }>({
  /**
   * Two messages seconds apart must both be answered. The default, "steer",
   * cancels the turn already in flight, which would silently drop the first
   * client's reply - the behaviour the AI SDK path never had.
   */
  turnPolicy: 'queue',

  /** Seeded on every inbound turn; projected below for the instructions resolver. */
  state: { systemPrompt: '' },

  metadata(state) {
    return { systemPrompt: state.systemPrompt }
  },

  routes: [
    // The full path, not a bare '/inbound': a custom channel's routes mount
    // exactly where they say, with no channel-name namespace added. Keeping it
    // under /eve/v1 is also what makes withEve proxy it to the agent service
    // rather than letting Next try to serve it.
    POST('/eve/v1/whatsapp/inbound', async (request, { from }) => {
      if (!isAuthorized(request)) {
        return new Response('Unauthorized', { status: 401 })
      }

      const body = (await request.json()) as InboundBody
      if (!body?.chatId || typeof body.text !== 'string' || !body.systemPrompt) {
        return new Response('Bad Request', { status: 400 })
      }

      // Identity travels on session auth, which is where the tools read it from.
      // Attributes are strings only, and nothing here is model-supplied.
      const session = await from(body.chatId).send(body.text, {
        state: { systemPrompt: body.systemPrompt },
        auth: {
          authenticator: 'crm-whatsapp',
          principalType: 'service',
          principalId: `${body.identity.userId}:${body.chatId}`,
          attributes: {
            userId: body.identity.userId,
            clientId: body.identity.clientId,
            clientName: body.identity.clientName,
            contactId: body.identity.contactId,
            contactName: body.identity.contactName,
            chatId: body.chatId,
            ...(body.identity.sourceMessageId
              ? { sourceMessageId: body.identity.sourceMessageId }
              : {}),
          },
        },
      })

      return Response.json({ sessionId: session.id })
    }),
  ],

  events: {
    /** The turn's answer, on its way to the client. */
    async 'message.completed'(event, channel) {
      const text = event.message?.trim()
      if (!text) return

      const chatId = channel.continuation?.token
      if (!chatId) return

      await WahaService.sendMessage({ chatId, text })
    },

    /**
     * Runs outside session context, so it gets no ctx and must not assume one.
     *
     * The client is owed an answer even when the turn died. This must never
     * claim a ticket was opened - nothing was filed - which is the same rule the
     * CRM's degraded tier follows.
     */
    async 'session.failed'(event, channel) {
      console.error('Support turn failed:', describeModelError(event))

      const chatId = channel.continuation?.token
      if (!chatId) return

      await WahaService.sendMessage({
        chatId,
        text: 'קיבלתי. אעביר לאיתי ואחזור אליך.',
      }).catch(() => {})
    },
  },
})
