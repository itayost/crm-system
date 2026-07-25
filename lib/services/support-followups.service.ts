import { prisma } from '@/lib/db/prisma'
import { fileDraftAsRequest } from './support-filing'
import { SupportConversationService } from './support-conversation.service'
import { WahaService } from './waha.service'
import {
  firstConfirmationReminder,
  secondConfirmationReminder,
} from './whatsapp-messages'

/**
 * The cost cap on the always-confirm rule.
 *
 * A client who never answers the agent's summary gets two nudges and then the
 * request is filed anyway, flagged, so nothing rots in a chat. The clock is the
 * conversation's confirmationAskedAt, which is pushed forward every time the
 * client writes - so these thresholds measure the client's silence, not the
 * age of the draft.
 */

const HOUR_MS = 60 * 60 * 1000
export const FIRST_REMINDER_HOURS = 3
export const SECOND_REMINDER_HOURS = 24
export const FILE_ANYWAY_HOURS = 48

/** Bounded so one sweep cannot run unbounded work. */
const MAX_CONVERSATIONS_PER_SWEEP = 200

export interface SweepStats {
  considered: number
  firstReminders: number
  secondReminders: number
  filedUnconfirmed: number
}

export class SupportFollowupsService {
  static async sweep(now = new Date()): Promise<SweepStats> {
    const conversations = await prisma.supportConversation.findMany({
      where: {
        confirmationAskedAt: { not: null, lte: new Date(now.getTime() - FIRST_REMINDER_HOURS * HOUR_MS) },
      },
      select: {
        chatId: true,
        userId: true,
        clientId: true,
        contactId: true,
        confirmationAskedAt: true,
        remindersSent: true,
        client: { select: { name: true } },
        contact: { select: { name: true } },
      },
      orderBy: { confirmationAskedAt: 'asc' },
      take: MAX_CONVERSATIONS_PER_SWEEP,
    })

    const stats: SweepStats = {
      considered: conversations.length,
      firstReminders: 0,
      secondReminders: 0,
      filedUnconfirmed: 0,
    }

    for (const conversation of conversations) {
      const context = {
        chatId: conversation.chatId,
        userId: conversation.userId,
        clientId: conversation.clientId,
        contactId: conversation.contactId,
      }

      // Read the draft through the service so it is validated, and so a
      // conversation whose draft was answered between the query and now is
      // simply skipped.
      const pending = await SupportConversationService.getPendingDraft(context)
      if (!pending || !conversation.confirmationAskedAt) continue

      const silentHours = (now.getTime() - conversation.confirmationAskedAt.getTime()) / HOUR_MS

      try {
        if (silentHours >= FILE_ANYWAY_HOURS) {
          const { skipped } = await fileDraftAsRequest(
            {
              ...context,
              clientName: conversation.client?.name ?? 'לקוח',
              contactName: conversation.contact?.name ?? '',
            },
            pending.draft,
            { unconfirmed: true }
          )
          if (!skipped) stats.filedUnconfirmed += 1
          continue
        }

        // Which nudge is due, rather than which threshold passed: after a gap in
        // sweeps the client still gets the first reminder's wording first.
        const dueReminders = silentHours >= SECOND_REMINDER_HOURS ? 2 : 1
        if (conversation.remindersSent >= dueReminders) continue

        const next = conversation.remindersSent + 1
        const sent = await this.remind(
          context,
          next === 1
            ? firstConfirmationReminder(pending.draft.title)
            : secondConfirmationReminder(pending.draft.title),
          next
        )

        if (sent) {
          if (next === 1) stats.firstReminders += 1
          else stats.secondReminders += 1
        }
      } catch (error) {
        // One stuck conversation must not stop the sweep for the others.
        console.error(`Follow-up failed for chat ${conversation.chatId}:`, error)
      }
    }

    return stats
  }

  /**
   * Counter first, message second: a send that fails leaves the reminder marked
   * as sent, which is the safe direction - the client may get one nudge fewer,
   * never the same nudge every hour.
   */
  private static async remind(
    context: { chatId: string; userId: string; clientId: string; contactId: string },
    text: string,
    reminderNumber: number
  ): Promise<boolean> {
    // Claim the reminder first: whoever advances the counter is the one who
    // sends, so overlapping sweeps cannot nudge the same client twice.
    const claimed = await SupportConversationService.markReminderSent(context, reminderNumber)
    if (!claimed) return false

    await WahaService.sendMessage({ chatId: context.chatId, text })
    return true
  }
}
