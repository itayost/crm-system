import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { describeModelError, ollamaModel, withModelFallback } from '@/lib/ai/resilient-model'
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  CONTACT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  TASK_CATEGORY_LABELS,
  PRIORITY_LABELS,
  label,
} from '@/lib/design/labels'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import {
  isSignedOffUnpaid,
  phaseEntry,
  signedOffUnpaid,
} from '@/lib/money/ledger'

const BRIEF_TIME_ZONE = process.env.BRIEF_TIME_ZONE ?? 'Asia/Jerusalem'

/**
 * How many lines any one section will print before it says "ועוד N".
 *
 * A cap is necessary - the prompt should not grow without bound - but a silent
 * one is worse than none: the pending-requests section used to take 10 rows,
 * print five of them, and report the count of the ten, so a genuinely busy day
 * looked like a mildly busy one.
 */
const LIST_CAP = 8

/** Caps a section's lines and says so, rather than quietly dropping the tail. */
function capped(lines: string[], total = lines.length): string[] {
  if (total <= LIST_CAP) return lines
  return [...lines.slice(0, LIST_CAP), `- ...ועוד ${total - LIST_CAP}`]
}

/**
 * Midnight in Israel, expressed as a UTC instant. Derived from the zone rather
 * than a fixed offset so it stays correct across daylight saving.
 */
export function startOfIsraelDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRIEF_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const localMidnightAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'))
  const localNowAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  )

  // now - (elapsed since local midnight) = the instant local midnight happened.
  // The milliseconds have to come off separately: Intl parts stop at seconds,
  // so without this the "boundary" sat a few hundred ms after midnight and a
  // task due at exactly 00:00:00.000 counted as overdue.
  return new Date(
    now.getTime() - (localNowAsUtc - localMidnightAsUtc) - now.getMilliseconds()
  )
}

