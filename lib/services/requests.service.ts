import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { StorageService } from './storage.service'
import { WahaService, botSessionName } from './waha.service'
import { INTAKE_FIELD_LABELS, INTAKE_FREQUENCY_LABELS, readIntake, type Intake } from '@/lib/validations/intake'
import {
  approvedRequestClientNotice,
  clientDecisionOwnerNotice,
  quoteSentClientNotice,
  replyInvitation,
  resolvedRequestClientNotice,
  startedWorkClientNotice,
} from './whatsapp-messages'
import { notifyOwner } from './owner-line'
import { isBotPaused } from '@/lib/config/bot-pause'
import { BILLING_NEEDS_APPROVAL } from '@/lib/validations/enums'
import type {
  CreateRequestInput,
  UpdateRequestInput,
  BulkDraftRequestsInput,
  SendQuoteInput,
  ClientDecisionInput,
} from '@/lib/validations/request'

interface RequestFilters {
  status?: string
  type?: string
  clientId?: string
  projectId?: string
  pendingReview?: boolean
  excludePending?: boolean
  /** Quoted and not yet answered. Derived, not a status - see getAll. */
  awaitingClient?: boolean
  /**
   * One of the decision queues on the dashboard, so a counter and the list it
   * links to can never disagree about what they are counting.
   */
  queue?: 'needsPricing' | 'unclassified' | 'awaitingClient' | 'withoutTask'
  search?: string
}

/** Live in the sense that matters: still someone's problem. Mirrors LIVE in request-metrics. */
const LIVE_STATUSES = ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS'] as const

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
async function clientBotChat(
  userId: string,
  requestId: string,
  { allowPhoneFallback = false }: { allowPhoneFallback?: boolean } = {},
) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, userId },
    select: {
      title: true,
      clientId: true,
      contact: { select: { name: true, phone: true } },
      sourceMessage: { select: { sessionName: true, rawChatId: true } },
    },
  })

  if (!request) return null

  const source = request.sourceMessage
  if (source && source.sessionName === botSessionName() && source.rawChatId) {
    return {
      chatId: source.rawChatId,
      title: request.title,
      contactName: request.contact?.name ?? null,
    }
  }

  // The fallback is per message kind, never global.
  //
  // The rule above is right for the *automatic* notices: a request batch-
  // extracted from Itay's personal number was never a conversation with the
  // bot, so a status update on it really would arrive out of nowhere. A quote
  // is the opposite case - the client asked for the work, and Itay deliberately
  // pressed send on a price. Without this, a quote on a request that came in
  // through the portal form or that Itay typed himself could never be
  // delivered, and a quote nobody can receive is not a quote.
  if (!allowPhoneFallback) return null

  const phone =
    request.contact?.phone ??
    (
      await prisma.contact.findFirst({
        where: { clientId: request.clientId, userId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { phone: true },
      })
    )?.phone

  if (!phone) return null

  try {
    return {
      chatId: WahaService.formatChatId(phone),
      title: request.title,
      contactName: request.contact?.name ?? null,
    }
  } catch {
    // formatChatId throws on anything that is not an Israeli number.
    return null
  }
}

