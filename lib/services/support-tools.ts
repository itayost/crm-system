import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { SupportConversationService, type PendingDraft } from './support-conversation.service'
import { fileDraftAsRequest } from './support-filing'
import { priority, requestType } from '@/lib/validations/request'

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
}

const CLIENT_VISIBLE_STATUSES = ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const

/** What the client is told about each status. Dismissals stay invisible to them. */
const CLIENT_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'התקבלה וממתינה לבדיקה של איתי',
  OPEN: 'נפתחה ומחכה לטיפול',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופלה',
}

const NO_CONFIRMATION_YET =
  'הלקוח עדיין לא אישר את הסיכום. הצג לו את הסיכום, חכה לתשובה שלו, ורק בהודעה הבאה פתח את הפנייה.'

export function createSupportTools(context: SupportToolContext) {
  // One tool set per client message, so this flag says "the summary was proposed
  // while answering the current message" - meaning the client has not seen it yet.
  let proposedThisTurn = false

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
        type: requestType.describe('BUG for something broken, IMPROVEMENT/REQUEST for a change'),
        priority: priority.describe('URGENT only if the client said it is urgent or broken in production'),
        projectName: z
          .string()
          .optional()
          .describe('Name of the project this concerns, exactly as listed by listMyProjects'),
      }),
      execute: async ({ title, description, type, priority: requestPriority, projectName }) => {
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
          type,
          priority: requestPriority,
          projectId,
          sourceMessageId: context.sourceMessageId,
        }

        await SupportConversationService.setPendingDraft(context, draft)
        proposedThisTurn = true

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

        // The summary was proposed while answering the current message, so the
        // client has not seen it yet, let alone agreed to it. Always-confirm is
        // enforced here, not left to the prompt.
        if (proposedThisTurn) {
          return {
            success: false,
            reason: 'awaiting_client_confirmation',
            message: NO_CONFIRMATION_YET,
          }
        }

        const { requestId, skipped } = await fileDraftAsRequest(context, pending.draft)

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

async function clientProjects(context: SupportToolContext) {
  return prisma.project.findMany({
    where: { clientId: context.clientId, userId: context.userId },
    select: { id: true, name: true, status: true },
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
