/**
 * What a client is allowed to see about their own requests, decided once.
 *
 * There are two surfaces that speak to a client about a ticket - the portal at
 * /r/[token] and the WhatsApp support agent's getMyRequests tool - and the one
 * thing they must never do is disagree. Before this module the support agent
 * carried its own private copy of the visible-status list and the Hebrew
 * wording, so adding a second surface would have meant a second copy and,
 * eventually, a client being told two different things about one ticket.
 *
 * Three jobs, and nothing else belongs here:
 *
 *   1. which requests a client may see at all (DISMISSED never appears)
 *   2. the derived status, which is not the internal enum
 *   3. the field whitelist that turns a Request row into something safe to send
 *
 * Deliberately pure and prisma-free below the query helper, so the portal's
 * server components, the support agent and the tests can all import it.
 */

import type { Tone } from '@/lib/design/tones'
import {
  INTAKE_FIELD_LABELS,
  INTAKE_FREQUENCY_LABELS,
  readIntake,
  type Intake,
} from '@/lib/validations/intake'
import { projectOutstanding, projectPaid, projectTotal } from '@/lib/utils/project-money'

/**
 * DISMISSED is absent on purpose. A ticket Itay decided not to act on is not a
 * ticket the client should watch sitting there, and telling them "נדחה" through
 * a portal rather than a conversation is the wrong way to have that discussion.
 */
export const CLIENT_VISIBLE_STATUSES = [
  'PENDING_REVIEW',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
] as const

/**
 * The client's lifecycle, which is not the internal one.
 *
 * Internally a quoted request is still just OPEN; what makes it interesting to
 * the client is that it is waiting on *them*. That is a fact about the quote
 * fields, not about the status column, which is why this is derived rather than
 * a sixth RequestStatus - see the plan's note on blast radius.
 */
export type ClientStatus =
  | 'RECEIVED'
  | 'SCHEDULED'
  | 'AWAITING_YOU'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'DECLINED'

export interface RequestStatusFacts {
  status: string
  quotedAt: Date | string | null
  clientDecision: string | null
  clientDecisionAt: Date | string | null
}

/**
 * Precedence matters more than the mapping does.
 *
 * An unanswered quote outranks everything except a dismissal: a request can be
 * OPEN and quoted at the same time, and "ממתין לאישורך" is the only one of
 * those two facts the client can act on. Returns null for anything they should
 * not see at all, so callers filter on the return value rather than repeating
 * the visibility rule.
 */
export function clientStatusOf(request: RequestStatusFacts): ClientStatus | null {
  if (request.status === 'DISMISSED') return null

  if (request.quotedAt && !request.clientDecisionAt) return 'AWAITING_YOU'
  if (request.clientDecision === 'DECLINED') return 'DECLINED'

  if (request.status === 'RESOLVED') return 'DONE'
  if (request.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (request.status === 'OPEN') return 'SCHEDULED'

  return 'RECEIVED'
}

/** A quote the client has been shown and has not yet answered. */
export function isAwaitingClient(request: RequestStatusFacts): boolean {
  return !!request.quotedAt && !request.clientDecisionAt
}

/**
 * The columns a client may read. Everything the portal and the bot select
 * flows from here, so a new internal field cannot leak by being forgotten.
 */
export const clientRequestSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  attachments: true,
  billingKind: true,
  estimateHours: true,
  quotedPrice: true,
  quotedAt: true,
  clientDecision: true,
  clientDecisionAt: true,
  // The client's own words, written by them, and until now unreadable back to
  // them: declining a quote takes up to 1,000 characters explaining why, and
  // the only place it surfaced was Itay's WhatsApp.
  clientDecisionNote: true,
  // Answers this client gave the support agent. See clientIntakeAnswers for
  // the field-by-field whitelist - the column is Json and must never be spread.
  intake: true,
  project: { select: { id: true, name: true } },
} as const

/**
 * One attachment, addressable but not locatable.
 *
 * The client uploaded these and has never been able to tell them apart: the
 * portal rendered "קובץ 1", "קובץ 2". The display name is the last path segment,
 * which sanitizeName() has already stripped to `[A-Za-z0-9._-]` - so a Hebrew
 * filename arrives here as underscores and is reported as no name at all rather
 * than as `____.png`. The extension survives either way, and "which one is the
 * PDF" is most of what a client needs.
 *
 * The path itself still never leaves this module. Opening a file stays an index
 * lookup through resolveClientAttachment.
 */
export interface ClientAttachmentView {
  index: number
  name: string | null
  kind: string | null
}

