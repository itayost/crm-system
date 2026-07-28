import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { REQUEST_TYPE_LABELS, CONTACT_STATUS_LABELS, label } from '@/lib/design/labels'
import { LEAD_STATUSES } from '@/lib/validations/enums'

const BRIEF_TIME_ZONE = process.env.BRIEF_TIME_ZONE ?? 'Asia/Jerusalem'

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
  return new Date(now.getTime() - (localNowAsUtc - localMidnightAsUtc))
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
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      overdueTasks,
      todayTasks,
      weekTasks,
      newLeads,
      staleClients,
      staleLeads,
      dueNextActions,
      activeProjects,
      taskCountsByCategory,
      recentMarketingTasks,
      pendingRequests,
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
        where: { userId, status: { in: [...LEAD_STATUSES] }, createdAt: { gte: yesterday } },
      }),
      prisma.contact.findMany({
        where: {
          userId,
          status: 'CLIENT',
          // A NULL lastContactedAt is the worst case, not an exemption: Prisma
          // treats `lt` as excluding NULL, so never-contacted clients were the
          // only ones the brief never mentioned.
          OR: [
            { lastContactedAt: { lt: sevenDaysAgo } },
            { lastContactedAt: null, createdAt: { lt: sevenDaysAgo } },
          ],
        },
        select: { name: true, lastContactedAt: true },
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
        take: 10,
        include: {
          client: { select: { name: true } },
          contact: { select: { name: true } },
        },
      }),
    ])

    const formatTask = (t: { title: string; priority: string; dueDate: Date | null; project: { name: string; client: { name: string } | null } | null }) => {
      const client = t.project?.client?.name ?? ''
      const project = t.project?.name ?? ''
      const priority = t.priority
      const due = t.dueDate ? t.dueDate.toLocaleDateString('he-IL') : ''
      return `- ${t.title}${client ? ` (${client})` : ''}${project ? ` [${project}]` : ''} | ${priority}${due ? ` | ${due}` : ''}`
    }

    const briefData = `
תאריך: ${now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

משימות באיחור (${overdueTasks.length}):
${overdueTasks.length > 0 ? overdueTasks.map(formatTask).join('\n') : 'אין'}

משימות להיום (${todayTasks.length}):
${todayTasks.length > 0 ? todayTasks.map(formatTask).join('\n') : 'אין'}

משימות השבוע (${weekTasks.length}):
${weekTasks.length > 0 ? weekTasks.map(formatTask).join('\n') : 'אין'}

לידים חדשים (24 שעות אחרונות): ${newLeads.length}
${newLeads.map(l => `- ${l.name} | ${l.phone} | ${l.source}`).join('\n')}

לקוחות ללא קשר 7+ ימים (${staleClients.length}):
${staleClients.map(c => `- ${c.name} (קשר אחרון: ${c.lastContactedAt?.toLocaleDateString('he-IL') ?? 'לא ידוע'})`).join('\n')}

פעולות להיום (${dueNextActions.length}):
${dueNextActions.length > 0
  ? dueNextActions
      .map((l) => {
        const due = l.nextActionAt!
        const overdue = due < todayStart ? ' [באיחור]' : ''
        const note = l.nextActionNote ? ` - ${l.nextActionNote}` : ''
        return `- ${l.name} (${label(CONTACT_STATUS_LABELS, l.status)})${note} | ${due.toLocaleDateString('he-IL')}${overdue}`
      })
      .join('\n')
  : 'אין'}

לידים ללא פעולה מתוכננת וללא קשר 3+ ימים (${staleLeads.length}):
${staleLeads.map(l => `- ${l.name} (${label(CONTACT_STATUS_LABELS, l.status)})`).join('\n')}

פרויקטים בתהליך (${activeProjects.length}):
${activeProjects.map(p => `- ${p.name} (${p.client.name}) | ${p._count.tasks} משימות`).join('\n')}

משימות ממתינות לפי קטגוריה:
${taskCountsByCategory.map(c => {
      const labels: Record<string, string> = { CLIENT_WORK: 'עבודת לקוח', MARKETING: 'שיווק', LEAD_FOLLOWUP: 'מעקב לידים', ADMIN: 'מנהלה' }
      return `- ${labels[c.category] ?? c.category}: ${c._count}`
    }).join('\n')}

משימות שיווק ב-14 ימים אחרונים: ${recentMarketingTasks}

בקשות חדשות לאישור (${pendingRequests.length}):
${pendingRequests.length > 0
  ? pendingRequests
      .slice(0, 5)
      .map(
        (r) =>
          `- [${REQUEST_TYPE_LABELS[r.type] ?? r.type}] ${r.title} (${r.client?.name ?? r.contact?.name ?? 'לא ידוע'})`
      )
      .join('\n')
  : 'אין'}
`

    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: `You write a daily morning brief for a Hebrew-speaking freelancer.
You receive raw CRM data and write a natural, concise WhatsApp message.

Structure:
1. Start with "בוקר טוב!" and the Hebrew date
2. Top 3 priorities for today (you decide based on urgency, deadlines, staleness — be specific and actionable)
3. Quick summary: overdue count, today count, new leads
4. If there are "פעולות להיום", give them their own short section. These are next
   actions Itay scheduled himself on specific leads, so they outrank anything
   inferred — name the lead and what he said he would do. Call out [באיחור] ones first.
5. Proactive suggestions section (only if relevant):
   - Follow-up reminders for stale contacts/leads
   - Marketing nudge if no marketing tasks in 14 days
   - Any other observations
6. If there are "בקשות חדשות לאישור", add a short section "X בקשות ממתינות לאישור" with the 3 most important items, and suggest Itay approve/dismiss them via the bot
7. End with a motivating one-liner

Use WhatsApp formatting: *bold* (single asterisk), _italic_ (underscore).
Keep it scannable — max 16 lines.
NEVER use Markdown syntax. NEVER escape underscores with backslash. Write plain Hebrew text.
Use Hebrew labels for categories (עבודת לקוח, שיווק, מעקב לידים, מנהלה) — never show English enum values.`,
      prompt: briefData,
    })

    return result.text
  }
}
