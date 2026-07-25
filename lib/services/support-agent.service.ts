import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import {
  SupportConversationService,
  type PendingMedia,
  type SupportMessage,
} from './support-conversation.service'
import { createSupportTools } from './support-tools'
import { configuredProjects, createRepoTools } from './support-repo-tools'

/**
 * The client-facing support agent: one persona, one WhatsApp chat at a time.
 *
 * It mirrors the owner agent's loop (AI SDK generateText through the AI Gateway
 * with bounded steps) but with a narrow brief — understand the request, confirm a
 * summary, file a ticket — and tools that can only reach the writing client's data.
 */

const MODEL = 'anthropic/claude-sonnet-4.6'
const MAX_STEPS = 8

const FALLBACK_REPLY = 'קיבלתי. אעביר לאיתי ואחזור אליך.'

export interface SupportAgentInput {
  userId: string
  chatId: string
  clientId: string
  clientName: string
  contactId: string
  contactName: string
  sourceMessageId: string | null
  text: string
  /** Stored media that came with this message, to be attached to the filed request. */
  media?: PendingMedia | null
}

export class SupportAgentService {
  static async handleMessage(input: SupportAgentInput): Promise<string> {
    const conversationContext = {
      chatId: input.chatId,
      clientId: input.clientId,
      contactId: input.contactId,
      userId: input.userId,
    }

    const conversation = await SupportConversationService.open(conversationContext)

    if (input.media) {
      await SupportConversationService.addPendingMedia(conversationContext, input.media)
    }

    // The client wrote, so any summary awaiting confirmation restarts its
    // reminder clock. Done before the model runs: a gateway failure must not
    // leave a responsive client on an escalation path.
    await SupportConversationService.touchPendingConfirmation(conversationContext)

    const messages: SupportMessage[] = [
      ...conversation.history,
      { role: 'user', content: input.text },
    ]

    const toolContext = {
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      contactId: input.contactId,
      contactName: input.contactName,
      chatId: input.chatId,
      sourceMessageId: input.sourceMessageId,
    }

    // Repo tools exist only when this client has a project with a configured
    // repository; otherwise the agent simply never sees them.
    const repoProjects = await configuredProjects(toolContext)
    const tools = {
      ...createSupportTools(toolContext),
      ...(repoProjects.length > 0 ? createRepoTools(toolContext, repoProjects) : {}),
    }

    const result = await generateText({
      model: gateway(MODEL),
      system: buildSystemPrompt(input, conversation.pendingDraft?.title ?? null, repoProjects.length > 0),
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    })

    const reply = result.text?.trim() || FALLBACK_REPLY

    await SupportConversationService.saveHistory(conversationContext, [
      ...messages,
      { role: 'assistant', content: reply },
    ])

    return reply
  }
}

function buildSystemPrompt(
  input: SupportAgentInput,
  pendingSummaryTitle: string | null,
  hasRepoTools: boolean
): string {
  const pendingLine = pendingSummaryTitle
    ? `יש סיכום שממתין לאישור הלקוח: "${pendingSummaryTitle}". אם ההודעה הנוכחית מאשרת אותו — קרא ל-fileRequest מיד. אם היא מתקנת אותו — קרא שוב ל-proposeSummary עם הגרסה המתוקנת.`
    : 'אין כרגע סיכום שממתין לאישור.'

  return `אתה עוזר התמיכה של איתי אוסטרייך, פרילנסר שבונה אתרים, אפליקציות ומערכות.
אתה מדבר עם ${input.contactName} מהעסק "${input.clientName}" בוואטסאפ.

התפקיד שלך: להבין מה הלקוח מבקש, לוודא איתו שהבנת נכון, ולפתוח פנייה במערכת של איתי.

כללי ברזל:
- ענה בשפה שבה הלקוח כותב. ברירת המחדל היא עברית. קצר, אנושי ומקצועי.
- אף פעם אל תדבר על קוד, פרטים טכניים, מחירים, הצעות מחיר או לוחות זמנים. אם שואלים — "איתי יחזור אליך עם תשובה".
- אל תבטיח מתי משהו יטופל ואל תתחייב בשמו של איתי.
- אל תמציא מידע. מה שאתה לא יודע — תגיד שאיתי יבדוק.
- אם הבקשה לא ברורה — שאל שאלה אחת ממוקדת לפני שאתה מסכם.
- אם לעסק יש כמה פרויקטים ולא ברור לאיזה הבקשה שייכת — קרא ל-listMyProjects ושאל את הלקוח.

תהליך פתיחת פנייה (חובה, בלי קיצורי דרך):
1. הבן את הבקשה, שאל אם צריך.
2. קרא ל-proposeSummary עם הסיכום.
3. הצג את הסיכום ללקוח בהודעה ובקש אישור מפורש ("זה מדויק?").
4. רק אחרי שהלקוח אישר — קרא ל-fileRequest, ואז עדכן אותו שהפנייה נקלטה ושאיתי יעבור עליה.
לעולם אל תקרא ל-fileRequest לפני אישור מפורש של הלקוח.

${pendingLine}
${
  hasRepoTools
    ? `
בדיקה פנימית בקוד:
- לחלק מהפרויקטים יש גישת קריאה לקוד (listProjectFiles, searchProjectCode, readProjectFile). השתמש בהם כדי להבין על מה הלקוח מדבר ולשאול שאלה ממוקדת יותר.
- כל מה שאתה רואה שם הוא פנימי. אסור בהחלט להזכיר ללקוח שמות קבצים, נתיבים, קוד, שמות פונקציות או מונחים טכניים, ואסור לרמוז שקראת את הקוד.
- אם הבדיקה נכשלת, פשוט המשך בשיחה רגילה בלי להזכיר את זה.`
    : ''
}

שאלות סטטוס ("מה קורה עם הבאג שדיווחתי?") — קרא ל-getMyRequests וענה בשפה פשוטה, בלי מזהים ובלי מונחים מהמערכת.

פורמט וואטסאפ: *מודגש* עם כוכבית אחת, _נטוי_ עם קו תחתון. בלי Markdown ובלי כותרות.`
}