export function toClientAttachments(paths: string[]): ClientAttachmentView[] {
  return paths.map((path, index) => {
    const segment = path.split('/').pop() ?? ''
    const dot = segment.lastIndexOf('.')
    const stem = dot > 0 ? segment.slice(0, dot) : segment
    const ext = dot > 0 ? segment.slice(dot + 1) : ''

    return {
      index,
      name: /[a-zA-Z0-9]/.test(stem) ? segment : null,
      kind: ext ? ext.toUpperCase() : null,
    }
  })
}

/**
 * The intake, played back to the person who supplied it.
 *
 * The support agent interviews a client - where, what happened, what they
 * expected, how often, is it blocking - and stores the answers on the request.
 * They are folded into the Task description for Itay and shown to the client
 * never, which means nobody can catch a misunderstanding until the wrong thing
 * has been built.
 *
 * Whitelisted field by field, and `suggestedType` is dropped: it is the agent's
 * guess at the ticket type, documented in the schema as a hint for Itay only.
 * The client was never asked, so showing them a machine's answer as if it were
 * theirs would be a lie about the conversation they just had.
 */
export interface ClientIntakeAnswer {
  field: string
  label: string
  value: string
}

const CLIENT_INTAKE_FIELDS = [
  'where',
  'whatHappened',
  'expected',
  'frequency',
  'workedBefore',
  'blocking',
  'goal',
  'today',
] as const satisfies ReadonlyArray<keyof Intake>

export function clientIntakeAnswers(value: unknown): ClientIntakeAnswer[] {
  const intake = readIntake(value)

  return CLIENT_INTAKE_FIELDS.flatMap((field) => {
    const answer = intake[field]
    if (answer === null || answer === undefined || answer === '') return []

    const rendered =
      field === 'frequency'
        ? (INTAKE_FREQUENCY_LABELS[answer as keyof typeof INTAKE_FREQUENCY_LABELS] ?? String(answer))
        : typeof answer === 'boolean'
          ? answer
            ? 'כן'
            : 'לא'
          : String(answer)

    return [{ field, label: INTAKE_FIELD_LABELS[field], value: rendered }]
  })
}

export interface ClientRequestView {
  id: string
  title: string
  description: string | null
  type: string
  clientStatus: ClientStatus
  projectName: string | null
  billingKind: string | null
  estimateHours: number | null
  quotedPrice: number | null
  quotedAt: string | null
  decidedAt: string | null
  decision: string | null
  awaitingDecision: boolean
  attachmentCount: number
  attachments: ClientAttachmentView[]
  /** Why they declined, in their own words. Null unless they wrote one. */
  declineNote: string | null
  intake: ClientIntakeAnswer[]
  openedAt: string
  resolvedAt: string | null
}

/**
 * A whitelist, never a blacklist.
 *
 * Built by naming what goes out rather than deleting what must not, because the
 * failure mode of the other direction is silent: someone adds an internal field
 * to Request, nobody updates a delete list, and aiNote ends up on a client's
 * screen. aiNote, aiConfidence, isAiGenerated, userId, taskId and
 * sourceMessageId must never appear in this function.
 */
export function toClientRequest(row: {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  createdAt: Date
  resolvedAt: Date | null
  attachments: string[]
  billingKind: string | null
  estimateHours: unknown
  quotedPrice: unknown
  quotedAt: Date | null
  clientDecision: string | null
  clientDecisionAt: Date | null
  clientDecisionNote?: string | null
  intake?: unknown
  project: { id: string; name: string } | null
}): ClientRequestView | null {
  const clientStatus = clientStatusOf(row)
  if (!clientStatus) return null

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    clientStatus,
    projectName: row.project?.name ?? null,
    billingKind: row.billingKind,
    estimateHours: decimal(row.estimateHours),
    quotedPrice: decimal(row.quotedPrice),
    quotedAt: row.quotedAt?.toISOString() ?? null,
    decidedAt: row.clientDecisionAt?.toISOString() ?? null,
    decision: row.clientDecision,
    awaitingDecision: isAwaitingClient(row),
    attachmentCount: row.attachments.length,
    attachments: toClientAttachments(row.attachments),
    declineNote: row.clientDecision === 'DECLINED' ? (row.clientDecisionNote ?? null) : null,
    intake: clientIntakeAnswers(row.intake),
    openedAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  }
}

/* -------------------------------------------------------------------------
 * The client's timeline.
 * ---------------------------------------------------------------------- */

/**
 * A request's history in the second person.
 *
 * This cannot reuse buildTimeline() from request-timeline.ts, and the reason is
 * not styling: that one is written from the owner's chair - "הלקוח אישר",
 * "נוצרה משימה", "סווג כבתשלום" - and reads `request.task` and `isAiGenerated`,
 * neither of which is in the whitelist above. Told to a client, half of its
 * events are either meaningless or none of their business.
 *
 * Same honest limit, inherited deliberately: Request has no `startedAt`, so
 * "work started" cannot be dated. The current step is emitted with `at: null`
 * and rendered as the undated *now* rather than being stamped with a timestamp
 * that would be a guess.
 */
