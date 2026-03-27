import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] as const

export class MorningBriefService {
  static async generateBrief(userId: string): Promise<string> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
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
      activeProjects,
      taskCountsByCategory,
      recentMarketingTasks,
    ] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: todayStart } },
        include: { project: { select: { name: true, contact: { select: { name: true } } } } },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: todayStart, lt: todayEnd } },
        include: { project: { select: { name: true, contact: { select: { name: true } } } } },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { gte: todayEnd, lt: weekEnd } },
        include: { project: { select: { name: true, contact: { select: { name: true } } } } },
      }),
      prisma.contact.findMany({
        where: { userId, status: { in: [...LEAD_STATUSES] }, createdAt: { gte: yesterday } },
      }),
      prisma.contact.findMany({
        where: {
          userId,
          status: 'CLIENT',
          lastContactedAt: { lt: sevenDaysAgo },
        },
        select: { name: true, lastContactedAt: true },
      }),
      prisma.contact.findMany({
        where: {
          userId,
          status: { in: [...LEAD_STATUSES] },
          OR: [
            { lastContactedAt: { lt: threeDaysAgo } },
            { lastContactedAt: null, createdAt: { lt: threeDaysAgo } },
          ],
        },
        select: { name: true, status: true, lastContactedAt: true, createdAt: true },
      }),
      prisma.project.findMany({
        where: { userId, status: 'IN_PROGRESS' },
        include: {
          contact: { select: { name: true } },
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
    ])

    const formatTask = (t: { title: string; priority: string; dueDate: Date | null; project: { name: string; contact: { name: string } | null } | null }) => {
      const client = t.project?.contact?.name ?? ''
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

לידים ללא קשר 3+ ימים (${staleLeads.length}):
${staleLeads.map(l => `- ${l.name} (${l.status})`).join('\n')}

פרויקטים בתהליך (${activeProjects.length}):
${activeProjects.map(p => `- ${p.name} (${p.contact.name}) | ${p._count.tasks} משימות`).join('\n')}

משימות ממתינות לפי קטגוריה:
${taskCountsByCategory.map(c => {
      const labels: Record<string, string> = { CLIENT_WORK: 'עבודת לקוח', MARKETING: 'שיווק', LEAD_FOLLOWUP: 'מעקב לידים', ADMIN: 'מנהלה' }
      return `- ${labels[c.category] ?? c.category}: ${c._count}`
    }).join('\n')}

משימות שיווק ב-14 ימים אחרונים: ${recentMarketingTasks}
`

    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: `You write a daily morning brief for a Hebrew-speaking freelancer.
You receive raw CRM data and write a natural, concise WhatsApp message.

Structure:
1. Start with "בוקר טוב!" and the Hebrew date
2. Top 3 priorities for today (you decide based on urgency, deadlines, staleness — be specific and actionable)
3. Quick summary: overdue count, today count, new leads
4. Proactive suggestions section (only if relevant):
   - Follow-up reminders for stale contacts/leads
   - Marketing nudge if no marketing tasks in 14 days
   - Any other observations
5. End with a motivating one-liner

Use WhatsApp formatting: *bold* (single asterisk), _italic_ (underscore).
Keep it scannable — max 15 lines.
NEVER use Markdown syntax. NEVER escape underscores with backslash. Write plain Hebrew text.
Use Hebrew labels for categories (עבודת לקוח, שיווק, מעקב לידים, מנהלה) — never show English enum values.`,
      prompt: briefData,
    })

    return result.text
  }
}