export class MorningBriefService {
  static async generateBrief(userId: string): Promise<string> {
    const now = new Date()
    // The brief is read over breakfast in Israel but runs on a UTC server, so
    // local-time boundaries would put "today" at 03:00-03:00 and report this
    // morning's tasks as overdue.
    const todayStart = startOfIsraelDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    // All measured from the Israel day boundary, not from `now`. Measured from
    // `now` they were rolling windows anchored to whenever the cron happened to
    // fire, so "new leads in the last 24 hours" drifted against "today" and a
    // lead created yesterday evening could fall outside both.
    const threeDaysAgo = new Date(todayStart.getTime() - 3 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000)
    const sinceYesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

    const [
      overdueTasks,
      todayTasks,
      weekTasks,
      newLeads,
      staleLeads,
      dueNextActions,
      activeProjects,
      taskCountsByCategory,
      recentMarketingTasks,
      pendingRequests,
      pendingRequestCount,
      openRequests,
      openRequestCount,
    ] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: todayStart } },
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: todayStart, lt: todayEnd } },
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: todayEnd, lt: weekEnd } },
        include: { project: { select: { name: true, client: { select: { name: true } } } } },
      }),
      prisma.contact.findMany({
        where: { userId, status: { in: [...LEAD_STATUSES] }, createdAt: { gte: sinceYesterday } },
      }),
      prisma.contact.findMany({
        where: {
          userId,
          status: { in: [...LEAD_STATUSES] },
          // A lead with a scheduled next action is not neglected, it is
          // waiting. It belongs in "פעולות להיום" on its day, not here.
          nextActionAt: null,
          OR: [
            { lastContactedAt: { lt: threeDaysAgo } },
            { lastContactedAt: null, createdAt: { lt: threeDaysAgo } },
          ],
        },
        select: { name: true, status: true, lastContactedAt: true, createdAt: true },
      }),
      prisma.contact.findMany({
        where: {
          userId,
          status: { in: [...LEAD_STATUSES] },
          nextActionAt: { lt: todayEnd },
        },
        orderBy: { nextActionAt: 'asc' },
        select: { name: true, phone: true, status: true, nextActionAt: true, nextActionNote: true },
      }),
      prisma.project.findMany({
        where: { userId, status: 'ACTIVE' },
        include: {
          client: { select: { name: true } },
          phases: { orderBy: { order: 'asc' } },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.groupBy({
        by: ['category'],
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
        _count: true,
      }),
      prisma.task.count({
        where: { userId, category: 'MARKETING', createdAt: { gte: fourteenDaysAgo } },
      }),
      prisma.request.findMany({
        where: { userId, status: 'PENDING_REVIEW' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: LIST_CAP,
        include: {
          client: { select: { name: true } },
          contact: { select: { name: true } },
        },
      }),
      // The real total, so a capped list can say how much it is hiding.
      prisma.request.count({ where: { userId, status: 'PENDING_REVIEW' } }),
      // Work already committed to, as opposed to work awaiting a decision.
      // The brief never mentioned these at all.
      prisma.request.findMany({
        where: { userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: LIST_CAP,
        include: {
          client: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.request.count({ where: { userId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ])

    const formatTask = (t: { title: string; priority: string; dueDate: Date | null; project: { name: string; client: { name: string } | null } | null }) => {
      const client = t.project?.client?.name ?? ''
      const project = t.project?.name ?? ''
      // Was printing the raw enum - "HIGH" - straight into a prompt whose own
      // last instruction forbids English enum values.
      const priority = label(PRIORITY_LABELS, t.priority)
      const due = t.dueDate ? t.dueDate.toLocaleDateString('he-IL') : ''
      return `- ${t.title}${client ? ` (${client})` : ''}${project ? ` [${project}]` : ''} | ${priority}${due ? ` | ${due}` : ''}`
    }

    // Two things that only become visible once money lives on phases: work
    // sitting in the client's court, and work signed off but never paid for.
    //
    // These ask different questions. The money figures come from lib/money/ledger
    // so this brief cannot tell Itay a different story than the כספים badge,
    // the היום board and /money. Advance is excluded; both count only phases (work
    // signed off), which is לתשלום rather than גבייה.
    //
    // The awaiting-approval list, though, deliberately does NOT use the core's
    // isAwaitingApproval predicate. That predicate answers a money question
    // (how much is awaiting sign-off?) and applies payment-wins-over-status logic
    // correctly for money. But the list answers a WORKFLOW question: where is this
    // phase sitting *in the approval process*? A paid-but-still-pending phase
    // should stay on the list because the client has not yet signed off the work.
    //
    // Both are scoped to ACTIVE projects, narrower than every other surface,
    // preserved deliberately: widening either would move a number in the daily
    // message without anyone asking for it.
    const awaitingApproval = activeProjects.flatMap((p) =>
      p.phases
        .filter((ph) => ph.status === 'PENDING_APPROVAL')
        .map((ph) => `- ${ph.name} (${p.name} / ${p.client.name})`)
    )

    const unpaidPhases = activeProjects.flatMap((p) =>
      p.phases
        .map((ph) => ({ ph, entry: phaseEntry(ph) }))
        .filter(({ entry }) => isSignedOffUnpaid(entry))
        .map(({ ph, entry }) => ({
          line: `- ${ph.name} (${p.name} / ${p.client.name}) | ${entry.price.toLocaleString()} ₪`,
          amount: entry.price,
        }))
    )
    const unpaidTotal = signedOffUnpaid(activeProjects.flatMap((p) => p.phases.map(phaseEntry)))

    // Every section that has something to say, in reading order. Sections with
    // nothing in them are dropped rather than reported as empty: the brief used
    // to hand the model eleven "אין" lines on a quiet day and ask it to write
    // something motivating about them, and it obliged with filler.
    const sections: {
      title: string
      lines: string[]
      total?: number
      suffix?: string
      /** For sections whose line count is not a count of anything meaningful. */
      hideCount?: boolean
    }[] = [
      { title: 'משימות באיחור', lines: overdueTasks.map(formatTask) },
      { title: 'משימות להיום', lines: todayTasks.map(formatTask) },
      { title: 'משימות השבוע', lines: weekTasks.map(formatTask) },
      {
        title: 'לידים חדשים (מאתמול)',
        lines: newLeads.map(
          (l) => `- ${l.name} | ${l.phone} | ${label(CONTACT_SOURCE_LABELS, l.source)}`
        ),
      },
      {
        title: 'פעולות להיום',
        lines: dueNextActions.map((l) => {
            const due = l.nextActionAt!
            const overdue = due < todayStart ? ' [באיחור]' : ''
            const note = l.nextActionNote ? ` - ${l.nextActionNote}` : ''
            return `- ${l.name} (${label(CONTACT_STATUS_LABELS, l.status)})${note} | ${due.toLocaleDateString('he-IL')}${overdue}`
        }),
      },
      {
        title: 'לידים ללא פעולה מתוכננת וללא קשר 3+ ימים',
        lines: staleLeads.map((l) => `- ${l.name} (${label(CONTACT_STATUS_LABELS, l.status)})`),
      },
      {
        title: 'שלבים ממתינים לאישור לקוח',
        lines: awaitingApproval,
      },
      {
        title: 'שלבים לתשלום בפרויקטים פעילים',
        lines: unpaidPhases.map((p) => p.line),
        suffix: unpaidTotal > 0 ? `, סה"כ ${unpaidTotal.toLocaleString()} ₪` : undefined,
      },
      {
        title: 'פניות ממתינות לאישור',
        lines: pendingRequests.map(
          (r) =>
            `- [${label(REQUEST_TYPE_LABELS, r.type)}] ${r.title} (${r.client?.name ?? r.contact?.name ?? 'לא ידוע'})`
        ),
        // The query is already capped, so the honest count comes from a count().
        total: pendingRequestCount,
      },
      {
        title: 'פניות פתוחות',
        lines: openRequests.map(
          (r) =>
            `- [${label(REQUEST_TYPE_LABELS, r.type)}] ${r.title} (${r.client?.name ?? 'לא ידוע'})` +
            `${r.project ? ` [${r.project.name}]` : ''} | ${label(REQUEST_STATUS_LABELS, r.status)}`
        ),
        total: openRequestCount,
      },
      {
        title: 'משימות ממתינות לפי קטגוריה',
        lines: taskCountsByCategory.map(
          (c) => `- ${label(TASK_CATEGORY_LABELS, c.category)}: ${c._count}`
        ),
        // The line count here is a number of categories, which would read as a
        // number of tasks.
        hideCount: true,
      },
      {
        title: 'פרויקטים בתהליך',
        lines: activeProjects.map(
          (p) => `- ${p.name} (${p.client.name}) | ${p._count.tasks} משימות`
        ),
      },
    ]

    const total = (s: { lines: string[]; total?: number }) => s.total ?? s.lines.length
    const filled = sections.filter((s) => total(s) > 0)

    const header = `תאריך: ${now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    const body = filled
      .map((s) => {
        const head = s.hideCount ? s.title : `${s.title} (${total(s)}${s.suffix ?? ''})`
        return `${head}:\n${capped(s.lines, total(s)).join('\n')}`
      })
      .join('\n\n')

    const briefData = [
      header,
      // A genuinely quiet day should say so once, not arrive blank and invite
      // the model to fill the silence.
      filled.length > 0 ? body : 'אין משימות פתוחות, לידים ממתינים או תשלומים פתוחים.',
      `משימות שיווק ב-14 ימים אחרונים: ${recentMarketingTasks}`,
    ].join('\n\n')

    const system = `You write a daily morning brief for a Hebrew-speaking freelancer (Itay).
You receive CRM data and write a natural WhatsApp message in Hebrew.

IMPORTANT — the data only contains sections that have something in them.
A section that is absent means there is nothing there. Never mention a section
that was not supplied, never say a section is empty, and never speculate that
data might be missing. Silence means "nothing to do", which is good news.

Only these sections can appear:
משימות באיחור · משימות להיום · משימות השבוע · לידים חדשים (מאתמול) ·
פעולות להיום · לידים ללא פעולה מתוכננת וללא קשר 3+ ימים ·
שלבים ממתינים לאישור לקוח · שלבים לתשלום בפרויקטים פעילים · פניות ממתינות לאישור ·
פניות פתוחות · משימות ממתינות לפי קטגוריה · פרויקטים בתהליך
A count in a title is the real total; "...ועוד N" means the list was trimmed.
"משימות ממתינות לפי קטגוריה" and "משימות שיווק ב-14 ימים אחרונים" are counts and
nothing more — never infer anything about an individual task from them, such as
which project it belongs to or whether it has one.

Write it like this:
1. Open with "בוקר טוב!" and the Hebrew date.
2. Lead with what actually needs doing today, most pressing first, naming
   specifics rather than counts. If "פעולות להיום" is present it comes first:
   those are actions Itay committed to himself on named leads, so they outrank
   anything you infer. Mention [באיחור] ones before the rest.
3. Then anything worth chasing, only where the data supports it:
   - "שלבים ממתינים לאישור לקוח" → nudge to chase the client for sign-off.
   - "שלבים לתשלום בפרויקטים פעילים" → nudge to invoice or chase payment, and give the total.
   - "פניות ממתינות לאישור" → suggest approving or dismissing via the bot.
   - "פניות פתוחות" → work already promised to a client; flag anything stale.
   - No marketing tasks in 14 days → a short nudge.
4. Close with one motivating line.

Length must track the day: if there is little to report, write a short message
and say the day is clear. Do not pad, do not invent, do not repeat the same item
in two sections. Never use a numbered-section layout in the output itself — it
should read like a message from a colleague, not a form.

Use WhatsApp formatting: *bold* (single asterisk), _italic_ (underscore).
NEVER use Markdown syntax. NEVER escape underscores with backslash.
Every label in the data is already Hebrew — keep it that way and never write an
English enum value such as HIGH, WEBSITE or PENDING_REVIEW.`

    // Background work runs on the local model by default and pays the gateway
    // only when the VPS cannot answer - the reverse of the client-facing chain.
    // One brief a day is latency-free, so slow CPU inference costs nothing.
    const result = await withModelFallback(
      async () => {
        const local = ollamaModel()
        if (!local) throw new Error('Ollama not configured')
        return generateText({
          model: local,
          system,
          prompt: briefData,
          maxOutputTokens: 1024,
          abortSignal: AbortSignal.timeout(240_000),
        })
      },
      () =>
        generateText({
          model: gateway('anthropic/claude-sonnet-4.6'),
          system,
          prompt: briefData,
        }),
      (error) =>
        console.warn('Morning brief: local model unavailable, using gateway:', describeModelError(error))
    )

    return result.text
  }
}