export type ClientTimelineState = 'done' | 'now' | 'ahead'

export interface ClientTimelineEvent {
  key: string
  label: string
  /** ISO, or null for the current step and everything after it. */
  at: string | null
  state: ClientTimelineState
  tone: Tone
  note?: string
}

/** What has not happened yet, so the page shows the shape of the rest. */
const AHEAD: Record<string, Array<{ key: string; label: string }>> = {
  RECEIVED: [
    { key: 'to-progress', label: 'בפיתוח' },
    { key: 'to-deliver', label: 'נמסר לבדיקה שלך' },
  ],
  SCHEDULED: [
    { key: 'to-progress', label: 'בפיתוח' },
    { key: 'to-deliver', label: 'נמסר לבדיקה שלך' },
  ],
  AWAITING_YOU: [
    { key: 'to-plan', label: 'נכנס לתוכנית העבודה' },
    { key: 'to-progress', label: 'בפיתוח' },
    { key: 'to-deliver', label: 'נמסר לבדיקה שלך' },
  ],
  IN_PROGRESS: [{ key: 'to-deliver', label: 'נמסר לבדיקה שלך' }],
  DONE: [],
  DECLINED: [],
}

const NOW: Record<string, { label: string; tone: Tone } | null> = {
  RECEIVED: { label: 'ממתינה לבדיקה שלנו', tone: 'info' },
  SCHEDULED: { label: 'ממתינה לתורה', tone: 'neutral' },
  AWAITING_YOU: { label: 'ממתינה לאישורך', tone: 'caution' },
  IN_PROGRESS: { label: 'בפיתוח', tone: 'progress' },
  DONE: null,
  DECLINED: null,
}

export function buildClientTimeline(view: ClientRequestView): ClientTimelineEvent[] {
  const events: ClientTimelineEvent[] = [
    { key: 'opened', label: 'הפנייה נפתחה', at: view.openedAt, state: 'done', tone: 'info' },
  ]

  if (view.quotedAt) {
    events.push({
      key: 'quoted',
      label: 'נשלחה אליך הצעת מחיר',
      at: view.quotedAt,
      state: 'done',
      tone: 'caution',
    })
  }

  if (view.decidedAt) {
    const approved = view.decision === 'APPROVED'
    events.push({
      key: 'decided',
      label: approved ? 'אישרת את ההצעה' : 'לא אישרת את ההצעה',
      at: view.decidedAt,
      state: 'done',
      tone: approved ? 'success' : 'neutral',
      // Their own words, read back. The point is that a decline is the opening
      // of a conversation, and the client should see what they said in it.
      note: view.declineNote ?? undefined,
    })
  }

  if (view.resolvedAt) {
    events.push({
      key: 'resolved',
      label: 'הושלם',
      at: view.resolvedAt,
      state: 'done',
      tone: 'success',
    })
  }

  const now = NOW[view.clientStatus]
  if (now) {
    events.push({ key: 'now', label: now.label, at: null, state: 'now', tone: now.tone })
  }

  for (const step of AHEAD[view.clientStatus] ?? []) {
    events.push({ ...step, at: null, state: 'ahead', tone: 'neutral' })
  }

  return events
}

/** Prisma Decimal, the string JSON made of it, or nothing. */
function decimal(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}


/* -------------------------------------------------------------------------
 * Projects and phases, on the same terms as requests above.
 * ---------------------------------------------------------------------- */

/**
 * What a client may read about their own project.
 *
 * ProjectPhase is the safest model in the schema to expose - name, order,
 * status, price, approvedAt, paidAt, and not one owner-private column among
 * them. Every value is something this client already agreed to.
 *
 * Absent on purpose: `userId`, and the `agentConfig` and `productCard`
 * relations. productCard in particular is machine-generated from the client's
 * own repository to ground the support bot, is unreviewed, and is framed around
 * what does NOT exist - it is not a customer-facing product description.
 */
export const clientProjectSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  status: true,
  startDate: true,
  deadline: true,
  completedAt: true,
  advanceAmount: true,
  advancePaidAt: true,
  phases: {
    select: {
      id: true,
      name: true,
      order: true,
      status: true,
      price: true,
      approvedAt: true,
      paidAt: true,
      clientReviewedAt: true,
      clientNote: true,
    },
    orderBy: { order: 'asc' },
  },
} as const

/**
 * A phase in the client's words.
 *
 * The trap this exists to avoid: PhaseStatus.APPROVED means *delivered work was
 * signed off*, and a phase created when a client approves a quote is born
 * NOT_STARTED. Rendering the raw enum would tell a client the work is done
 * because they agreed to pay for it. Same reasoning as clientStatusOf above.
 */
