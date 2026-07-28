import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { ContactsService } from './contacts.service'
import { ProjectsService } from './projects.service'
import { TasksService } from './tasks.service'
import { DashboardService } from './dashboard.service'
import { RequestsService } from './requests.service'
import {
  fuzzyMatchContact,
  fuzzyMatchClient,
  fuzzyMatchProject,
  fuzzyMatchTask,
  fuzzyMatchRequest,
} from './fuzzy-match'
import { contactStatus, contactSource } from '@/lib/validations/enums'
import { projectTotal, projectPaid, projectOutstanding } from '@/lib/utils/project-money'

export function createCrmTools(userId: string) {
  return {
    // --- CONTACTS ---

    createContact: tool({
      description: 'Create a new contact (lead or client). Use for adding new people to the CRM.',
      inputSchema: z.object({
        name: z.string().describe('Contact name'),
        phone: z.string().describe('Phone number in Israeli format (05XXXXXXXX)'),
        source: contactSource.optional().describe('How the contact was acquired'),
        status: contactStatus.optional().describe('Pipeline stage, default NEW for leads'),
      }),
      execute: async ({ name, phone, source, status }) => {
        const contact = await ContactsService.create(userId, {
          name,
          phone,
          email: undefined,
          source: source ?? 'OTHER',
        })
        if (status && status !== 'NEW') {
          const updated = await ContactsService.update(userId, contact.id, { email: undefined, status })
          return { success: true, contact: { id: updated.id, name: updated.name, phone: updated.phone, status: updated.status } }
        }
        return { success: true, contact: { id: contact.id, name: contact.name, phone: contact.phone, status: contact.status } }
      },
    }),

    updateContact: tool({
      description: 'Update an existing contact. Can change status, phone, email, VIP status, etc. Also used to convert a lead to client (set status to CLIENT).',
      inputSchema: z.object({
        nameQuery: z.string().describe('Contact name to search for (fuzzy match)'),
        status: contactStatus.optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isVip: z.boolean().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
        nextActionAt: z
          .string()
          .datetime()
          .nullable()
          .optional()
          .describe('When the next action on this lead is due, ISO 8601. null clears it.'),
        nextActionNote: z
          .string()
          .nullable()
          .optional()
          .describe('What the next action is, e.g. "לשלוח הצעת מחיר"'),
      }),
      execute: async ({ nameQuery, ...updates }) => {
        const result = await fuzzyMatchContact(userId, nameQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((c, i) => `${i + 1}. ${c.name} (${c.phone})`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצא איש קשר בשם "${nameQuery}"` }
        }
        const contact = await ContactsService.update(userId, result.match.id, { email: updates.email, ...updates })
        return { success: true, contact: { id: contact.id, name: contact.name, status: contact.status } }
      },
    }),

    listContacts: tool({
      description: 'List contacts. Can filter by phase (lead/client) or search by name.',
      inputSchema: z.object({
        phase: z.enum(['lead', 'client']).optional().describe('Filter by lead phase or client phase'),
        search: z.string().optional().describe('Search by name, phone, email'),
      }),
      execute: async ({ phase, search }) => {
        const contacts = await ContactsService.getAll(userId, { phase, search })
        return {
          count: contacts.length,
          contacts: contacts.map((c) => ({
            name: c.name,
            phone: c.phone,
            status: c.status,
            business: c.client?.name ?? null,
            projectCount: c._count?.projects ?? 0,
          })),
        }
      },
    }),

    getContact: tool({
      description: 'Get full details of a specific contact including their projects and tasks. ALWAYS call this first when a client name is mentioned.',
      inputSchema: z.object({
        nameQuery: z.string().describe('Contact name to search for (fuzzy match)'),
      }),
      execute: async ({ nameQuery }) => {
        const result = await fuzzyMatchContact(userId, nameQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצא איש קשר בשם "${nameQuery}"` }
        }
        const contact = await ContactsService.getById(userId, result.match.id)
        return {
          success: true,
          contact: {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            status: contact.status,
            isVip: contact.client?.isVip ?? contact.isVip,
            business: contact.client?.name ?? contact.company,
            role: contact.role,
            projects: (contact.client?.projects ?? []).map((p) => ({
              name: p.name,
              status: p.status,
              type: p.type,
              total: projectTotal(p.advanceAmount, p.phases),
              paid: projectPaid(p.advanceAmount, p.advancePaidAt, p.phases),
              tasks: p.tasks?.map((t: { title: string; status: string; priority: string; category: string }) => ({
                title: t.title,
                status: t.status,
                priority: t.priority,
                category: t.category,
              })) ?? [],
            })),
          },
        }
      },
    }),

    // --- PROJECTS ---

    createProject: tool({
      description: 'Create a new project for a client (business). Provide the business or primary person name.',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
        type: z.enum(['LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION']),
        clientName: z.string().describe('Client/business name (fuzzy match). A contact name also works if they belong to a business.'),
        advanceAmount: z.number().optional().describe('Advance (מקדמה) paid up front, in ILS. The rest of the money lives on the phases.'),
        retention: z.number().optional().describe('Monthly/yearly maintenance fee'),
        retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
      }),
      execute: async ({ clientName, ...data }) => {
        const byClient = await fuzzyMatchClient(userId, clientName)
        if (byClient.match) {
          const project = await ProjectsService.create(userId, { ...data, clientId: byClient.match.id })
          return { success: true, project: { id: project.id, name: project.name, type: project.type } }
        }
        if (byClient.ambiguous) {
          return { success: false, ambiguous: true, options: byClient.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        }

        // Fall back: maybe they named a person rather than the business
        const byContact = await fuzzyMatchContact(userId, clientName)
        if (byContact.match?.clientId) {
          const project = await ProjectsService.create(userId, {
            ...data,
            clientId: byContact.match.clientId,
            primaryContactId: byContact.match.id,
          })
          return { success: true, project: { id: project.id, name: project.name, type: project.type } }
        }
        if (byContact.match) {
          return { success: false, error: 'לאיש הקשר אין עסק משויך — המר ללקוח קודם' }
        }
        return { success: false, error: `לא נמצא לקוח בשם "${clientName}"` }
      },
    }),

    updateProject: tool({
      description: 'Update a project. Can change status, advance, deadline, etc. Phase prices are edited on the project page, not here.',
      inputSchema: z.object({
        nameQuery: z.string().describe('Project name to search for (fuzzy match)'),
        status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
        advanceAmount: z.number().optional().describe('Advance (מקדמה) in ILS'),
        advancePaid: z.boolean().optional().describe('Mark the advance paid or unpaid'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        deadline: z.string().optional().describe('Deadline date in ISO format'),
      }),
      execute: async ({ nameQuery, ...updates }) => {
        const result = await fuzzyMatchProject(userId, nameQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((p, i) => `${i + 1}. ${p.name}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצא פרויקט בשם "${nameQuery}"` }
        }
        const project = await ProjectsService.update(userId, result.match.id, updates)
        return { success: true, project: { id: project.id, name: project.name, status: project.status } }
      },
    }),

    getProject: tool({
      description: 'Get full project details including all tasks. Use when asked about project status or what work is pending.',
      inputSchema: z.object({
        nameQuery: z.string().describe('Project name (fuzzy match)'),
      }),
      execute: async ({ nameQuery }) => {
        const result = await fuzzyMatchProject(userId, nameQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((p, i) => `${i + 1}. ${p.name}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצא פרויקט בשם "${nameQuery}"` }
        }
        const project = await ProjectsService.getById(userId, result.match.id)
        return {
          success: true,
          project: {
            name: project.name,
            type: project.type,
            status: project.status,
            advance: {
              amount: project.advanceAmount ? Number(project.advanceAmount) : null,
              paid: project.advancePaidAt != null,
            },
            phases: project.phases.map((ph) => ({
              name: ph.name,
              status: ph.status,
              price: Number(ph.price),
              paid: ph.paidAt != null,
            })),
            total: projectTotal(project.advanceAmount, project.phases),
            paid: projectPaid(project.advanceAmount, project.advancePaidAt, project.phases),
            outstanding: projectOutstanding(project.phases),
            deadline: project.deadline?.toISOString() ?? null,
            client: project.client?.name,
            contact: project.primaryContact?.name ?? null,
            tasks: project.tasks.map((t) => ({
              title: t.title,
              status: t.status,
              priority: t.priority,
              category: t.category,
            })),
          },
        }
      },
    }),

    listProjects: tool({
      description: 'List projects. Can filter by status or client/business name.',
      inputSchema: z.object({
        status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
        clientName: z.string().optional().describe('Filter by client/business name (fuzzy match)'),
      }),
      execute: async ({ status, clientName }) => {
        let clientId: string | undefined
        if (clientName) {
          const byClient = await fuzzyMatchClient(userId, clientName)
          if (byClient.match) {
            clientId = byClient.match.id
          } else {
            const byContact = await fuzzyMatchContact(userId, clientName)
            if (byContact.match?.clientId) clientId = byContact.match.clientId
          }
        }
        const projects = await ProjectsService.getAll(userId, { status, clientId })
        return {
          count: projects.length,
          projects: projects.map((p) => ({
            name: p.name,
            status: p.status,
            type: p.type,
            client: p.client?.name ?? 'לא ידוע',
            total: projectTotal(p.advanceAmount, p.phases),
            outstanding: projectOutstanding(p.phases),
            taskCount: p._count?.tasks ?? 0,
          })),
        }
      },
    }),

    // --- TASKS ---

    createTask: tool({
      description: 'Create a new task. Can be standalone or linked to a project.',
      inputSchema: z.object({
        title: z.string().describe('Task title — short and actionable'),
        description: z.string().optional().describe('Task description with context'),
        category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional().describe('Task category, default CLIENT_WORK'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Priority level, default MEDIUM'),
        projectName: z.string().optional().describe('Project name to link to (fuzzy match)'),
        dueDate: z.string().optional().describe('Due date in ISO format'),
      }),
      execute: async ({ projectName, ...data }) => {
        let projectId: string | undefined
        let linkedProjectName: string | null = null

        if (projectName) {
          const result = await fuzzyMatchProject(userId, projectName)
          if (result.ambiguous) {
            return { success: false, error: 'כמה פרויקטים תואמים', options: result.matches.map(p => p.name) }
          }
          if (!result.match) {
            return { success: false, error: `לא נמצא פרויקט "${projectName}" — צור קודם או בדוק את השם` }
          }
          projectId = result.match.id
          linkedProjectName = result.match.name
        }

        const task = await TasksService.create(userId, { ...data, projectId })
        return {
          success: true,
          task: { id: task.id, title: task.title, category: task.category, priority: task.priority },
          linkedProject: linkedProjectName,
        }
      },
    }),

    updateTask: tool({
      description: 'Update a task. Can change status, priority, category, etc.',
      inputSchema: z.object({
        titleQuery: z.string().describe('Task title to search for (fuzzy match)'),
        status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional(),
      }),
      execute: async ({ titleQuery, ...updates }) => {
        const result = await fuzzyMatchTask(userId, titleQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((t, i) => `${i + 1}. ${t.title}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצאה משימה בשם "${titleQuery}"` }
        }
        const task = await TasksService.update(userId, result.match.id, updates)
        return { success: true, task: { id: task.id, title: task.title, status: task.status } }
      },
    }),

    listTasks: tool({
      description: 'List tasks. Can filter by category, status, or project.',
      inputSchema: z.object({
        category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        projectName: z.string().optional().describe('Filter by project name (fuzzy match)'),
      }),
      execute: async ({ category, status, projectName }) => {
        let projectId: string | undefined
        if (projectName) {
          const result = await fuzzyMatchProject(userId, projectName)
          if (result.match) projectId = result.match.id
        }
        const tasks = await TasksService.getAll(userId, { category, status, projectId })
        return {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            category: t.category,
            project: t.project?.name ?? 'ללא פרויקט',
          })),
        }
      },
    }),

    // --- GENERAL ---

    getDashboard: tool({
      description: 'Get dashboard summary with revenue, active projects, pending tasks, and leads. Includes top pending tasks and recent leads.',
      inputSchema: z.object({}),
      execute: async () => {
        const data = await DashboardService.getData(userId)
        return {
          revenue: `${data.revenue.toLocaleString()} ₪`,
          leads: data.contacts.leads,
          clients: data.contacts.clients,
          activeProjects: data.projects.active,
          completedProjects: data.projects.completed,
          pendingTasks: data.tasks.pending,
          overdueTasks: data.tasks.overdue,
          pendingRequests: data.requests.pendingReview,
          openRequests: data.requests.open,
          topPendingTasks: data.pendingTasks?.map((t: { title: string; priority: string; category: string; project: { name: string } | null }) => ({
            title: t.title,
            priority: t.priority,
            category: t.category,
            project: t.project?.name ?? 'ללא פרויקט',
          })) ?? [],
        }
      },
    }),

    getClientMessages: tool({
      description: 'Get recent WhatsApp messages with a specific client. Useful for context on what the client asked for.',
      inputSchema: z.object({
        contactName: z.string().describe('Client name (fuzzy match)'),
        days: z.number().optional().describe('How many days back to look, default 7'),
      }),
      execute: async ({ contactName, days }) => {
        const result = await fuzzyMatchContact(userId, contactName)
        if (!result.match) {
          return { success: false, error: `לא נמצא איש קשר בשם "${contactName}"` }
        }
        const since = new Date()
        since.setDate(since.getDate() - (days ?? 7))

        const messages = await prisma.whatsAppMessage.findMany({
          where: {
            contactId: result.match.id,
            timestamp: { gte: since },
          },
          orderBy: { timestamp: 'asc' },
          take: 50,
        })

        return {
          contact: result.match.name,
          messageCount: messages.length,
          messages: messages.map((m) => ({
            direction: m.direction === 'INCOMING' ? 'לקוח' : 'אתה',
            content: m.content,
            time: m.timestamp.toISOString(),
          })),
        }
      },
    }),

    // --- REQUESTS (client tickets) ---

    createRequest: tool({
      description: 'Create a client request/ticket (new request, bug, or improvement) for a specific business.',
      inputSchema: z.object({
        clientName: z.string().describe('Client/business name (fuzzy match). A contact name also works.'),
        title: z.string().describe('Short actionable title in Hebrew'),
        description: z.string().optional(),
        type: z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        projectName: z.string().optional().describe('Optional project to link (fuzzy match)'),
      }),
      execute: async ({ clientName, projectName, ...data }) => {
        let clientId: string | undefined
        const byClient = await fuzzyMatchClient(userId, clientName)
        if (byClient.match) {
          clientId = byClient.match.id
        } else if (byClient.ambiguous) {
          return { success: false, ambiguous: true, options: byClient.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        } else {
          const byContact = await fuzzyMatchContact(userId, clientName)
          if (byContact.match?.clientId) clientId = byContact.match.clientId
        }
        if (!clientId) {
          return { success: false, error: `לא נמצא לקוח בשם "${clientName}"` }
        }

        let projectId: string | undefined
        if (projectName) {
          const proj = await fuzzyMatchProject(userId, projectName)
          if (proj.match) projectId = proj.match.id
        }

        const request = await RequestsService.create(userId, { ...data, clientId, projectId })
        return { success: true, request: { id: request.id, title: request.title, type: request.type, status: request.status } }
      },
    }),

    listRequests: tool({
      description: 'List client requests. Filter by client, status, or type.',
      inputSchema: z.object({
        clientName: z.string().optional().describe('Filter by client/business name (fuzzy match)'),
        status: z.enum(['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
        type: z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER']).optional(),
      }),
      execute: async ({ clientName, status, type }) => {
        let clientId: string | undefined
        if (clientName) {
          const byClient = await fuzzyMatchClient(userId, clientName)
          if (byClient.match) clientId = byClient.match.id
        }
        const requests = await RequestsService.getAll(userId, { clientId, status, type })
        return {
          count: requests.length,
          requests: requests.map((r) => ({
            title: r.title,
            type: r.type,
            status: r.status,
            priority: r.priority,
            client: r.client?.name ?? null,
            project: r.project?.name ?? null,
          })),
        }
      },
    }),

    listPendingRequests: tool({
      description: 'List AI-drafted requests waiting for your review/approval. Use when asked what needs review.',
      inputSchema: z.object({}),
      execute: async () => {
        const requests = await RequestsService.getAll(userId, { pendingReview: true })
        return {
          count: requests.length,
          requests: requests.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            client: r.client?.name ?? null,
            aiNote: r.aiNote,
          })),
        }
      },
    }),

    updateRequest: tool({
      description: 'Update a client request — change status, type, or priority.',
      inputSchema: z.object({
        titleQuery: z.string().describe('Request title to search for (fuzzy match)'),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
        type: z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      }),
      execute: async ({ titleQuery, ...updates }) => {
        const result = await fuzzyMatchRequest(userId, titleQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((r, i) => `${i + 1}. ${r.title}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצאה בקשה בשם "${titleQuery}"` }
        }
        const request = await RequestsService.update(userId, result.match.id, updates)
        return { success: true, request: { id: request.id, title: request.title, status: request.status } }
      },
    }),

    reviewRequest: tool({
      description: 'Approve or dismiss an AI-drafted request (one that is waiting for review), by title.',
      inputSchema: z.object({
        titleQuery: z.string().describe('Request title to search for (fuzzy match)'),
        decision: z.enum(['approve', 'dismiss']),
      }),
      execute: async ({ titleQuery, decision }) => {
        const result = await fuzzyMatchRequest(userId, titleQuery)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((r, i) => `${i + 1}. ${r.title}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצאה בקשה בשם "${titleQuery}"` }
        }
        const request =
          decision === 'approve'
            ? await RequestsService.approve(userId, result.match.id)
            : await RequestsService.dismiss(userId, result.match.id)
        return { success: true, request: { id: request.id, title: request.title, status: request.status } }
      },
    }),

    getClientRequests: tool({
      description: 'Get all requests/tickets for a specific client across all their people. Use to answer "what did <client> ask for / what is broken for <client>".',
      inputSchema: z.object({
        clientName: z.string().describe('Client/business name (fuzzy match)'),
        status: z.enum(['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
      }),
      execute: async ({ clientName, status }) => {
        const byClient = await fuzzyMatchClient(userId, clientName)
        if (byClient.ambiguous) {
          return { success: false, ambiguous: true, options: byClient.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        }
        if (!byClient.match) {
          return { success: false, error: `לא נמצא לקוח בשם "${clientName}"` }
        }
        const requests = await RequestsService.getAll(userId, { clientId: byClient.match.id, status })
        return {
          client: byClient.match.name,
          count: requests.length,
          requests: requests.map((r) => ({
            title: r.title,
            type: r.type,
            status: r.status,
            priority: r.priority,
          })),
        }
      },
    }),

    getClientConversation: tool({
      description: 'Get recent WhatsApp messages across ALL people of a client/business. Use to answer "what did <client> say/ask for" — covers the owner and all workers, even on different numbers.',
      inputSchema: z.object({
        clientName: z.string().describe('Client/business name (fuzzy match)'),
        days: z.number().optional().describe('How many days back to look, default 14'),
      }),
      execute: async ({ clientName, days }) => {
        const res = await fuzzyMatchClient(userId, clientName)
        if (res.ambiguous) {
          return { success: false, ambiguous: true, options: res.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        }
        if (!res.match) {
          return { success: false, error: `לא נמצא עסק בשם "${clientName}"` }
        }
        const since = new Date()
        since.setDate(since.getDate() - (days ?? 14))

        const messages = await prisma.whatsAppMessage.findMany({
          where: { clientId: res.match.id, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
          take: 80,
          include: { contact: { select: { name: true } } },
        })

        return {
          client: res.match.name,
          messageCount: messages.length,
          messages: messages.map((m) => ({
            who: m.direction === 'INCOMING' ? (m.contact?.name ?? 'לקוח') : 'אתה',
            content: m.content,
            time: m.timestamp.toISOString(),
          })),
        }
      },
    }),

    searchEverything: tool({
      description: 'Search across all contacts, projects, and tasks by free text.',
      inputSchema: z.object({
        query: z.string().describe('Search text'),
      }),
      execute: async ({ query }) => {
        const [contactsResult, projectsResult, tasksResult] = await Promise.allSettled([
          ContactsService.getAll(userId, { search: query }),
          ProjectsService.getAll(userId, { search: query }),
          TasksService.getAll(userId, { search: query }),
        ])

        const contacts = contactsResult.status === 'fulfilled' ? contactsResult.value : []
        const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : []
        const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : []

        return {
          contacts: contacts.slice(0, 5).map((c) => ({ name: c.name, status: c.status })),
          projects: projects.slice(0, 5).map((p) => ({ name: p.name, status: p.status })),
          tasks: tasks.slice(0, 5).map((t) => ({ title: t.title, status: t.status })),
        }
      },
    }),
  }
}
