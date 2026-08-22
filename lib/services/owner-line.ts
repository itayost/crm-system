/**
 * Itay's line into the CRM: where to reach him, how to remember it, and how to
 * tell him something happened.
 *
 * Seven places used to hand-roll this — resolve his chat id, guard against not
 * finding it, send, swallow the failure — and one of them, the morning-brief
 * cron, resolved differently and lost the phone fallback, so on a fresh
 * deployment the daily brief failed while every other notice got through.
 *
 * The transport is imported rather than injected on purpose. Production has
 * exactly one way to reach him, and a test double is not production variance;
 * tests substitute the WAHA module directly, the way the rest of this codebase
 * already does. The seam here buys one place to change the rule, not a port.
 */
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'

const CONVERSATION_ID = 'singleton'

/** The chat id he actually writes from, learned the first time he does. */
export async function rememberOwnerChat(chatId: string): Promise<void> {
  await prisma.botConversation.upsert({
    where: { id: CONVERSATION_ID },
    update: { ownerChatId: chatId },
    create: {
      id: CONVERSATION_ID,
      messages: [],
      ownerChatId: chatId,
      lastActiveAt: new Date(),
    },
  })
}

/**
 * The stored LID if we have one, otherwise his configured phone. The fallback
 * is the whole point: without it a fresh deployment drops every notice until he
 * happens to message the bot.
 */
async function ownerChatId(): Promise<string | null> {
  const conversation = await prisma.botConversation.findFirst({
    where: { id: CONVERSATION_ID },
    select: { ownerChatId: true },
  })
  if (conversation?.ownerChatId) return conversation.ownerChatId

  const phone = process.env.OWNER_PHONE
  if (!phone) return null

  try {
    return WahaService.formatChatId(phone)
  } catch {
    // formatChatId throws on anything that is not an Israeli number.
    return null
  }
}

/**
 * Tell Itay something happened. Returns whether it actually reached him.
 *
 * Fire-and-forget for almost every caller: the domain write has already
 * happened by the time we get here, and a WAHA outage must not turn a client's
 * sign-off into an error on their screen. The morning-brief cron is the one
 * caller that reads the result, because a scheduled job nobody is watching
 * needs to fail loudly when it reaches no one.
 *
 * `about` names the event for the log. It is a short English label rather than
 * the notice itself, because notices carry client names and logs must not.
 */
export async function notifyOwner(
  notice: string,
  { about, unlessChatId }: { about: string; unlessChatId?: string },
): Promise<boolean> {
  try {
    const chatId = await ownerChatId()

    if (!chatId) {
      console.warn(`No owner chat id available - ${about} notification skipped`)
      return false
    }

    // The webhook's callers pass the sender: telling him about his own message
    // would just be noise on top of the reply he already got.
    if (unlessChatId && chatId === unlessChatId) return false

    await WahaService.sendMessage({ chatId, text: notice })
    return true
  } catch (error) {
    console.error(`Failed to notify owner about ${about}:`, error)
    return false
  }
}
