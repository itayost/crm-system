import { prisma } from '@/lib/db/prisma'
import { RequestsService } from './requests.service'
import {
  SupportConversationService,
  type PendingDraft,
  type SupportConversationContext,
} from './support-conversation.service'
import { WahaService } from './waha.service'
import { WhatsAppAgentService } from './whatsapp-agent.service'
import { filedRequestOwnerNotice } from './whatsapp-messages'

/**
 * Turning a pending draft into a ticket, in one place.
 *
 * Two callers: the agent's fileRequest tool when the client confirms, and the
 * follow-up sweep when the client never answers. They must produce the same
 * ticket - same attachments, same repo findings, same owner notification -
 * differing only in the flag that says nobody confirmed it.
 */

export interface FilingContext extends SupportConversationContext {
  clientName: string
  contactName: string
}

const FILED_NOTE = 'נפתח על ידי סוכן התמיכה בוואטסאפ לאחר אישור הלקוח'
const UNCONFIRMED_NOTE = 'נפתח על ידי סוכן התמיכה בוואטסאפ ללא אישור הלקוח (לא הגיבה/ה במשך יומיים)'

export async function fileDraftAsRequest(
  context: FilingContext,
  draft: PendingDraft,
  { unconfirmed = false }: { unconfirmed?: boolean } = {}
): Promise<{ requestId: string | undefined; skipped?: true }> {
  // Whoever claims the draft files it. A retried sweep, a double tool call, or
  // two overlapping crons find nothing left to claim and file nothing.
  const claimed = await SupportConversationService.claimPendingDraft(context)
  if (!claimed) return { requestId: undefined, skipped: true }

  const media = await SupportConversationService.getPendingMedia(context)
  const repoFindings = await SupportConversationService.getRepoFindings(context)
  const untranscribed = media.filter((item) => !item.transcribed).length

  // Only this client's own storage folder can ever end up on the ticket.
  const attachments = media
    .map((item) => item.path)
    .filter((path): path is string => !!path && path.startsWith(`${context.clientId}/`))

  // Re-verify the project against the writing client: the draft may predate
  // anything that changed since it was proposed.
  const project = draft.projectId ? await ownProject(context, draft.projectId) : null

  let request
  try {
    ;[request] = await RequestsService.createDrafts(context.userId, [
      {
        title: draft.title,
        description: draft.description,
        // Deliberately whatever the draft carries, which is the schema default:
        // Itay classifies the ticket when he reviews it. The agent's read rides
        // along in the intake as a hint he can ignore.
        type: draft.type,
        priority: draft.priority,
        clientId: context.clientId,
        contactId: context.contactId,
        projectId: project?.id,
        sourceMessageId: draft.sourceMessageId ?? undefined,
        aiConfidence: unconfirmed ? 0.6 : 1,
        intake: draft.intake ?? undefined,
        aiNote: [
          unconfirmed ? UNCONFIRMED_NOTE : FILED_NOTE,
          untranscribed > 0
            ? `שים לב: ${untranscribed} קבצי מדיה לא תומללו - צריך לפתוח אותם ידנית`
            : null,
          repoFindings.length > 0 ? `ממצאים מהקוד: ${repoFindings.join('; ')}` : null,
        ]
          .filter(Boolean)
          .join('. '),
        attachments,
      },
    ])
  } catch (error) {
    // The draft was claimed before the write, so a failed write would otherwise
    // lose a summary the client already confirmed. Put it back and let the next
    // attempt - a retry, or the follow-up sweep - file it.
    await SupportConversationService.restorePendingDraft(context, draft)
    throw error
  }

  await SupportConversationService.clearPendingDraft(context)
  await notifyOwner(context, draft, project?.name, unconfirmed)

  return { requestId: request?.id }
}

/** A project id is only ever accepted back if it still belongs to this client and owner. */
export async function ownProject(
  context: Pick<FilingContext, 'clientId' | 'userId'>,
  projectId: string
) {
  return prisma.project.findFirst({
    where: { id: projectId, clientId: context.clientId, userId: context.userId },
    select: { id: true, name: true },
  })
}

async function notifyOwner(
  context: FilingContext,
  draft: PendingDraft,
  projectName: string | undefined,
  unconfirmed: boolean
) {
  // The ticket already exists at this point: a WhatsApp hiccup must not turn into
  // a failed tool call that leaves the client without a confirmation.
  try {
    const ownerChatId = await WhatsAppAgentService.resolveOwnerChatId()
    if (!ownerChatId) {
      console.warn('No owner chat id available - filed request notification skipped')
      return
    }

    await WahaService.sendMessage({
      chatId: ownerChatId,
      text: filedRequestOwnerNotice({
        clientName: context.clientName,
        contactName: context.contactName,
        projectName,
        title: draft.title,
        description: draft.description,
        type: draft.type,
        priority: draft.priority,
        unconfirmed,
      }),
    })
  } catch (error) {
    console.error('Failed to notify owner about a filed request:', error)
  }
}
