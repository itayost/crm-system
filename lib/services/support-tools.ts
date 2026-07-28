import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { SupportConversationService, type PendingDraft } from './support-conversation.service'
import { fileDraftAsRequest } from './support-filing'
import { priority, requestType } from '@/lib/validations/request'
import { intakeFrequency } from '@/lib/validations/intake'

/**
 * Tools for the client-facing support agent.
 *
 * Every query is scoped server-side to the writing client — the model never
 * supplies a client, contact, or user id, and never sees an id it could reuse.
 * A project is chosen by name and resolved against that client's own projects.
 */

export interface SupportToolContext {
  userId: string
  clientId: string
  clientName: string
  contactId: string
  contactName: string
  chatId: string
  sourceMessageId: string | null
  /**
   * The draft as it stood when this client message arrived. A draft that was
   * already there is one the client has seen, which makes their message a
   * response to it - the only thing that makes filing legitimate.
   */
  confirmableDraft?: PendingDraft | null
  /**
   * How many summaries this client has already been asked to confirm without a
   * ticket coming out of it. Past MAX_CONFIRMATION_ROUNDS the exchange has
   * stopped converging and is ended rather than continued.
   */
  confirmationRounds?: number
}

/**
 * How many times one client may be asked "זה מדויק?" about the same unfiled
 * request. Three leaves room for the honest case - propose, client corrects,
 * propose again - and stops the fourth ask, which has never once been the
 * thing that got a ticket written.
 */
const MAX_CONFIRMATION_ROUNDS = 3

/** Below this, two summaries are about different things and one of them is unseen. */
const SAME_SUMMARY_SIMILARITY = 0.6

const CLIENT_VISIBLE_STATUSES = ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const

/** What the client is told about each status. Dismissals stay invisible to them. */
const CLIENT_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'התקבלה וממתינה לבדיקה של איתי',
  OPEN: 'נפתחה ומחכה לטיפול',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופלה',
}

const NO_CONFIRMATION_YET =
  'הלקוח עדיין לא אישר את הסיכום. אל תגיד ללקוח שנפתחה פנייה - היא לא נפתחה. הצג לו את הסיכום, חכה לתשובה שלו, ורק בהודעה הבאה פתח את הפנייה.'

/**
 * Same request in the client's eyes.
 *
 * Deliberately not string equality. On the turn a client says "כן" the model
 * routinely restates its own summary in slightly different words, and treating
 * that rewording as a summary the client has never seen revoked the very
 * confirmation they had just given - which is what left Eden being asked "זה
 * מדויק?" after every "כן", with no ticket ever written. A rewording of the same
 * report still counts as confirmed; a summary about something else does not,
 * because that is genuinely something she has not read.
 */
function sameSummary(a: PendingDraft, b: PendingDraft): boolean {
  if (a.title.trim() === b.title.trim() && a.description.trim() === b.description.trim()) {
    return true
  }

  return similarity(summaryTokens(a), summaryTokens(b)) >= SAME_SUMMARY_SIMILARITY
}

