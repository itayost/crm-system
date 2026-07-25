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
  mediaPath?: string | null
  mediaMimeType?: string | null
  transcript?: string | null
}

export async function archiveBotMessage({
  chatId,
  phone,
  content,
  contactId,
  clientId,
  timestamp,
  mediaPath,
  mediaMimeType,
  transcript,
}: ArchiveBotMessageParams): Promise<string> {
  const message = await prisma.whatsAppMessage.create({
    data: {
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

  return message.id
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
