import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { StorageService } from './storage.service'
import { WahaService, botSessionName } from './waha.service'
import { INTAKE_FIELD_LABELS, INTAKE_FREQUENCY_LABELS, readIntake, type Intake } from '@/lib/validations/intake'
import {
  approvedRequestClientNotice,
  resolvedRequestClientNotice,
  startedWorkClientNotice,
} from './whatsapp-messages'
import type {
  CreateRequestInput,
  UpdateRequestInput,
  BulkDraftRequestsInput,
} from '@/lib/validations/request'

interface RequestFilters {
  status?: string
  type?: string
  clientId?: string
  projectId?: string
  pendingReview?: boolean
  excludePending?: boolean
  search?: string
}

const REQUEST_INCLUDE = {
  client: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true, status: true } },
} satisfies Prisma.RequestInclude

/**
 * The chat this request can be answered on, or null if it cannot.
 *
 * Only a client who asked through the support agent has one. A batch-extracted
 * request from Itay's personal number was never a conversation with the bot, so
 * writing to it would come out of nowhere. The source message's session is the
 * exact signal.
 */
async function clientBotChat(userId: string, requestId: string) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, userId },
    select: {
      title: true,
      contact: { select: { name: true } },
      sourceMessage: { select: { sessionName: true, rawChatId: true } },
    },
  })

  const source = request?.sourceMessage
  if (!source || source.sessionName !== botSessionName() || !source.rawChatId) return null

  return {
    chatId: source.rawChatId,
    title: request.title,
    contactName: request.contact?.name ?? null,
  }
}

/** Tell the client their request was approved. */
async function notifyClientOfApproval(userId: string, requestId: string) {
  try {
    const chat = await clientBotChat(userId, requestId)
    if (!chat) return

    await WahaService.sendMessage({
      chatId: chat.chatId,
      text: approvedRequestClientNotice(chat.title),
    })
  } catch (error) {
    // The approval already happened; a WhatsApp hiccup must not undo it.
    console.error('Failed to notify client about an approved request:', error)
  }
}

/** The statuses a client is told about. OPEN and DISMISSED stay between Itay and the CRM. */
const CLIENT_ANNOUNCED_STATUSES = ['IN_PROGRESS', 'RESOLVED'] as const

type AnnouncedStatus = (typeof CLIENT_ANNOUNCED_STATUSES)[number]

function isAnnounced(status: string | undefined): status is AnnouncedStatus {
  return !!status && (CLIENT_ANNOUNCED_STATUSES as readonly string[]).includes(status)
}

/**
 * Tell the client work has started, or finished.
 *
 * The client asked for something and then heard nothing until it was done; these
 * are the two moments worth breaking that silence for.
 */
async function notifyClientOfProgress(
  userId: string,
  requestId: string,
  status: AnnouncedStatus
) {
  try {
    const chat = await clientBotChat(userId, requestId)
    if (!chat) return

    await WahaService.sendMessage({
      chatId: chat.chatId,
      text:
        status === 'IN_PROGRESS'
          ? startedWorkClientNotice(chat.contactName, chat.title)
          : resolvedRequestClientNotice(chat.contactName, chat.title),
    })
  } catch (error) {
    // The status change is already recorded; the client missing a nicety must
    // not turn into a failed update for Itay.
    console.error('Failed to notify client about a status change:', error)
  }
}

/** The request's own words first, then the fields the agent collected. */
function taskDescription(description: string | null, intake: Intake): string | null {
  const lines: string[] = []

  const add = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`${label}: ${value}`)
  }

  add(INTAKE_FIELD_LABELS.where, intake.where)
  add(INTAKE_FIELD_LABELS.whatHappened, intake.whatHappened)
  add(INTAKE_FIELD_LABELS.expected, intake.expected)
  add(
    INTAKE_FIELD_LABELS.frequency,
    intake.frequency ? INTAKE_FREQUENCY_LABELS[intake.frequency] : null
  )
  if (intake.workedBefore !== null) {
    add(INTAKE_FIELD_LABELS.workedBefore, intake.workedBefore ? 'כן' : 'לא')
  }
  add(INTAKE_FIELD_LABELS.goal, intake.goal)
  add(INTAKE_FIELD_LABELS.today, intake.today)

  if (lines.length === 0) return description

  return [description, lines.join('\n')].filter(Boolean).join('\n\n')
}

