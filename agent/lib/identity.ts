/**
 * Who the agent is answering, read from verified session context.
 *
 * The WhatsApp channel puts these on the session's auth when the CRM forwards a
 * turn, and the CRM only forwards after it has authenticated the webhook and
 * matched the sender to a contact by exact phone. The model never supplies an id
 * and never sees one it could reuse, which is the rule every tool below scopes
 * its queries on.
 */
export interface SupportIdentity {
  userId: string
  clientId: string
  clientName: string
  contactId: string
  contactName: string
  chatId: string
  sourceMessageId: string | null
}

/** The slice of eve's tool context this module needs. */
export interface AuthCarrier {
  session: {
    auth: {
      current?: { attributes?: Readonly<Record<string, string | readonly string[]>> } | null
    }
  }
}

function one(
  attributes: Readonly<Record<string, string | readonly string[]>>,
  key: string
): string | null {
  const value = attributes[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

/**
 * Null when this is not a support turn, so a session opened from the terminal
 * gets no client-scoped tools rather than client-scoped tools with empty ids.
 * Throws only when a turn claims to be a support turn and is missing something,
 * because a half-identified turn would widen a query's scope instead of
 * narrowing it.
 */
export function readIdentity(ctx: AuthCarrier): SupportIdentity | null {
  const attributes = ctx.session.auth.current?.attributes
  if (!attributes || !one(attributes, 'chatId')) return null

  const required = (key: string): string => {
    const value = one(attributes, key)
    if (!value) throw new Error(`Support turn is missing ${key} on its session auth.`)
    return value
  }

  return {
    userId: required('userId'),
    clientId: required('clientId'),
    clientName: required('clientName'),
    contactId: required('contactId'),
    contactName: required('contactName'),
    chatId: required('chatId'),
    sourceMessageId: one(attributes, 'sourceMessageId'),
  }
}