/** Words worth comparing: punctuation and single letters carry no meaning here. */
function summaryTokens(draft: PendingDraft): Set<string> {
  return new Set(
    `${draft.title} ${draft.description}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 1)
  )
}

/**
 * Dice coefficient rather than Jaccard: a restatement is usually the same report
 * at a different length, and Dice is the one that does not punish that.
 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0

  let shared = 0
  for (const token of a) {
    if (b.has(token)) shared += 1
  }

  return (2 * shared) / (a.size + b.size)
}

export function createSupportTools(context: SupportToolContext) {
  // Filing is allowed when the client is responding to a summary they were
  // already shown. Re-proposing the identical text during this turn is the model
  // repeating itself and must not revoke that; proposing something *different*
  // must, because the client has not seen the new wording.
  let confirmable = context.confirmableDraft ?? null

  // The wording the client demonstrably read, kept even after a re-proposal
  // revokes `confirmable`. It is the only text we can prove was in front of
  // them, so it is what gets filed when the exchange has to be ended.
  const seenByClient = context.confirmableDraft ?? null

  return {
    listMyProjects: tool({
      description:
        "List the writing client's own projects. Use it when the request could belong to more than one project, before proposing a summary.",
      inputSchema: z.object({}),
      execute: async () => {
        const projects = await clientProjects(context)

        return {
          projects: projects.map((project) => ({ name: project.name, status: project.status })),
        }
      },
    }),

    getMyRequests: tool({
      description:
        "Answer 'what is happening with my request?' questions. Returns the writing client's own tickets in plain language. Never mention internal ids or statuses verbatim.",
      inputSchema: z.object({}),
      execute: async () => {
        const requests = await prisma.request.findMany({
          where: {
            clientId: context.clientId,
            userId: context.userId,
            status: { in: [...CLIENT_VISIBLE_STATUSES] },
          },
          select: {
            title: true,
            status: true,
            createdAt: true,
            project: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })

        return {
          requests: requests.map((request) => ({
            title: request.title,
            state: CLIENT_STATUS_LABELS[request.status] ?? request.status,
            project: request.project?.name ?? null,
            openedAt: request.createdAt.toISOString(),
          })),
        }
      },
    }),

    proposeSummary: tool({
      description:
        'Store a summary of the request and ask the client to confirm it. ALWAYS call this before filing anything. Filing without a confirmed summary is not possible.',
      inputSchema: z.object({
        title: z.string().min(1).max(120).describe('Short actionable title, in the client language'),
        description: z.string().min(1).describe('What the client asked for, in their own terms'),
        suggestedType: requestType.describe(
          'Your internal read only - Itay decides the real type on review. Never ask the client.'
        ),
        priority: priority.describe('URGENT only if the client said it is urgent or broken in production'),
        projectName: z
          .string()
          .optional()
          .describe('Name of the project this concerns, exactly as listed for this client'),
        where: z.string().nullable().optional().describe('Screen or page, in the client wording'),
        whatHappened: z.string().nullable().optional(),
        expected: z.string().nullable().optional(),
        frequency: intakeFrequency.nullable().optional(),
        workedBefore: z.boolean().nullable().optional(),
        blocking: z.boolean().nullable().optional(),
        goal: z.string().nullable().optional().describe('For a change: the outcome wanted'),
        today: z.string().nullable().optional().describe('For a change: how they manage today'),
      }),
      execute: async ({
        title,
        description,
        suggestedType,
        priority: requestPriority,
        projectName,
        ...fields
      }) => {
        const projectId = await resolveProjectId(context, projectName)

        if (projectName && !projectId) {
          return {
            success: false,
            reason: 'unknown_project',
            message: 'לא זוהה פרויקט בשם הזה. בקש מהלקוח לבחור מתוך הפרויקטים שלו.',
          }
        }

        const draft: PendingDraft = {
          title,
          description,
          // Left at the schema default when the ticket is filed: the type is
          // Itay's call at review, and suggestedType is only a hint for him.
          type: 'OTHER',
          priority: requestPriority,
          projectId,
          sourceMessageId: context.sourceMessageId,
          intake: {
            where: fields.where ?? null,
            whatHappened: fields.whatHappened ?? null,
            expected: fields.expected ?? null,
            frequency: fields.frequency ?? null,
            workedBefore: fields.workedBefore ?? null,
            blocking: fields.blocking ?? null,
            goal: fields.goal ?? null,
            today: fields.today ?? null,
            suggestedType,
          },
        }

        await SupportConversationService.setPendingDraft(context, draft)
        if (!confirmable || !sameSummary(confirmable, draft)) {
          confirmable = null
        }

        return {
          success: true,
          message: 'הסיכום נשמר. הצג אותו ללקוח ובקש אישור מפורש לפני פתיחת הפנייה.',
          summary: { title, description, project: projectName ?? null },
        }
      },
    }),

    fileRequest: tool({
      description:
        'File the summary the client just confirmed as a ticket. Only call this after the client explicitly agreed to the summary you proposed.',
      inputSchema: z.object({}),
      execute: async () => {
        const pending = await SupportConversationService.getPendingDraft(context)

        if (!pending) {
          return {
            success: false,
            reason: 'no_pending_summary',
            message: 'אין סיכום מאושר. הצע סיכום ובקש אישור לפני פתיחת פנייה.',
          }
        }

        // Nothing the client has actually seen, so their message cannot be a
        // confirmation of it. Always-confirm is enforced here, not in the prompt.
        //
        // Unless we have already asked too many times. The client answered a
        // summary - that is what put a draft here before their message arrived -
        // and asking them to read one more rewrite of it has stopped being a
        // confirmation and become a loop. Their own approved wording is filed
        // instead, which honours the rule the extra ask was meant to protect.
        //
        // `pending.draft` is the model's latest wording; `seenByClient` is what
        // the client actually read. Where those have come apart past the round
        // limit, the client's version wins.
        const rounds = context.confirmationRounds ?? 0
        const draft = confirmable
          ? pending.draft
          : rounds >= MAX_CONFIRMATION_ROUNDS
            ? seenByClient
            : null

        if (!draft) {
          return {
            success: false,
            reason: 'awaiting_client_confirmation',
            message: NO_CONFIRMATION_YET,
          }
        }

        if (!confirmable) {
          console.warn(
            `Support confirmation stopped converging after ${rounds} rounds on chat ${context.chatId}; filing the wording the client approved`
          )
        }

        const { requestId, skipped } = await fileDraftAsRequest(context, draft)

        if (skipped) {
          return {
            success: false,
            reason: 'already_filed',
            message: 'הפנייה כבר נפתחה. אשר ללקוח שהיא נקלטה ואל תפתח פנייה נוספת.',
          }
        }

        return {
          success: true,
          message: 'הפנייה נפתחה וממתינה לאישור של איתי. אשר ללקוח שהבקשה נקלטה.',
          requestId,
        }
      },
    }),
  }
}

/** The writing client's own projects. Shared with the agent loop, which puts
 *  them in the system prompt so the model can infer the right one without a
 *  round trip. */
export async function clientProjects(context: Pick<SupportToolContext, 'clientId' | 'userId'>) {
  return prisma.project.findMany({
    where: { clientId: context.clientId, userId: context.userId },
    select: { id: true, name: true, status: true, type: true },
    orderBy: { createdAt: 'desc' },
  })
}

/** Resolve a project name against this client's own projects. Ambiguous stays unresolved. */
async function resolveProjectId(
  context: SupportToolContext,
  projectName?: string
): Promise<string | null> {
  if (!projectName) return null

  const projects = await clientProjects(context)
  const needle = projectName.trim().toLowerCase()
  if (!needle) return null

  const exact = projects.filter((project) => project.name.toLowerCase() === needle)
  if (exact.length === 1) return exact[0].id

  const partial = projects.filter((project) => project.name.toLowerCase().includes(needle))
  return partial.length === 1 ? partial[0].id : null
}
