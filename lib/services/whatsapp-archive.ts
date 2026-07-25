import { prisma } from '@/lib/db/prisma'
import { botSessionName } from './waha.service'

/**
 * Archive a message the support agent is about to answer.
 *
 * Written with processedAt already stamped: the 3x/day batch extraction only
 * looks at unprocessed messages, so a request the support agent handles live can
 * never come back as a second, duplicate ticket.
 */

interface ArchiveBotMessageParams {
  chatId: string
  phone: string | null
  content: string
  contactId: string
  clientId: string
  /** Unix seconds from the WAHA payload. */
  timestamp: number
  /** WAHA's message id, when the payload carried one. */
  externalId?: string | null
  mediaPath?: string | null
  mediaMimeType?: string | null
  transcript?: string | null
}

export interface ArchivedMessage {
  id: string
  /** True when this exact WAHA message was already archived and answered. */
  alreadySeen: boolean
}

export async function archiveBotMessage({
  chatId,
  phone,
  content,
  contactId,
  clientId,
  timestamp,
  externalId,
  mediaPath,
  mediaMimeType,
  transcript,
}: ArchiveBotMessageParams): Promise<ArchivedMessage> {
  // WAHA retries a webhook it thinks failed. Without this the client gets a
  // second reply and a second run of the agent for one message they sent once.
  if (externalId) {
    const seen = await prisma.whatsAppMessage.findUnique({
      where: { externalId },
      select: { id: true },
    })
    if (seen) return { id: seen.id, alreadySeen: true }
  }

  try {
    const message = await prisma.whatsAppMessage.create({
      data: {
        externalId: externalId ?? null,
        phoneNumber: phone ?? chatId,
        rawChatId: chatId,
        direction: 'INCOMING',
        content,
        contactId,
        clientId,
        sessionName: botSessionName(),
        timestamp: new Date(timestamp * 1000),
        processedAt: new Date(),
        mediaPath: mediaPath ?? null,
        mediaMimeType: mediaMimeType ?? null,
        transcript: transcript ?? null,
      },
      select: { id: true },
    })

    return { id: message.id, alreadySeen: false }
  } catch (error) {
    // Handling now runs after the webhook has been answered, so two deliveries
    // of one message can overlap instead of queueing. The check above can then
    // pass twice, and the unique index is what actually settles it.
    if (externalId && isUniqueViolation(error)) {
      const winner = await prisma.whatsAppMessage.findUnique({
        where: { externalId },
        select: { id: true },
      })
      if (winner) return { id: winner.id, alreadySeen: true }
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  )
}

/**
 * Hand a message back to the batch extraction.
 *
 * Called when the support agent failed to handle a message it had already
 * archived as processed - without this, the 3x/day sweep would skip it and the
 * request would be lost by both paths.
 */
export async function releaseArchivedMessage(id: string): Promise<void> {
  await prisma.whatsAppMessage.update({
    where: { id },
    data: { processedAt: null },
  })
}
