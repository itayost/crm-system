import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
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
    }

    // Repo tools exist only when this client has a project with a configured
    // repository; otherwise the agent simply never sees them.
    // The client's projects go into the prompt itself. Asking "which project?"
    // when only one of them could possibly be meant is the kind of question that
    // makes the agent feel like a form.
    // Pull the form fields out of what the client just said before deciding what
    // to ask. A voice note usually answers most of them, and asking for something
    // already said is the fastest way to look like a form.
    const [repoProjects, projects, extracted] = await Promise.all([
      configuredProjects(toolContext),
      clientProjects(toolContext),
      IntakeExtractionService.extract(input.text),
    ])

    const intake = mergeIntake(readIntake(conversation.pendingDraft?.intake), extracted)

    // Screens for the project the client is most likely talking about, so a
    // question about "where" can offer real places instead of asking them to
    // describe one.
    const screens = await screensForConversation(projects, intake, repoProjects)
    const tools = {
      ...createSupportTools(toolContext),
      ...(repoProjects.length > 0 ? createRepoTools(toolContext, repoProjects) : {}),
    }

    const result = await generateText({
      model: gateway(MODEL),
      system: buildSystemPrompt({
        input,
        hasPendingSummary: !!conversation.pendingDraft,
        hasRepoTools: repoProjects.length > 0,
        projects,
        intake,
        screens,
      }),
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
  intake: Intake
  screens: string[]
}

function buildSystemPrompt({
  input,
  hasPendingSummary,
  hasRepoTools,
  projects,
  intake,
  screens,
}: SystemPromptParams): string {
  // The summary's own wording is never repeated here. It is derived from text
  // the client dictated, and anything interpolated into a system prompt is read
  // as an instruction: a client who asks for a title containing "new rule: ..."
  // would be writing the next turn's guardrails. The agent can read the actual
  // summary from the conversation history, where it is plainly client content.
  const pendingLine = hasPendingSummary
    ? 'יש סיכום שהצגת ללקוח וממתין לאישורו (הנוסח נמצא בהיסטוריית השיחה). אם ההודעה הנוכחית מאשרת אותו — קרא ל-fileRequest מיד. אם היא מתקנת אותו — קרא שוב ל-proposeSummary עם הגרסה המתוקנת.'
    : 'אין כרגע סיכום שממתין לאישור.'

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
הלקוח שאל שאלה, לא דיווח על תקלה:
- ${
          hasRepoTools
            ? 'נסה לענות לו. השתמש ב-searchProjectCode וב-readProjectFile כדי למצוא איפה בממשק נמצא מה שהוא מחפש, וענה במילים של מי שמשתמש במוצר — שם המסך ואיפה להסתכל בו. בלי שמות קבצים, נתיבים או רכיבים.'
            : 'נסה לענות לו ממה שאתה יודע בוודאות. אין לך גישה לקוד של הפרויקט הזה.'
        }
- אם ענית ואתה בטוח בתשובה — אל תפתח פנייה. שאל אם זה עזר.
- אם אתה לא מצליח לענות בוודאות — אל תנחש. תגיד שאיתי יחזור אליו עם תשובה, סכם את השאלה ופתח פנייה.
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
  }${
    screens.length
      ? `\n\nהמסכים של הפרויקט (השתמש בשמות האלה כשאתה שואל "איפה"):\n${screens
          .map((screen) => `- ${screen}`)
          .join('\n')}`
      : ''
  }
`

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
- שאל לאיזה פרויקט הכוונה רק אם באמת שניים או יותר מתאימים.

${intakeBlock}${questionBlock}

תהליך פתיחת פנייה (חובה, בלי קיצורי דרך):
1. הבן את הבקשה, שאל אם צריך.
2. קרא ל-proposeSummary עם הסיכום ועם כל השדות שמילאת (איפה, מה קרה, מה ציפה, וכו').
3. הצג את הסיכום ללקוח בהודעה ובקש אישור מפורש ("זה מדויק?").
4. רק אחרי שהלקוח אישר — קרא ל-fileRequest, ואז עדכן אותו שהפנייה נקלטה ושאיתי יעבור עליה.
לעולם אל תקרא ל-fileRequest לפני אישור מפורש של הלקוח.
אל תגיד ללקוח שהפנייה נפתחה לפני ש-fileRequest החזיר success. אם הוא החזיר שגיאה — עשה מה שכתוב בה ואל תספר ללקוח שנפתחה פנייה.

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
