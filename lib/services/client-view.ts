/**
 * What a client is allowed to see about their own requests, decided once.
 *
 * There are two surfaces that speak to a client about a ticket - the portal at
 * /r/[token] and the WhatsApp support agent's getMyRequests tool - and the one
 * thing they must never do is disagree. Before this module the support agent
 * carried its own private copy of the visible-status list and the Hebrew
 * wording, so adding a second surface would have meant a second copy and,
 * eventually, a client being told two different things about one ticket.
 *
 * Three jobs, and nothing else belongs here:
 *
 *   1. which requests a client may see at all (DISMISSED never appears)
 *   2. the derived status, which is not the internal enum
 *   3. the field whitelist that turns a Request row into something safe to send
 *
 * Deliberately pure and prisma-free below the query helper, so the portal's
 * server components, the support agent and the tests can all import it.
 */

import { prisma } from '@/lib/db/prisma'

/**
 * DISMISSED is absent on purpose. A ticket Itay decided not to act on is not a
 * ticket the client should watch sitting there, and telling them "נדחה" through
 * a portal rather than a conversation is the wrong way to have that discussion.
 */
export const CLIENT_VISIBLE_STATUSES = [
  'PENDING_REVIEW',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
] as const

/**
 * The client's lifecycle, which is not the internal one.
 *
 * Internally a quoted request is still just OPEN; what makes it interesting to
 * the client is that it is waiting on *them*. That is a fact about the quote
 * fields, not about the status column, which is why this is derived rather than
 * a sixth RequestStatus - see the plan's note on blast radius.
 */
export type ClientStatus =
  | 'RECEIVED'
  | 'SCHEDULED'
  | 'AWAITING_YOU'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'DECLINED'

export interface RequestStatusFacts {
  status: string
  quotedAt: Date | string | null
  clientDecision: string | null
  clientDecisionAt: Date | string | null
}

/**
 * Precedence matters more than the mapping does.
 *
 * An unanswered quote outranks everything except a dismissal: a request can be
 * OPEN and quoted at the same time, and "ממתין לאישורך" is the only one of
 * those two facts the client can act on. Returns null for anything they should
 * not see at all, so callers filter on the return value rather than repeating
 * the visibility rule.
 */
export function clientStatusOf(request: RequestStatusFacts): ClientStatus | null {
  if (request.status === 'DISMISSED') return null

  if (request.quotedAt && !request.clientDecisionAt) return 'AWAITING_YOU'
  if (request.clientDecision === 'DECLINED') return 'DECLINED'

  if (request.status === 'RESOLVED') return 'DONE'
  if (request.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (request.status === 'OPEN') return 'SCHEDULED'

  return 'RECEIVED'
}

/** A quote the client has been shown and has not yet answered. */
export function isAwaitingClient(request: RequestStatusFacts): boolean {
  return !!request.quotedAt && !request.clientDecisionAt
}

/**
 * The columns a client may read. Everything the portal and the bot select
 * flows from here, so a new internal field cannot leak by being forgotten.
 */
export const clientRequestSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  attachments: true,
  billingKind: true,
  estimateHours: true,
  quotedPrice: true,
  quotedAt: true,
  clientDecision: true,
  clientDecisionAt: true,
  project: { select: { id: true, name: true } },
} as const

export interface ClientRequestView {
  id: string
  title: string
  description: string | null
  type: string
  clientStatus: ClientStatus
  projectName: string | null
  billingKind: string | null
  estimateHours: number | null
  quotedPrice: number | null
  quotedAt: string | null
  decidedAt: string | null
  decision: string | null
  awaitingDecision: boolean
  attachmentCount: number
  openedAt: string
  resolvedAt: string | null
}

/**
 * A whitelist, never a blacklist.
 *
 * Built by naming what goes out rather than deleting what must not, because the
 * failure mode of the other direction is silent: someone adds an internal field
 * to Request, nobody updates a delete list, and aiNote ends up on a client's
 * screen. aiNote, aiConfidence, isAiGenerated, userId, taskId and
 * sourceMessageId must never appear in this function.
 */
export function toClientRequest(row: {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  createdAt: Date
  resolvedAt: Date | null
  attachments: string[]
  billingKind: string | null
  estimateHours: unknown
  quotedPrice: unknown
  quotedAt: Date | null
  clientDecision: string | null
  clientDecisionAt: Date | null
  project: { id: string; name: string } | null
}): ClientRequestView | null {
  const clientStatus = clientStatusOf(row)
  if (!clientStatus) return null

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    clientStatus,
    projectName: row.project?.name ?? null,
    billingKind: row.billingKind,
    estimateHours: decimal(row.estimateHours),
    quotedPrice: decimal(row.quotedPrice),
    quotedAt: row.quotedAt?.toISOString() ?? null,
    decidedAt: row.clientDecisionAt?.toISOString() ?? null,
    decision: row.clientDecision,
    awaitingDecision: isAwaitingClient(row),
    attachmentCount: row.attachments.length,
    openedAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  }
}

/** Prisma Decimal, the string JSON made of it, or nothing. */
function decimal(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

/**
 * Every request a token may see, newest first.
 *
 * Scoped by formToken rather than by id, which is the invariant the whole
 * portal rests on: a caller can hand us any request id they like and still only
 * ever reach their own client's rows.
 */
export async function listClientRequests(token: string, take = 50) {
  if (!token) return []

  const rows = await prisma.request.findMany({
    where: {
      client: { formToken: token },
      status: { in: [...CLIENT_VISIBLE_STATUSES] },
    },
    select: clientRequestSelect,
    orderBy: { createdAt: 'desc' },
    take,
  })

  return rows.map(toClientRequest).filter((r): r is ClientRequestView => r !== null)
}

/** One request, still scoped by the token. Null covers "not theirs" and "gone". */
export async function getClientRequest(token: string, requestId: string) {
  if (!token || !requestId) return null

  const row = await prisma.request.findFirst({
    where: {
      id: requestId,
      client: { formToken: token },
      status: { in: [...CLIENT_VISIBLE_STATUSES] },
    },
    select: clientRequestSelect,
  })

  return row ? toClientRequest(row) : null
}