export type ClientPhaseStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'AWAITING_YOU' | 'DONE' | 'PAID'

export function clientPhaseStatusOf(phase: {
  status: string
  paidAt: Date | string | null
}): ClientPhaseStatus {
  if (phase.paidAt) return 'PAID'
  if (phase.status === 'APPROVED') return 'DONE'
  if (phase.status === 'PENDING_APPROVAL') return 'AWAITING_YOU'
  /**
   * REVISIONS is Itay's turn, not the client's.
   *
   * It used to land on AWAITING_YOU alongside PENDING_APPROVAL, which was
   * harmless while the portal had no phase action at all - both rendered as an
   * unactionable chip. It stopped being harmless the moment a review control
   * existed, because it would have put an approve button on work that is
   * actively being redone *because the client asked for changes*.
   *
   * The internal label says it plainly: 'סבב תיקונים', a revision round. The
   * ball is on his side, so to the client this is simply work in progress.
   */
  if (phase.status === 'REVISIONS' || phase.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  return 'SCHEDULED'
}

export interface ClientPhaseView {
  id: string
  name: string
  status: ClientPhaseStatus
  price: number
  /**
   * Both were already selected and both were thrown away at the DTO boundary,
   * collapsed into a status pill. The journey rail needs them: a step that
   * happened without a date is a claim, and a step that happened *on the 4th of
   * August* is proof.
   */
  approvedAt: string | null
  paidAt: string | null
  /**
   * The client can answer on this phase right now.
   *
   * Derived rather than left to the caller to infer from `status`, because
   * "which phases are answerable" is exactly the kind of rule that gets
   * re-implemented slightly differently in a component and a bot tool.
   */
  awaitingReview: boolean
  /** When the client themselves last answered. Null if only Itay has. */
  reviewedAt: string | null
  /** What they asked to be changed, read back to them while it is being done. */
  clientNote: string | null
}

export interface ClientProjectView {
  id: string
  name: string
  description: string | null
  status: string
  deadline: string | null
  completedAt: string | null
  /**
   * The advance, as its own line.
   *
   * It is part of `total` and part of `paid`, but it is not a phase - so a
   * client reading the phase rail could add every row up and land short of the
   * total with nothing on the page explaining the gap. Exposed so the rail can
   * carry it as the step it actually is. Null when there is no advance.
   */
  advance: { amount: number; paidAt: string | null } | null
  phases: ClientPhaseView[]
  /** Everything agreed: the advance plus every phase. */
  total: number
  paid: number
  /** Signed-off work not yet settled. Never includes work merely quoted. */
  outstanding: number
  /**
   * Agreed, but not yet earned - so not yet owed.
   *
   * Lived in project-card.tsx as `total - paid - outstanding` computed in JSX,
   * which is exactly how the portal's answer and the support bot's answer to
   * "how much do I owe you" drift apart without anyone touching either. It is
   * derived in one place now, next to the three figures it reconciles.
   */
  notYetDue: number
}

/** Whitelist, same discipline as toClientRequest. */
export function toClientProject(row: {
  id: string
  name: string
  description: string | null
  status: string
  deadline: Date | null
  completedAt: Date | null
  advanceAmount: unknown
  advancePaidAt: Date | null
  phases: {
    id: string
    name: string
    status: string
    price: unknown
    approvedAt: Date | null
    paidAt: Date | null
    clientReviewedAt?: Date | null
    clientNote?: string | null
  }[]
}): ClientProjectView {
  const phases = row.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    status: clientPhaseStatusOf(phase),
    price: decimal(phase.price) ?? 0,
    approvedAt: phase.approvedAt?.toISOString() ?? null,
    paidAt: phase.paidAt?.toISOString() ?? null,
    awaitingReview: phase.status === 'PENDING_APPROVAL',
    reviewedAt: phase.clientReviewedAt?.toISOString() ?? null,
    clientNote: phase.clientNote ?? null,
  }))

  const money = row.phases.map((p) => ({
    price: decimal(p.price) ?? 0,
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  }))

  const advanceAmount = decimal(row.advanceAmount) ?? 0
  const total = projectTotal(decimal(row.advanceAmount), money)
  const paid = projectPaid(decimal(row.advanceAmount), row.advancePaidAt, money)
  const outstanding = projectOutstanding(money)

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    deadline: row.deadline?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    advance:
      advanceAmount > 0
        ? { amount: advanceAmount, paidAt: row.advancePaidAt?.toISOString() ?? null }
        : null,
    phases,
    total,
    paid,
    outstanding,
    // Clamped, because a phase can be marked paid without ever being approved -
    // marking the advance and a phase paid up front is a normal thing to do -
    // and a negative "not yet due" is a number no client can make sense of.
    notYetDue: Math.max(0, total - paid - outstanding),
  }
}
