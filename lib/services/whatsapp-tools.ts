import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { ContactsService } from './contacts.service'
import { ProjectsService } from './projects.service'
import { TasksService } from './tasks.service'
import { DashboardService } from './dashboard.service'
import { fuzzyMatchContact, fuzzyMatchProject, fuzzyMatchTask } from './fuzzy-match'

export function createCrmTools(userId: string) {
  return {
    // --- CONTACTS ---

    createContact: tool({
      description: 'Create a new contact (lead or client). Use for adding new people to the CRM.',
      inputSchema: z.object({
        name: z.string().describe('Contact name'),
        phone: z.string().describe('Phone number in Israeli format (05XXXXXXXX)'),
        source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).optional().describe('How the contact was acquired'),
        status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CLIENT']).optional().describe('Contact status, default NEW for leads'),
      }),
      execute: async ({ name, phone, source, status }) => {
        const contact = await ContactsService.create(userId, {
          name,
          phone,
          email: undefined,
          source: source ?? 'OTHER',
        })
        // If status specified and not NEW, update it
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
        status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CLIENT', 'INACTIVE']).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        isVip: z.boolean().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
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
            projectCount: c.projects?.length ?? 0,
          })),
        }
      },
    }),

    getContact: tool({
      description: 'Get full details of a specific contact including their projects.',
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
            isVip: contact.isVip,
            company: contact.company,
            projects: contact.projects.map((p) => ({
              name: p.name,
              status: p.status,
              type: p.type,
              price: p.price ? Number(p.price) : null,
            })),
          },
        }
      },
    }),

    // --- PROJECTS ---

    createProject: tool({
      description: 'Create a new project for a client. The contact must have CLIENT status.',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
        type: z.enum(['LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION']),
        contactName: z.string().describe('Client name (fuzzy match)'),
        price: z.number().optional().describe('Project price in ILS'),
        retention: z.number().optional().describe('Monthly/yearly maintenance fee'),
        retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
      }),
      execute: async ({ contactName, ...data }) => {
        const result = await fuzzyMatchContact(userId, contactName)
        if (result.ambiguous) {
          return { success: false, ambiguous: true, options: result.matches.map((c, i) => `${i + 1}. ${c.name}`) }
        }
        if (!result.match) {
          return { success: false, error: `לא נמצא לקוח בשם "${contactName}"` }
        }
        const project = await ProjectsService.create(userId, {
          ...data,
          contactId: result.match.id,
        })
        return { success: true, project: { id: project.id, name: project.name, type: project.type } }
      },
    }),

    updateProject: tool({
      description: 'Update a project. Can change status, price, deadline, etc.',
      inputSchema: z.object({
        nameQuery: z.string().describe('Project name to search for (fuzzy match)'),
        status: z.enum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
        price: z.number().optional(),
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

    listProjects: tool({
      description: 'List projects. Can filter by status or client name.',
      inputSchema: z.object({
        status: z.enum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
        contactName: z.string().optional().describe('Filter by client name (fuzzy match)'),
      }),
      execute: async ({ status, contactName }) => {
        let contactId: string | undefined
        if (contactName) {
          const result = await fuzzyMatchContact(userId, contactName)
          if (result.match) contactId = result.match.id
        }
        const projects = await ProjectsService.getAll(userId, { status, contactId })
        return {
          count: projects.length,
          projects: projects.map((p) => ({
            name: p.name,
            status: p.status,
            type: p.type,
            contact: p.contact?.name ?? 'לא ידוע',
            price: p.price ? Number(p.price) : null,
            taskCount: p._count?.tasks ?? 0,
          })),
        }
      },
    }),

    // --- TASKS ---

    createTask: tool({
      description: 'Create a new task. Can be standalone or linked to a project.',
      inputSchema: z.object({
        title: z.string().describe('Task title/description'),
        category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional().describe('Task category, default CLIENT_WORK'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Priority level, default MEDIUM'),
        projectName: z.string().optional().describe('Project name to link to (fuzzy match)'),
        dueDate: z.string().optional().describe('Due date in ISO format'),
      }),
      execute: async ({ projectName, ...data }) => {
        let projectId: string | undefined
        if (projectName) {
          const result = await fuzzyMatchProject(userId, projectName)
          if (result.match) projectId = result.match.id
        }
        const task = await TasksService.create(userId, {
          ...data,
          projectId,
        })
        return { success: true, task: { id: task.id, title: task.title, category: task.category, priority: task.priority } }
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
      description: 'Get dashboard summary with revenue, active projects count, pending tasks, and leads in pipeline.',
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

    searchEverything: tool({
      description: 'Search across all contacts, projects, and tasks by free text.',
      inputSchema: z.object({
        query: z.string().describe('Search text'),
      }),
      execute: async ({ query }) => {
        const [contacts, projects, tasks] = await Promise.all([
          ContactsService.getAll(userId, { search: query }),
          ProjectsService.getAll(userId, { search: query }),
          TasksService.getAll(userId, { search: query }),
        ])

        return {
          contacts: contacts.slice(0, 5).map((c) => ({ name: c.name, status: c.status })),
          projects: projects.slice(0, 5).map((p) => ({ name: p.name, status: p.status })),
          tasks: tasks.slice(0, 5).map((t) => ({ title: t.title, status: t.status })),
        }
      },
    }),
  }
}
