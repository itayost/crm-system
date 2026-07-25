import { prisma } from '@/lib/db/prisma'
import { WahaService, botSessionName } from '@/lib/services/waha.service'

/**
 * Who is on the other side of a WhatsApp chat.
 *
 * Both webhooks resolve senders through this module: the personal session uses it
 * to attribute archived messages, the bot session uses it to decide which agent
 * (if any) may answer. Nothing here trusts the caller — an unresolvable number is
 * always UNKNOWN, never the owner.
 *
 * Two matchers on purpose:
 * - findContactByPhone is loose (last-7-digit suffix) and feeds message archiving,
 *   where a wrong guess costs an attribution a human can fix.
 * - findContactByExactPhone requires the whole number to match and feeds routing,
 *   where a wrong guess would hand one person another client's support channel.
 */

/** Shortest suffix we are willing to match a contact on. */
const MIN_MATCHABLE_DIGITS = 7

/** Cap on suffix candidates verified for an exact match. */
const MAX_EXACT_CANDIDATES = 10

export interface MatchedContact {
  id: string
  name: string
  clientId: string | null
}

/** A contact resolved for routing: carries the tenant and business it belongs to. */
export interface IdentifiedContact extends MatchedContact {
  userId: string
  clientName: string | null
}

export interface ClientContact extends IdentifiedContact {
  clientId: string
  clientName: string
}

export type WhatsAppSender =
  | { kind: 'OWNER'; chatId: string; phone: string }
  | { kind: 'CLIENT'; chatId: string; phone: string; contact: ClientContact }
  | { kind: 'UNKNOWN'; chatId: string; phone: string | null; contact: MatchedContact | null }

/** Digits only, in local Israeli form (972501234567 and +972-50-123-4567 both become 0501234567). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('972')) return `0${digits.slice(3)}`
  return digits
}

export function isOwnerPhone(phone: string): boolean {
  const owner = normalizePhone(process.env.OWNER_PHONE ?? '')
  if (!owner) return false

  const candidate = normalizePhone(phone)
  if (!candidate) return false

  return candidate === owner
}

function phoneCandidateFilter(normalized: string) {
  return {
    OR: [
      { phone: normalized },
      { phone: { endsWith: normalized.slice(-MIN_MATCHABLE_DIGITS) } },
    ],
  }
}

/** Loose match used for archiving: exact number, or anything ending in the same 7 digits. */
export async function findContactByPhone(phone: string): Promise<MatchedContact | null> {
  const normalized = normalizePhone(phone)
  if (normalized.length < MIN_MATCHABLE_DIGITS) return null

  return prisma.contact.findFirst({
    where: phoneCandidateFilter(normalized),
    select: { id: true, name: true, clientId: true },
  })
}

/**
 * Strict match used for routing: the stored number must normalize to the same
 * digits as the sender, so a shared 7-digit suffix is never enough.
 */
export async function findContactByExactPhone(phone: string): Promise<IdentifiedContact | null> {
  const normalized = normalizePhone(phone)
  if (normalized.length < MIN_MATCHABLE_DIGITS) return null

  const candidates = await prisma.contact.findMany({
    where: phoneCandidateFilter(normalized),
    select: {
      id: true,
      name: true,
      clientId: true,
      phone: true,
      userId: true,
      client: { select: { name: true } },
    },
    take: MAX_EXACT_CANDIDATES,
  })

  const exact = candidates.find((candidate) => normalizePhone(candidate.phone) === normalized)
  if (!exact) return null

  return {
    id: exact.id,
    name: exact.name,
    clientId: exact.clientId,
    userId: exact.userId,
    clientName: exact.client?.name ?? null,
  }
}

interface IdentifySenderParams {
  chatId: string
  session?: string
}

export async function identifySender({
  chatId,
  session = botSessionName(),
}: IdentifySenderParams): Promise<WhatsAppSender> {
  const phone = await WahaService.getPhoneFromChatId(chatId, session)

  if (!phone) return { kind: 'UNKNOWN', chatId, phone: null, contact: null }

  if (isOwnerPhone(phone)) return { kind: 'OWNER', chatId, phone }

  const contact = await findContactByExactPhone(phone)

  if (contact?.clientId) {
    return {
      kind: 'CLIENT',
      chatId,
      phone,
      contact: {
        ...contact,
        clientId: contact.clientId,
        clientName: contact.clientName ?? 'הלקוח',
      },
    }
  }

  return { kind: 'UNKNOWN', chatId, phone, contact }
}
