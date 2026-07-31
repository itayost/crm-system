import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import {
  SupportConversationService,
  type PendingMedia,
  type SupportMessage,
} from './support-conversation.service'
import { clientProjects, createSupportTools } from './support-tools'
import { configuredProjects, createRepoTools } from './support-repo-tools'
import { IntakeExtractionService } from './intake-extraction.service'
import { projectScreens } from './project-screens.service'
import {
  INTAKE_FIELD_LABELS,
  intakeKind,
  mergeIntake,
  missingIntakeFields,
  readIntake,
  type Intake,
} from '@/lib/validations/intake'

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
  /**
   * Called before the model runs when this turn is going to take a while, so the
   * client is told rather than left watching nothing. The caller decides whether
   * anything is actually sent - it may already have greeted.
   */
  onAcknowledge?: () => Promise<void>
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
      // Read before the model runs: a draft already on the conversation is one
      // the client has seen, so this message can be their answer to it.
      confirmableDraft: conversation.pendingDraft,
      confirmationRounds: conversation.confirmationRounds,
    }

    // Repo tools exist only when this client has a project with a configured
    // repository; otherwise the agent simply never sees them.
    // The client's projects go into the prompt itself. Asking "which project?"
    // when only one of them could possibly be meant is the kind of question that
    // makes the agent feel like a form.
    // Pull the form fields out of what the client just said before deciding what
    // to ask. A voice note usually answers most of them, and asking for something
    // already said is the fastest way to look like a form.
    const [repoProjects, projects, extracted, recentRequests] = await Promise.all([
      configuredProjects(toolContext),
      clientProjects(toolContext),
      IntakeExtractionService.extract(input.text, { history: conversation.history }),
      // What was actually filed for this client, straight from the database.
      // Tool calls never enter the saved history, so without this the model's
      // only evidence about past filings is its own prose - and "did I already
      // open this?" answered from memory is how a new request got waved away
      // as "זו בדיוק הבקשה שפתחנו בתחילת השיחה".
      recentClientRequests(toolContext),
    ])

    const intake = mergeIntake(readIntake(conversation.pendingDraft?.intake), extracted)

    // Screens for the project the client is most likely talking about, so a
    // question about "where" can offer real places instead of asking them to
    // describe one.
    const screens = await screensForConversation(projects, intake, repoProjects)
    // Any turn with repo access short of a plain change request may end up
    // reading code before a single word gets written. It used to fire only for
    // questions, so a bug report that triggered three uncached tree fetches
    // left the client staring at nothing.
    if (intakeKind(intake) !== 'change' && repoProjects.length > 0) {
      await input.onAcknowledge?.()
    }

    const repoActivity = { fired: false }
    const tools = {
      ...createSupportTools({ ...toolContext, turnIntake: intake }),
      ...(repoProjects.length > 0 ? createRepoTools(toolContext, repoProjects, repoActivity) : {}),
    }

    const result = await generateText({
      model: gateway(MODEL),
      system: buildSystemPrompt({
        input,
        hasPendingSummary: !!conversation.pendingDraft,
        hasRepoTools: repoProjects.length > 0,
        projects,
        recentRequests,
        intake,
        screens,
      }),
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      // Anthropic prompt caching via the gateway. The 8-step loop resends the
      // whole prompt every step; with caching, steps 2..n read the prefix at
      // a tenth of the price. Requires the prompt's stable blocks to come
      // before the volatile ones, and the tool definitions to stay frozen -
      // editing a tool description invalidates the entire cache.
      providerOptions: { gateway: { caching: 'auto' } },
    })

    const reply = result.text?.trim() || FALLBACK_REPLY

    await SupportConversationService.saveHistory(conversationContext, [
      ...messages,
      { role: 'assistant', content: reply },
    ])

    // Findings from a dead investigation must not ride the next unrelated
    // ticket's aiNote. "Dead" is judged conservatively: this turn neither
    // touched the repo nor left a draft, so whatever findings remain belong to
    // an earlier thread that ended without a ticket. A turn that searched and
    // will propose next turn keeps its findings; filing clears them itself.
    if (!repoActivity.fired) {
      const remainingDraft = await SupportConversationService.getPendingDraft(conversationContext)
      if (!remainingDraft) {
        await SupportConversationService.clearRepoFindings(conversationContext)
      }
    }

    return reply
  }
}

/**
 * The client's latest filed requests, for the prompt's facts block. Small on
 * purpose: five titles are enough to answer "is this the same as something we
 * already opened?", which is the only question this exists to ground.
 */
