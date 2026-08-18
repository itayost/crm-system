/**
 * The portal's database reads, kept out of client-view.ts.
 *
 * client-view.ts is imported by client components, and its own comment says it
 * is "deliberately pure and prisma-free below the query helper". It was not:
 * the prisma import at the top travelled into the browser bundle with every
 * pure helper those components wanted. Prisma 7 made that fatal rather than
 * merely wrong, because its driver adapter pulls in node-only pg.
 *
 * Everything scoped by formToken still lives here, so the invariant the portal
 * rests on - a caller reaches only their own client's rows - is still decided
 * in one file.
 */
import { prisma } from '@/lib/db/prisma'
import {
  CLIENT_VISIBLE_STATUSES,
  clientProjectSelect,
  clientRequestSelect,
  toClientProject,
  toClientRequest,
  type ClientProjectView,
  type ClientRequestView,
} from './client-view'

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

/** Every project belonging to this token's client. */
export async function listClientProjects(token: string): Promise<ClientProjectView[]> {
  if (!token?.trim()) return []

  const rows = await prisma.project.findMany({
    where: { client: { formToken: token } },
    select: clientProjectSelect,
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(toClientProject)
}

/**
 * The storage path of one attachment, resolved from an index.
 *
 * By index, never by path. Storage paths are `clientId/uuid/name`, so handing
 * one to the browser would leak the client id and invite a caller to name a
 * path of their own - and the bucket is shared with support media uploaded over
 * WhatsApp, so that path could be another client's voice note. An index cannot
 * address anything outside this request's own array, which turns a membership
 * check into a bounds check the caller cannot argue with.
 *
 * tests/client-view.test.ts asserts raw paths never appear in the DTO; this is
 * the other half of that promise.
 */
export async function resolveClientAttachment(
  token: string,
  requestId: string,
  index: number,
): Promise<string | null> {
  if (!token?.trim() || !requestId) return null
  if (!Number.isInteger(index) || index < 0) return null

  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      client: { formToken: token },
      status: { in: [...CLIENT_VISIBLE_STATUSES] },
    },
    select: { attachments: true },
  })

  return request?.attachments[index] ?? null
}