export class RequestsService {
  static async getAll(userId: string, filters?: RequestFilters) {
    const where: Prisma.RequestWhereInput = { userId }

    if (filters?.pendingReview) {
      where.status = 'PENDING_REVIEW'
    } else if (filters?.status) {
      where.status = filters.status as Prisma.EnumRequestStatusFilter
    } else if (filters?.excludePending) {
      // Opt-in only: the dashboard table hides drafts that already sit in the
      // pending-review queue, but the WhatsApp owner tools must keep seeing them.
      where.status = { not: 'PENDING_REVIEW' }
    }

    if (filters?.type) {
      where.type = filters.type as Prisma.EnumRequestTypeFilter
    }

    if (filters?.clientId) {
      where.clientId = filters.clientId
    }

    if (filters?.projectId) {
      where.projectId = filters.projectId
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.request.findMany({
      where,
      include: REQUEST_INCLUDE,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })
  }

  static async getById(userId: string, id: string) {
    const request = await prisma.request.findFirst({
      where: { id, userId },
      include: REQUEST_INCLUDE,
    })

    if (!request) {
      throw new Error('בקשה לא נמצאה')
    }

    return request
  }

  static async getByClient(userId: string, clientId: string) {
    return prisma.request.findMany({
      where: { userId, clientId },
      include: REQUEST_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  }

  static async create(userId: string, data: CreateRequestInput) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId },
      select: { id: true },
    })
    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
        select: { id: true },
      })
      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }
    }

    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, userId },
        select: { id: true },
      })
      if (!contact) {
        throw new Error('איש קשר לא נמצא')
      }
    }

    return prisma.request.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type ?? 'REQUEST',
        priority: data.priority ?? 'MEDIUM',
        source: data.source ?? 'MANUAL',
        status: 'OPEN',
        isAiGenerated: false,
        clientId: data.clientId,
        contactId: data.contactId || undefined,
        projectId: data.projectId || undefined,
        userId,
      },
      include: REQUEST_INCLUDE,
    })
  }

  static async update(userId: string, id: string, data: UpdateRequestInput) {
    const existing = await prisma.request.findFirst({ where: { id, userId } })
    if (!existing) {
      throw new Error('בקשה לא נמצאה')
    }

    // AI drafts must be approved before they can be worked on.
    if (
      existing.status === 'PENDING_REVIEW' &&
      data.status &&
      ['IN_PROGRESS', 'RESOLVED'].includes(data.status)
    ) {
      throw new Error('יש לאשר את הבקשה לפני שניתן לטפל בה')
    }

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
        select: { id: true },
      })
      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }
    }

    // null = explicit unlink (allowed); a non-null id must belong to this user.
    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, userId },
        select: { id: true },
      })
      if (!contact) {
        throw new Error('איש קשר לא נמצא')
      }
    }

    const updateData: Prisma.RequestUncheckedUpdateInput = {
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status,
      priority: data.priority,
      contactId: data.contactId !== undefined ? data.contactId : undefined,
      projectId: data.projectId !== undefined ? data.projectId : undefined,
      intake: data.intake === undefined ? undefined : (data.intake as Prisma.InputJsonValue),
    }

    if (data.status === 'RESOLVED' && !existing.resolvedAt) {
      updateData.resolvedAt = new Date()
    } else if (data.status && data.status !== 'RESOLVED' && existing.resolvedAt) {
      updateData.resolvedAt = null
    }

    const request = await prisma.request.update({
      where: { id },
      data: updateData,
      include: REQUEST_INCLUDE,
    })

    // Only a status that actually moved is news. Saving IN_PROGRESS over
    // IN_PROGRESS, or editing a title, tells the client nothing they have not
    // already been told - and this is the one guard against saying it twice,
    // since every caller that can change a status comes through here.
    if (isAnnounced(data.status) && data.status !== existing.status) {
      await notifyClientOfProgress(userId, id, data.status)
    }

    return request
  }

  /**
   * Approval is the single moment a client ticket becomes Itay's work item:
   * the Request goes OPEN, a linked client-work Task is created, and a client
   * who asked through WhatsApp is told. Shared by the dashboard route and the
   * owner agent's review tool so neither path can drift from the other.
   */
  static async approve(userId: string, id: string) {
    const existing = await prisma.request.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    })
    if (!existing) {
      throw new Error('בקשה לא נמצאה')
    }

    // Approving something already approved must not drag an in-progress or
    // resolved ticket back to OPEN.
    const wasPending = existing.status === 'PENDING_REVIEW'
    const request = wasPending
      ? await this.update(userId, id, { status: 'OPEN' })
      : await this.getById(userId, id)

    const task = await this.ensureTask(userId, request.id)

    // Exactly one caller ever creates the task, so exactly one client message
    // goes out however many times approve is pressed.
    if (wasPending && task) {
      await notifyClientOfApproval(userId, request.id)
    }

    return { ...request, taskId: task?.id ?? request.taskId }
  }

  /** Idempotent: a request that already produced a Task never produces a second. */
  private static async ensureTask(userId: string, requestId: string) {
    const request = await prisma.request.findFirst({
      where: { id: requestId, userId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        projectId: true,
        taskId: true,
        intake: true,
      },
    })

    if (!request || request.taskId) return null

    return prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: request.title,
          // The intake is what makes the work item actionable a week later:
          // which screen, what happened, what was expected.
          description: taskDescription(request.description, readIntake(request.intake)),
          priority: request.priority,
          category: 'CLIENT_WORK',
          projectId: request.projectId,
          userId,
        },
      })

      // Conditional on taskId still being null, so two concurrent approvals
      // cannot both claim the link.
      const linked = await tx.request.updateMany({
        where: { id: request.id, taskId: null },
        data: { taskId: task.id },
      })

      if (linked.count === 0) {
        await tx.task.delete({ where: { id: task.id } })
        return null
      }

      return task
    })
  }

  static async dismiss(userId: string, id: string) {
    return this.update(userId, id, { status: 'DISMISSED' })
  }

  static async delete(userId: string, id: string) {
    const request = await prisma.request.findFirst({
      where: { id, userId },
      select: { id: true, attachments: true },
    })
    if (!request) {
      throw new Error('בקשה לא נמצאה')
    }
    const deleted = await prisma.request.delete({ where: { id } })
    // Remove any stored attachments so deleting a request does not orphan files.
    await StorageService.removeAttachments(request.attachments)
    return deleted
  }

  /**
   * Bulk-create AI-drafted requests for review. Used by the extraction pass.
   * Forces the draft lifecycle: PENDING_REVIEW + isAiGenerated + WHATSAPP source.
   */
  static async createDrafts(userId: string, drafts: BulkDraftRequestsInput) {
    if (drafts.length === 0) return []

    return prisma.$transaction(
      drafts.map((d) =>
        prisma.request.create({
          data: {
            title: d.title,
            description: d.description,
            type: d.type ?? 'OTHER',
            priority: d.priority ?? 'MEDIUM',
            source: 'WHATSAPP',
            status: 'PENDING_REVIEW',
            isAiGenerated: true,
            aiConfidence: d.aiConfidence,
            aiNote: d.aiNote,
            attachments: d.attachments ?? [],
            intake: (d.intake ?? undefined) as Prisma.InputJsonValue | undefined,
            sourceMessageId: d.sourceMessageId,
            clientId: d.clientId,
            contactId: d.contactId || undefined,
            projectId: d.projectId || undefined,
            userId,
          },
        })
      )
    )
  }
}