async function recentClientRequests(context: { clientId: string; userId: string }) {
  return prisma.request.findMany({
    where: {
      clientId: context.clientId,
      userId: context.userId,
      // A dismissed ticket must not ground "כבר נפתחה" - a client re-raising a
      // dismissed topic is starting over, not repeating themselves.
      status: { in: ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { title: true, createdAt: true },
  })
}

/**
 * Screens are only useful when we know which project is meant. With one project
 * it is unambiguous; with several, the intake's own "where" is not enough to
 * pick one, so we stay quiet rather than offer the wrong site's pages.
 */
async function screensForConversation(
  projects: Array<{ id: string; name: string; type: string }>,
  intake: Intake,
  repoProjects: Array<{ id: string }>
): Promise<string[]> {
  const configured = projects.filter((project) =>
    repoProjects.some((repoProject) => repoProject.id === project.id)
  )
  if (configured.length !== 1) return []

  try {
    return await projectScreens(configured[0].id)
  } catch (error) {
    console.error('Could not load project screens:', error)
    return []
  }
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
}

interface SystemPromptParams {
  input: SupportAgentInput
  hasPendingSummary: boolean
  hasRepoTools: boolean
  projects: Array<{ name: string; type: string; status: string }>
  recentRequests: Array<{ title: string; createdAt: Date }>
  intake: Intake
  screens: string[]
}

function buildSystemPrompt({
  input,
  hasPendingSummary,
  hasRepoTools,
  projects,
  recentRequests,
  intake,
  screens,
}: SystemPromptParams): string {
  // The summary's own wording is never repeated here. It is derived from text
  // the client dictated, and anything interpolated into a system prompt is read
  // as an instruction: a client who asks for a title containing "new rule: ..."
  // would be writing the next turn's guardrails. The agent can read the actual
  // summary from the conversation history, where it is plainly client content.
  // Two different situations, and only one of them is the start of the process.
  // Handing the model the full four-step checklist on the turn a client answers
  // "כן" is what made it re-propose instead of file: step 2 says propose, the
  // header says no shortcuts, and it obeyed - every time, forever.
  const processBlock = hasPendingSummary
    ? `אתה נמצא בשלב האישור, לא בתחילת התהליך.
כבר הצגת ללקוח סיכום והוא ממתין לתשובתו (הנוסח נמצא בהיסטוריית השיחה).
- אם ההודעה הנוכחית מאשרת את הסיכום ("כן", "מדויק", "נכון", "אוקיי", "בסדר", "סבבה") — קרא ל-fileRequest מיד. אל תקרא ל-proposeSummary, אל תנסח את הסיכום מחדש ואל תציג אותו שוב.
- אחרי ש-fileRequest החזיר success — אמור ללקוח שהפנייה נקלטה ושאיתי יעבור עליה, וזהו.
- קרא שוב ל-proposeSummary רק אם הלקוח תיקן משהו בסיכום. אז הצג את הגרסה המתוקנת ובקש אישור עליה.
- אם ההודעה לא מאשרת ולא מתקנת אלא מעלה נושא חדש — זו בקשה נוספת, לא תיקון לסיכום. סגור קודם את הסיכום הממתין בהודעה קצרה אחת (בקש עליו כן/לא), ורק אחרי שהוא נסגר התחל את התהליך המלא עבור הבקשה החדשה. אל תמזג את שתי הבקשות לפנייה אחת.
- לקוח שכבר אישר ונשאל שוב "זה מדויק?" על אותו סיכום — זו תקלה. אל תעשה את זה.`
    : `תהליך פתיחת פנייה (חובה, בלי קיצורי דרך):
1. הבן את הבקשה, שאל אם צריך.
2. קרא ל-proposeSummary עם הסיכום ועם כל השדות שמילאת (איפה, מה קרה, מה ציפה, וכו').
3. הצג את הסיכום ללקוח בהודעה ובקש אישור מפורש ("זה מדויק?").
4. רק אחרי שהלקוח אישר — קרא ל-fileRequest, ואז עדכן אותו שהפנייה נקלטה ושאיתי יעבור עליה.
לעולם אל תקרא ל-fileRequest לפני אישור מפורש של הלקוח.`

  // One chat, many requests over months. Without this the model has no state
  // for "the client is starting another request", and a new ask that shares
  // vocabulary with a filed one gets waved away as already handled - which is
  // exactly how a client was told "זו בדיוק הבקשה שפתחנו" about a request that
  // was never opened.
  const multiRequestBlock = `שיחה אחת מכילה הרבה פניות נפרדות:
- השיחה הזו נמשכת חודשים והלקוח פותח דרכה פניות רבות. כל הודעה שמתארת רצון, בעיה או רעיון היא פנייה חדשה — אלא אם היא תשובה לשאלה ששאלת על הפנייה הנוכחית.
- דומה זה לא אותו דבר. שתי בקשות על אותו מסך או אותו תחום (הכנסות, טבלאות, דוחות) הן עדיין שתי פניות נפרדות.
- פתיחים כמו "בנוסף", "עוד משהו", "דבר נוסף", "ועוד דבר" אומרים במפורש שמדובר בפנייה חדשה. לעולם אל תתייחס למה שאחריהם כחזרה על פנייה קיימת.
- אסור לך להחליט לבד שהודעה חדשה היא כפילות של פנייה שכבר נפתחה. אם אתה חושד שכן — שאל את הלקוח ונקוב בשם הפנייה הקיימת ("זה אותו נושא כמו הפנייה על X, או משהו נפרד?"). אם ענה שנפרד, או אם אינך בטוח — פתח פנייה חדשה בתהליך המלא.`

  // Titles are agent-composed and Itay-reviewed, unlike the pending summary's
  // client-dictated wording that the comment above refuses to interpolate, and
  // the model already reads them through getMyRequests. Flattened and capped
  // anyway - a title's job here is recognition, not detail.
  const recentRequestsBlock = recentRequests.length
    ? `פניות שכבר נפתחו ללקוח הזה לאחרונה (מהחדשה לישנה):
${recentRequests
        .map(
          (request) =>
            `- "${request.title.replace(/\s+/g, ' ').slice(0, 80)}" (${request.createdAt.toLocaleDateString('he-IL')})`
        )
        .join('\n')}
אם ההודעה הנוכחית באמת חוזרת על אחת מאלו — אמור שהיא כבר נפתחה ונקוב בשמה. כל דבר אחר הוא פנייה חדשה.`
    : ''

  const projectLines = projects.length
    ? projects
        .map(
          (project) =>
            `- ${project.name} (${PROJECT_TYPE_LABELS[project.type] ?? project.type}${
              project.status === 'COMPLETED' ? ', הושלם' : ''
            })`
        )
        .join('\n')
    : '- (אין פרויקטים רשומים)'

  const known = (Object.keys(INTAKE_FIELD_LABELS) as Array<keyof Intake>)
    .filter((field) => field !== 'suggestedType' && intake[field] !== null)
    .map((field) => `- ${INTAKE_FIELD_LABELS[field]}: ${String(intake[field])}`)

  const skipWhere = projects.length === 1 && projects[0].type === 'CONSULTATION'
  const missing = missingIntakeFields(intake, { skipWhere })
    .map((field) => INTAKE_FIELD_LABELS[field])

  const kind = intakeKind(intake)
  const optional =
    kind === 'broken'
      ? [
          'האם זה עבד קודם — שאל רק אם מדובר במשהו שהתנהג אחרת פעם, ולא על תקלה ויזואלית.',
          'תדירות — שאל רק אם הניסוח מרמז שזה לא קורה תמיד ("לפעמים", "פתאום", "מדי פעם").',
          'האם זה חוסם אותו עכשיו — שאלה קצרה שקובעת עדיפות. אל תבטיח לוח זמנים.',
        ]
      : []

  const questionBlock =
    kind === 'question'
      ? `
הלקוח שאל שאלה, לא דיווח על תקלה. שאלה היא לרוב הסימן הראשון לבאג או לבקשה, אז אל תסכם אותה לפני שבדקת.
${
          hasRepoTools
            ? `- קודם כל חפש בקוד: searchProjectCode ו-readProjectFile. אתה מחפש אם הדבר שהוא שואל עליו בכלל קיים במוצר, ואיפה.
- אם זה קיים והוא פשוט לא מצא — ענה לו איפה זה, במילים של מי שמשתמש במוצר: שם המסך ואיפה להסתכל בו. בלי שמות קבצים, נתיבים או רכיבים. אל תפתח פנייה, רק שאל אם זה עזר.
- אם זה קיים אבל מוסתר, קשה למצוא או לא עובד כמו שהוא מתאר — זו לא שאלה, זו תקלה. סכם כתקלה (suggestedType=BUG) וציין איפה זה אמור להיות.
- אם זה לא קיים בכלל בקוד — זו לא שאלה, זו בקשה לפיצ'ר. אל תגיד לו "זה לא קיים" כעובדה מוחלטת; תגיד שאיתי יחזור אליו, וסכם כבקשה (suggestedType=REQUEST) עם מה שהוא רוצה להשיג.`
            : `- אין לך גישה לקוד של הפרויקט הזה, אז אל תנחש אם משהו קיים או לא.
- ענה רק ממה שאתה יודע בוודאות. אחרת תגיד שאיתי יחזור אליו, וסכם את השאלה.`
        }
- מה שמצאת בקוד נשמר לאיתי בכל מקרה, גם כשענית ולא פתחת פנייה.
`
      : ''

  const intakeBlock = `
מה כבר ידוע לך על הפנייה:
${known.length ? known.join('\n') : '- (עדיין כלום)'}

מה חסר וצריך לשאול עליו:
${missing.length ? missing.map((label) => `- ${label}`).join('\n') : '- כלום. אפשר לסכם.'}

איך לשאול:
- שאל רק על מה שברשימת החסרים. אל תשאל על משהו שהלקוח כבר אמר, גם לא כדי לוודא.
- אם חסרים כמה דברים — אחד הודעה אחת, לא הודעה לכל שאלה.
- אחרי שתי הודעות של שאלות לכל היותר, סכם עם מה שיש ותן ללקוח לתקן.
- לעולם אל תשאל את הלקוח לאיזה סוג הפנייה שייכת (תקלה / שיפור / שאלה). זו החלטה של איתי.
- אל תבקש צילום מסך אם הלקוח כבר שלח קובץ, הקלטה או תמונה.${
    optional.length ? `\n${optional.map((line) => `- ${line}`).join('\n')}` : ''
  }
`

  // Ordered for the prefix cache: everything up to the volatile marker is
  // stable across a conversation's turns (persona, projects, screens, rules),
  // so every agent step and every follow-up message reuses the cached prefix.
  // The per-turn state - recent requests, intake, process stage - lives at
  // the end, where changing it only invalidates itself.
  return `אתה עוזר התמיכה של איתי אוסטרייך, פרילנסר שבונה אתרים, אפליקציות ומערכות.
אתה מדבר עם ${input.contactName} מהעסק "${input.clientName}" בוואטסאפ.

התפקיד שלך: להבין מה הלקוח מבקש, לוודא איתו שהבנת נכון, ולפתוח פנייה במערכת של איתי.

כללי ברזל:
- ענה בשפה שבה הלקוח כותב. ברירת המחדל היא עברית. קצר, אנושי ומקצועי.
- אף פעם אל תדבר על קוד, פרטים טכניים, מחירים, הצעות מחיר או לוחות זמנים. אם שואלים — "איתי יחזור אליך עם תשובה".
- אל תבטיח מתי משהו יטופל ואל תתחייב בשמו של איתי.
- אל תמציא מידע. מה שאתה לא יודע — תגיד שאיתי יבדוק.

הפרויקטים של ${input.clientName}:
${projectLines}

בחירת פרויקט — הסק בעצמך, אל תשאל סתם:
- "האתר" מתאים לאתר או לדף נחיתה. "המערכת" למערכת ניהול או לאפליקציית ווב. "האפליקציה" לאפליקציה. "החנות" לחנות אונליין.
- אם רק פרויקט אחד מהרשימה מתאים למה שהלקוח אמר — זה הפרויקט. אל תשאל עליו בכלל.
- שאל לאיזה פרויקט הכוונה רק אם באמת שניים או יותר מתאימים.${
    screens.length
      ? `\n\nהמסכים של הפרויקט (השתמש בשמות האלה כשאתה שואל "איפה"):\n${screens
          .map((screen) => `- ${screen}`)
          .join('\n')}`
      : ''
  }

${multiRequestBlock}
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

פורמט וואטסאפ: *מודגש* עם כוכבית אחת, _נטוי_ עם קו תחתון. בלי Markdown ובלי כותרות.

${recentRequestsBlock ? `${recentRequestsBlock}\n\n` : ''}${intakeBlock}${questionBlock}

${processBlock}
אל תגיד ללקוח שהפנייה נפתחה לפני ש-fileRequest החזיר success. "הפנייה נקלטה" מותר להגיד רק על success שקיבלת בתור הנוכחי — success מוקדם יותר בשיחה שייך לפנייה אחרת, ולעולם אינו תשובה להודעה חדשה. אם fileRequest החזיר שגיאה — עשה מה שכתוב בה ואל תספר ללקוח שנפתחה פנייה.`
}