/** Tell the client their request was approved. */
async function notifyClientOfApproval(userId: string, requestId: string) {
  try {
    // Owner-initiated, so the phone fallback applies - Itay pressed אשר, which
    // is him vouching for the ticket. See clientBotChat.
    const chat = await clientBotChat(userId, requestId, { allowPhoneFallback: true })
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

/** The two billing kinds that put the ball in the client's court. */
function needsClientApproval(billingKind: string | null | undefined): boolean {
  return !!billingKind && (BILLING_NEEDS_APPROVAL as readonly string[]).includes(billingKind)
}

/**
 * Where the client answers a quote.
 *
 * The portal is a capability URL, so the token is the whole address - there is
 * no per-request link to build and nothing to sign.
 */
/** This request's client portal link, or null if they have not been issued one. */
async function clientPortalUrl(userId: string, requestId: string): Promise<string | null> {
  const row = await prisma.request.findFirst({
    where: { id: requestId, userId },
    select: { client: { select: { formToken: true } } },
  })

  // Optional all the way down: this runs inside the notify try/catch, so a
  // throw here would swallow the whole message rather than just the link.
  return row?.client?.formToken ? portalUrl(row.client.formToken, requestId) : null
}

/**
 * Deep-links to the request when one is named.
 *
 * Every notice we send is about a specific request, and the client's next act
 * is to answer it - so landing them on the portal root and asking them to find
 * it again is a step we are choosing to add. One tap from the message to the
 * button.
 */
function portalUrl(formToken: string, requestId?: string): string | null {
  const base = (process.env.NEXTAUTH_URL ?? '').trim().replace(/\/$/, '')
  // Without an origin this would send the client the literal text "/r/<token>",
  // which is not a link and cannot be tapped. Better to report the quote as
  // undelivered and let the dashboard say so.
  if (!base) return null
  return requestId ? `${base}/r/${formToken}/${requestId}` : `${base}/r/${formToken}`
}

/**
 * Tell the client a quote is waiting for them.
 *
 * Without this the portal is a page nobody has a reason to open. It is the one
 * notification the commercial flow genuinely depends on, which is why it also
 * falls back to the client's own phone below rather than going quiet.
 */
async function notifyClientOfQuote(userId: string, requestId: string): Promise<boolean> {
  try {
    const request = await prisma.request.findFirst({
      where: { id: requestId, userId },
      select: {
        quotedPrice: true,
        estimateHours: true,
        client: { select: { formToken: true } },
      },
    })

    // Owner-initiated, so the phone fallback applies - see clientBotChat.
    const chat = await clientBotChat(userId, requestId, { allowPhoneFallback: true })
    const formToken = request?.client.formToken
    if (!chat || !request || !formToken) return false

    const url = portalUrl(formToken, requestId)
    if (!url) return false

    await WahaService.sendMessage({
      chatId: chat.chatId,
      text: quoteSentClientNotice({
        contactName: chat.contactName,
        title: chat.title,
        price: Number(request.quotedPrice ?? 0),
        estimateHours: request.estimateHours == null ? null : Number(request.estimateHours),
        portalUrl: url,
      }),
    })

    return true
  } catch (error) {
    // The quote is recorded and visible in the portal either way. Reporting
    // false rather than throwing lets the dashboard tell Itay to send the link
    // himself, which is far better than silently implying it went out.
    console.error('Failed to notify client about a quote:', error)
    return false
  }
}

/** Itay's own line: the client answered, so something needs doing or does not. */
async function notifyOwnerOfDecision(
  userId: string,
  requestId: string,
  decision: 'APPROVED' | 'DECLINED',
) {
  try {
    const request = await prisma.request.findFirst({
      where: { id: requestId, userId },
      select: {
        title: true,
        quotedPrice: true,
        clientDecisionNote: true,
        client: { select: { name: true } },
        task: { select: { title: true, status: true } },
      },
    })
    if (!request) return

    await notifyOwner(
      clientDecisionOwnerNotice({
        clientName: request.client.name,
        title: request.title,
        decision,
        price: request.quotedPrice == null ? null : Number(request.quotedPrice),
        note: request.clientDecisionNote,
        openTaskTitle: isLiveTask(request.task) ? request.task!.title : null,
      }),
      { about: 'a client decision' },
    )
  } catch (error) {
    // The decision is already recorded and the phase already exists.
    console.error('Failed to notify owner about a client decision:', error)
  }
}

/**
 * A Task still on the list, as opposed to one already dealt with.
 *
 * Only these two states are worth raising on a decline: a COMPLETED task is
 * work already delivered (a conversation to have, not a checkbox), and a
 * CANCELLED one has already been handled.
 */
export function isLiveTask(task: { status: string } | null | undefined): boolean {
  return !!task && (task.status === 'TODO' || task.status === 'IN_PROGRESS')
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
    // Owner-initiated: Itay moved the status himself, so the phone fallback
    // applies here too. Without it these two never reached a client whose
    // request came from the portal form, the batch extractor, or his own
    // typing - which is every request filed before the bot existed.
    const chat = await clientBotChat(userId, requestId, { allowPhoneFallback: true })
    if (!chat) return

    await WahaService.sendMessage({
      chatId: chat.chatId,
      text:
        status === 'IN_PROGRESS'
          ? startedWorkClientNotice(chat.contactName, chat.title)
          : resolvedRequestClientNotice(
              chat.contactName,
              chat.title,
              replyInvitation({ paused: isBotPaused(), portalUrl: await clientPortalUrl(userId, requestId) }),
            ),
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

    // A derived predicate, not a RequestStatus value. "Where is the work" and
    // "where is the money" are two axes: a request can be OPEN and waiting on
    // a client's answer at the same time. Folding them into one enum would
    // also silently re-sort every list, because the orderBy below sorts on a
    // Postgres enum, which sorts by declaration order.
    if (filters?.awaitingClient) {
      where.quotedAt = { not: null }
      where.clientDecisionAt = null
      // A dismissed ticket is invisible in the portal, so its quote can never
      // be answered - leaving it in the chase list would be chasing nothing.
      // Expressed as NOT so it cannot clobber the status filter set above.
      where.NOT = { status: 'DISMISSED' }
    }

    // The dashboard's decision queues. Each predicate is the same one the
    // counter uses, so a tile that says 6 always opens a list of 6.
    if (filters?.queue) {
      if (filters.queue === 'needsPricing') {
        where.status = { in: [...LIVE_STATUSES] }
        where.billingKind = { in: ['BILLABLE', 'QUOTE_REQUIRED'] }
        where.quotedAt = null
      } else if (filters.queue === 'unclassified') {
        where.status = { in: [...LIVE_STATUSES] }
        where.billingKind = null
      } else if (filters.queue === 'awaitingClient') {
        where.quotedAt = { not: null }
        where.clientDecisionAt = null
        where.NOT = { status: 'DISMISSED' }
      } else if (filters.queue === 'withoutTask') {
        where.status = { in: [...LIVE_STATUSES] }
        where.taskId = null
      }
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
        status: true,
        description: true,
        priority: true,
        projectId: true,
        taskId: true,
        intake: true,
        billingKind: true,
        clientDecision: true,
      },
    })

    if (!request || request.taskId) return null

    // An AI draft is not work until Itay has looked at it, which update() also
    // enforces ("יש לאשר את הבקשה לפני שניתן לטפל בה"). approve() clears this
    // by moving the request to OPEN before it gets here; the path that would
    // otherwise slip past is a client accepting a quote on a request that was
    // priced but never triaged.
    if (request.status === 'PENDING_REVIEW') return null

    // The commercial gate. Work the client has to pay for does not become a
    // work item until they have said yes, which is the whole reason the quote
    // fields exist. Returning null rather than throwing keeps owner triage
    // working: approve() still moves the request out of PENDING_REVIEW, only
    // the Task waits.
    //
    // billingKind is null on every request written before this shipped, so the
    // gate is opt-in and the pre-existing flow is untouched.
    if (needsClientApproval(request.billingKind) && request.clientDecision !== 'APPROVED') {
      return null
    }

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

  /**
   * Put a price on a request and send it to the client.
   *
   * A transition, not a field edit, which is why it is here rather than in
   * update(): it has guards of its own, and once a client has agreed to a
   * number that number must not be quietly editable through the generic update
   * route.
   *
   * INCLUDED and WARRANTY cost the client nothing, so they set the
   * classification and stop - no quote goes out and nothing waits on an answer.
   */
  static async sendQuote(userId: string, id: string, input: SendQuoteInput) {
    const existing = await prisma.request.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        projectId: true,
        clientDecision: true,
        client: { select: { formToken: true } },
      },
    })
    if (!existing) {
      throw new Error('בקשה לא נמצאה')
    }

    // Two different questions, and conflating them made QUOTE_REQUIRED
    // impossible to set:
    //
    //   gated  - does this need the client's yes before it becomes work?
    //            BILLABLE and QUOTE_REQUIRED both do. That question is answered
    //            by needsClientApproval() in ensureTask, not here.
    //   priced - is a number going out right now? Only BILLABLE. That is the
    //            only question this method has to answer.
    //
    // QUOTE_REQUIRED means precisely "chargeable, price unknown". Demanding a
    // price for it asked for the one thing the label says you do not have yet,
    // so the only way to classify a big unscoped job was to invent a number.
    // It now classifies and gates, and sends nothing until it is priced.
    const priced = input.billingKind === 'BILLABLE'

    // Checked before the price and project guards so re-pricing agreed work
    // gets the reason it was refused, not a complaint about a missing field.
    if (existing.clientDecision === 'APPROVED') {
      throw new Error('הלקוח כבר אישר את ההצעה - לא ניתן לשנות אותה')
    }

    if (priced && input.quotedPrice == null) {
      throw new Error('בקשה בתשלום חייבת מחיר')
    }

    // Demanding the project here, at quote time, is what guarantees the phase
    // in recordClientDecision() always has somewhere to land. Discovering it is
    // missing after the client has already pressed "מאשר" would be far worse.
    if (priced && !existing.projectId) {
      throw new Error('לא ניתן לשלוח הצעת מחיר לבקשה שלא משויכת לפרויקט')
    }

    // Same argument as the project guard, one step earlier: the portal is the
    // only place the client can answer, and DISMISSED requests never appear
    // there. A quote on one is a price the client is told about and can never
    // accept, while the dashboard keeps it in "ממתין לתשובת הלקוח" forever.
    if (priced && existing.status === 'DISMISSED') {
      throw new Error('לא ניתן לשלוח הצעת מחיר לבקשה שנדחתה')
    }

    // And the client needs a portal at all. Without a form token there is no
    // link to send and no אישור button anywhere - the quote would sit
    // unanswerable rather than merely unsent.
    if (priced && !existing.client.formToken) {
      throw new Error('ללקוח אין קישור פניות - צרו קישור בעמוד הלקוח לפני שליחת הצעת מחיר')
    }

    const request = await prisma.request.update({
      where: { id },
      data: {
        billingKind: input.billingKind,
        estimateHours: input.estimateHours ?? null,
        quotedPrice: priced ? input.quotedPrice : null,
        // A re-quote after a decline is a new offer, so the old answer goes.
        quotedAt: priced ? new Date() : null,
        clientDecision: null,
        clientDecisionAt: null,
        clientDecisionNote: null,
      },
      include: REQUEST_INCLUDE,
    })

    // notified: false means the client has no reachable WhatsApp chat, so the
    // dashboard must offer the portal link to copy instead of pretending a
    // message went out.
    // Only a real number gets a message. Classifying something QUOTE_REQUIRED
    // is Itay's own bookkeeping and the client has nothing to answer yet.
    const notified = priced ? await notifyClientOfQuote(userId, id) : false

    return { ...request, notified }
  }

  /**
   * The client's answer, recorded from the portal.
   *
   * Scoped by formToken and never by userId, because the caller is the client:
   * they hand us a request id and we only ever reach rows belonging to the
   * client that token identifies. That scoping is the portal's whole security
   * model, so it lives in the where clause and not in a check above it.
   *
   * Idempotent by design. A client double-tapping "מאשר" on a phone with a slow
   * connection is the expected case, not an edge case, and it must not bill
   * them twice.
   */
  static async recordClientDecision(
    token: string,
    requestId: string,
    input: ClientDecisionInput,
  ) {
    if (!token) {
      throw new Error('קישור לא תקין')
    }

    const request = await prisma.request.findFirst({
      // DISMISSED is excluded for the same reason the portal hides it: a ticket
      // Itay withdrew must not still be acceptable from a page the client left
      // open, which would build a billing phase for work nobody intends to do.
      where: { id: requestId, client: { formToken: token }, status: { not: 'DISMISSED' } },
      select: {
        id: true,
        userId: true,
        projectId: true,
        title: true,
        quotedPrice: true,
        quotedAt: true,
        clientDecision: true,
        clientDecisionAt: true,
        phaseId: true,
      },
    })

    if (!request) {
      throw new Error('בקשה לא נמצאה')
    }
    if (!request.quotedAt) {
      throw new Error('לא נשלחה הצעת מחיר לבקשה הזו')
    }
    // Already answered: report the standing answer rather than overwriting it.
    if (request.clientDecisionAt) {
      return { alreadyDecided: true, decision: request.clientDecision }
    }

    // Conditional on the answer still being unrecorded, so two taps that both
    // got past the check above cannot both proceed. The phase and task claims
    // below would each survive that anyway, but Itay would get told twice.
    const claimed = await prisma.request.updateMany({
      where: { id: request.id, clientDecisionAt: null },
      data: {
        clientDecision: input.decision,
        clientDecisionAt: new Date(),
        clientDecisionNote: input.note ?? null,
      },
    })

    if (claimed.count === 0) {
      return { alreadyDecided: true, decision: request.clientDecision }
    }

    if (input.decision === 'APPROVED') {
      // Belt for the case guard 6 in sendQuote cannot cover: Request.projectId
      // is onDelete SetNull, so the project can genuinely vanish between the
      // quote going out and the client answering. ensurePhase returns null
      // rather than throwing, because a client who just pressed a button on
      // their phone must not be shown a server error for an owner-side data
      // problem. The owner notice below is how Itay finds out.
      await this.ensurePhase(request.id)
      await this.ensureTask(request.userId, request.id)
    }

    await notifyOwnerOfDecision(request.userId, request.id, input.decision)

    return { alreadyDecided: false, decision: input.decision }
  }

  /**
   * Turn an approved quote into a billing phase.
   *
   * The money gets exactly one home. A request carrying its own price would
   * have meant the dashboard, projectTotal() and the project page each learning
   * about a second revenue source; a phase is already understood by all three,
   * and arrives APPROVED-but-unpaid, which is precisely "work signed off,
   * invoice worth chasing".
   *
   * Idempotency is the unique phaseId claimed by a conditional updateMany, the
   * same shape as the taskId guard above: two concurrent approvals both build a
   * phase, exactly one claims the link, and the loser deletes its own row.
   */
  private static async ensurePhase(requestId: string) {
    const request = await prisma.request.findFirst({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        projectId: true,
        quotedPrice: true,
        phaseId: true,
        billingKind: true,
      },
    })

    if (!request || request.phaseId || !request.projectId) return null
    if (!needsClientApproval(request.billingKind)) return null

    return prisma.$transaction(async (tx) => {
      const last = await tx.projectPhase.findFirst({
        where: { projectId: request.projectId! },
        orderBy: { order: 'desc' },
        select: { order: true },
      })

      const phase = await tx.projectPhase.create({
        data: {
          name: request.title,
          order: (last?.order ?? 0) + 1,
          // NOT_STARTED, and approvedAt deliberately left null.
          //
          // The client approved the *quote*, not the *work*. On a phase,
          // APPROVED means delivered work that was signed off, and it is the
          // exact predicate projectOutstanding() reads for "invoices worth
          // chasing" - which the dashboard and the morning brief both surface.
          // Stamping it here would put money Itay has not earned yet into his
          // chase list on the morning it was sold.
          //
          // The two sign-offs live in two places on purpose: the quote's is
          // Request.clientDecisionAt, the work's stays ProjectPhase.approvedAt
          // and is still set only by PhasesService.update, exactly as before.
          status: 'NOT_STARTED',
          price: request.quotedPrice ?? 0,
          projectId: request.projectId!,
        },
      })

      const linked = await tx.request.updateMany({
        where: { id: request.id, phaseId: null },
        data: { phaseId: phase.id },
      })

      if (linked.count === 0) {
        await tx.projectPhase.delete({ where: { id: phase.id } })
        return null
      }

      return phase
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
