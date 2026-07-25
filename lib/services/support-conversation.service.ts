import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { priority, requestType } from '@/lib/validations/request'
import { intakeSchema } from '@/lib/validations/intake'

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
  /** Optional so drafts written before the intake existed still parse. */
  intake: intakeSchema.nullable().optional(),
})

const pendingMediaSchema = z.object({
  /** Null when the file could not be stored; it is still recorded so the ticket says so. */
  path: z.string().nullable(),
  mimeType: z.string(),
  transcribed: z.boolean(),
})

/** Cap on media carried by one unfiled request, so a chatty chat cannot grow without bound. */
const MAX_PENDING_MEDIA = 10

/** Cap on repository findings collected for one unfiled request. */
const MAX_REPO_FINDINGS = 10

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
              repoFindings: [],
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

  /**
   * Take the pending draft off the conversation, once.
   *
   * Filing is not idempotent - two callers would create two tickets - so the
   * draft is claimed with a conditional update first and only the winner files.
   * Media and findings stay put: the winner still needs them for the ticket.
   */
  static async claimPendingDraft(context: SupportConversationContext): Promise<boolean> {
    const claimed = await prisma.supportConversation.updateMany({
      where: {
        userId: context.userId,
        chatId: context.chatId,
        pendingDraft: { not: Prisma.DbNull },
      },
      data: { pendingDraft: Prisma.DbNull, confirmationAskedAt: null, remindersSent: 0 },
    })

    return claimed.count > 0
  }

  /**
   * Put a claimed draft back after a failed filing.
   *
   * Claiming nulls confirmationAskedAt, and the follow-up sweep only looks at
   * rows where that is set, so the clock has to be restarted or the restored
   * draft would sit there forever. Only restores if nothing else has claimed
   * the slot in the meantime.
   */
  static async restorePendingDraft(context: SupportConversationContext, draft: PendingDraft) {
    await prisma.supportConversation.updateMany({
      where: {
        userId: context.userId,
        chatId: context.chatId,
        pendingDraft: { equals: Prisma.DbNull },
      },
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
        // The media and findings went out with the ticket; the next request
        // starts clean.
        pendingMedia: [],
        repoFindings: [],
      },
    })
  }

  /**
   * Only advances the counter, so two overlapping sweeps cannot send the same
   * reminder twice.
   */
  static async markReminderSent(context: SupportConversationContext, reminderNumber: number) {
    const updated = await prisma.supportConversation.updateMany({
      where: {
        userId: context.userId,
        chatId: context.chatId,
        remindersSent: { lt: reminderNumber },
      },
      data: { remindersSent: reminderNumber },
    })

    return updated.count > 0
  }

  /**
   * The client wrote something, so the confirmation clock restarts: reminders
   * measure silence, and a client who is talking is not silent.
   */
  static async touchPendingConfirmation(context: SupportConversationContext) {
    await prisma.supportConversation.updateMany({
      where: {
        userId: context.userId,
        chatId: context.chatId,
        pendingDraft: { not: Prisma.DbNull },
      },
      data: { confirmationAskedAt: new Date(), remindersSent: 0 },
    })
  }

  static async getRepoFindings(context: SupportConversationContext): Promise<string[]> {
    const conversation = await prisma.supportConversation.findUnique({
      where: identity(context),
      select: { repoFindings: true },
    })

    const parsed = z.array(z.string()).safeParse(conversation?.repoFindings ?? null)
    return parsed.success ? parsed.data : []
  }

  /** Appended atomically for the same reason as media, and capped the same way. */
  static async addRepoFinding(context: SupportConversationContext, finding: string) {
    await prisma.$executeRaw`
      UPDATE "SupportConversation"
      SET "repoFindings" = "repoFindings" || ${JSON.stringify([finding])}::jsonb
      WHERE "userId" = ${context.userId}
        AND "chatId" = ${context.chatId}
        AND jsonb_array_length("repoFindings") < ${MAX_REPO_FINDINGS}
    `
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
