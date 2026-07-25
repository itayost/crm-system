import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { priority, requestType } from '@/lib/validations/request'

/**
 * Persistence for the client-facing support conversation: one row per WhatsApp
 * chat per owner, holding the trimmed rolling history and the draft awaiting the
 * client's confirmation. The agent loop and its tools are the only callers.
 *
 * Every read and write is keyed on (userId, chatId), never chatId alone, so one
 * owner's conversation can never be read or overwritten through another's.
 */

const MAX_HISTORY_MESSAGES = 20

const supportMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const pendingDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  type: requestType,
  priority,
  projectId: z.string().nullable(),
  sourceMessageId: z.string().nullable(),
})

const pendingMediaSchema = z.object({
  /** Null when the file could not be stored; it is still recorded so the ticket says so. */
  path: z.string().nullable(),
  mimeType: z.string(),
  transcribed: z.boolean(),
})

/** Cap on media carried by one unfiled request, so a chatty chat cannot grow without bound. */
const MAX_PENDING_MEDIA = 10

/** Media received in this conversation that the next filed request should carry. */
export type PendingMedia = z.infer<typeof pendingMediaSchema>

export type SupportMessage = z.infer<typeof supportMessageSchema>

/** A request summary the client has been asked to confirm, but has not yet confirmed. */
export type PendingDraft = z.infer<typeof pendingDraftSchema>

export interface SupportConversationContext {
  chatId: string
  clientId: string
  contactId: string
  userId: string
}

interface StoredDraft {
  draft: PendingDraft
  confirmationAskedAt: Date | null
}

export class SupportConversationService {
  /** Opens (or reopens) the conversation for a chat and returns its current state. */
  static async open(context: SupportConversationContext) {
    const existing = await prisma.supportConversation.findUnique({
      where: identity(context),
    })

    // A chat can change hands (a contact moves business, a number is reassigned).
    // Anything the previous writer left pending belongs to them, not to whoever
    // is writing now, so it is dropped rather than filed under the new client.
    const writerChanged =
      !!existing &&
      (existing.clientId !== context.clientId || existing.contactId !== context.contactId)

    const conversation = await prisma.supportConversation.upsert({
      where: identity(context),
      update: {
        clientId: context.clientId,
        contactId: context.contactId,
        lastActiveAt: new Date(),
        ...(writerChanged
          ? {
              pendingDraft: Prisma.DbNull,
              confirmationAskedAt: null,
              remindersSent: 0,
              pendingMedia: [],
            }
          : {}),
      },
      create: {
        chatId: context.chatId,
        clientId: context.clientId,
        contactId: context.contactId,
        userId: context.userId,
        messages: [],
        lastActiveAt: new Date(),
      },
    })

    return {
      ...conversation,
      history: readHistory(conversation.messages),
      pendingDraft: writerChanged ? null : readPendingDraft(conversation.pendingDraft),
    }
  }

  static async getPendingDraft(context: SupportConversationContext): Promise<StoredDraft | null> {
    const conversation = await prisma.supportConversation.findUnique({
      where: identity(context),
      select: { pendingDraft: true, confirmationAskedAt: true },
    })

    const draft = readPendingDraft(conversation?.pendingDraft ?? null)
    if (!draft) return null

    return { draft, confirmationAskedAt: conversation?.confirmationAskedAt ?? null }
  }

  static async setPendingDraft(context: SupportConversationContext, draft: PendingDraft) {
    await prisma.supportConversation.update({
      where: identity(context),
      data: {
        pendingDraft: draft as unknown as Prisma.JsonObject,
        confirmationAskedAt: new Date(),
        remindersSent: 0,
      },
    })
  }

  static async clearPendingDraft(context: SupportConversationContext) {
    await prisma.supportConversation.update({
      where: identity(context),
      data: {
        pendingDraft: Prisma.DbNull,
        confirmationAskedAt: null,
        remindersSent: 0,
        // The media went out with the ticket; the next request starts clean.
        pendingMedia: [],
      },
    })
  }

  static async getPendingMedia(context: SupportConversationContext): Promise<PendingMedia[]> {
    const conversation = await prisma.supportConversation.findUnique({
      where: identity(context),
      select: { pendingMedia: true },
    })

    return readPendingMedia(conversation?.pendingMedia ?? null)
  }

  /**
   * Append, atomically. A client sending three screenshots at once produces three
   * concurrent webhook deliveries, and a read-modify-write would lose two of them.
   */
  static async addPendingMedia(context: SupportConversationContext, media: PendingMedia) {
    await prisma.$executeRaw`
      UPDATE "SupportConversation"
      SET "pendingMedia" = "pendingMedia" || ${JSON.stringify([media])}::jsonb
      WHERE "userId" = ${context.userId}
        AND "chatId" = ${context.chatId}
        AND jsonb_array_length("pendingMedia") < ${MAX_PENDING_MEDIA}
    `
  }

  static async saveHistory(context: SupportConversationContext, messages: SupportMessage[]) {
    await prisma.supportConversation.update({
      where: identity(context),
      data: {
        messages: trimHistory(messages) as unknown as Prisma.JsonArray,
        lastActiveAt: new Date(),
      },
    })
  }
}

function identity({ userId, chatId }: SupportConversationContext) {
  return { userId_chatId: { userId, chatId } }
}

export function trimHistory(messages: SupportMessage[]): SupportMessage[] {
  return messages.slice(-MAX_HISTORY_MESSAGES)
}

/** Stored JSON is data, not a contract: anything that no longer parses is dropped. */
function readHistory(value: Prisma.JsonValue): SupportMessage[] {
  const parsed = z.array(supportMessageSchema).safeParse(value)
  return parsed.success ? trimHistory(parsed.data) : []
}

function readPendingDraft(value: Prisma.JsonValue | null): PendingDraft | null {
  const parsed = pendingDraftSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function readPendingMedia(value: Prisma.JsonValue | null): PendingMedia[] {
  const parsed = z.array(pendingMediaSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}
