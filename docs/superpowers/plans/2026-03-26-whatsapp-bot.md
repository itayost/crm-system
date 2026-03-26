# WhatsApp CRM Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered WhatsApp bot that acts as a full CRM assistant — create/edit contacts, projects, tasks, query data — with passive conversation indexing from the personal WhatsApp number.

**Architecture:** WAHA (self-hosted WhatsApp gateway) sends webhooks to Next.js API routes. The bot webhook invokes a Vercel AI SDK Agent with 13 CRM tools. The index webhook passively stores messages. Both run as separate WAHA sessions in one Docker container.

**Tech Stack:** Vercel AI SDK (Agent class), AI Gateway, WAHA REST API, Prisma, Next.js API routes

**Spec:** `docs/superpowers/specs/2026-03-26-whatsapp-bot-design.md`

---

## File Map

### Files to CREATE

```
lib/services/fuzzy-match.ts                 — Shared fuzzy name matching utility
lib/services/waha.service.ts                — WAHA REST API client (send messages)
lib/services/whatsapp-tools.ts              — 13 AI SDK tool definitions wrapping CRM services
lib/services/whatsapp-agent.service.ts      — Agent definition (system prompt, tools, conversation management)
app/api/whatsapp/index/route.ts             — Personal number webhook (passive indexing)
app/api/whatsapp/webhook/route.ts           — Bot number webhook (agent interaction)
```

### Files to MODIFY

```
prisma/schema.prisma                        — Add WhatsAppMessage, BotConversation, MessageDirection
```

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and enum to schema**

Add to the end of `prisma/schema.prisma`, before the closing enums:

```prisma
model WhatsAppMessage {
  id          String           @id @default(cuid())
  phoneNumber String
  direction   MessageDirection
  content     String           @db.Text
  contactId   String?
  contact     Contact?         @relation(fields: [contactId], references: [id])
  sessionName String
  timestamp   DateTime
  createdAt   DateTime         @default(now())

  @@index([phoneNumber])
  @@index([contactId])
  @@index([timestamp])
}

model BotConversation {
  id           String   @id @default(cuid())
  messages     Json
  lastActiveAt DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum MessageDirection {
  INCOMING
  OUTGOING
}
```

Also add the relation to the Contact model — add this line inside the Contact model block after `projects Project[]`:

```prisma
  whatsappMessages WhatsAppMessage[]
```

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success.

- [ ] **Step 3: Apply schema to database via raw SQL**

Run:
```bash
npx prisma db execute --stdin --schema prisma/schema.prisma <<'SQL'
DO $$ BEGIN
  CREATE TYPE "MessageDirection" AS ENUM ('INCOMING', 'OUTGOING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "direction" "MessageDirection" NOT NULL,
  "content" TEXT NOT NULL,
  "contactId" TEXT,
  "sessionName" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_phoneNumber_idx" ON "WhatsAppMessage"("phoneNumber");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_contactId_idx" ON "WhatsAppMessage"("contactId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_timestamp_idx" ON "WhatsAppMessage"("timestamp");

CREATE TABLE IF NOT EXISTS "BotConversation" (
  "id" TEXT NOT NULL,
  "messages" JSONB NOT NULL,
  "lastActiveAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);
SQL
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add WhatsAppMessage and BotConversation models to schema"
```

---

## Task 2: Install Dependencies

- [ ] **Step 1: Install AI SDK packages**

Run: `npm install ai @ai-sdk/gateway`

Note: `@ai-sdk/react` is NOT needed — the bot is server-side only, no React hooks involved.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install Vercel AI SDK and AI Gateway for WhatsApp bot"
```

---

## Task 3: Fuzzy Name Matching Utility

**Files:**
- Create: `lib/services/fuzzy-match.ts`

- [ ] **Step 1: Create fuzzy-match.ts**

This utility is used by all agent tools to match user-provided names (Hebrew) against database records.

Create `lib/services/fuzzy-match.ts`:

```typescript
import { prisma } from '@/lib/db/prisma'

interface MatchResult<T> {
  match: T | null
  matches: T[]
  ambiguous: boolean
}

export async function fuzzyMatchContact(
  userId: string,
  nameQuery: string
): Promise<MatchResult<{ id: string; name: string; status: string; phone: string }>> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, name: true, status: true, phone: true },
  })

  return fuzzyMatch(contacts, nameQuery, (c) => c.name)
}

export async function fuzzyMatchProject(
  userId: string,
  nameQuery: string
): Promise<MatchResult<{ id: string; name: string; status: string; contactId: string }>> {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true, status: true, contactId: true },
  })

  return fuzzyMatch(projects, nameQuery, (p) => p.name)
}

export async function fuzzyMatchTask(
  userId: string,
  titleQuery: string
): Promise<MatchResult<{ id: string; title: string; status: string; projectId: string | null }>> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
    select: { id: true, title: true, status: true, projectId: true },
  })

  return fuzzyMatch(tasks, titleQuery, (t) => t.title)
}

function fuzzyMatch<T>(
  items: T[],
  query: string,
  getName: (item: T) => string
): MatchResult<T> {
  const normalized = query.trim().toLowerCase()

  // 1. Exact match
  const exact = items.filter((item) => getName(item).toLowerCase() === normalized)
  if (exact.length === 1) return { match: exact[0], matches: exact, ambiguous: false }

  // 2. Starts-with match
  const startsWith = items.filter((item) =>
    getName(item).toLowerCase().startsWith(normalized)
  )
  if (startsWith.length === 1) return { match: startsWith[0], matches: startsWith, ambiguous: false }

  // 3. Contains match
  const contains = items.filter((item) =>
    getName(item).toLowerCase().includes(normalized)
  )
  if (contains.length === 1) return { match: contains[0], matches: contains, ambiguous: false }

  // Multiple or no matches
  const allMatches = contains.length > 0 ? contains : startsWith.length > 0 ? startsWith : []
  return {
    match: null,
    matches: allMatches,
    ambiguous: allMatches.length > 1,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/fuzzy-match.ts
git commit -m "feat: add fuzzy name matching utility for WhatsApp agent tools"
```

---

## Task 4: WAHA Service

**Files:**
- Create: `lib/services/waha.service.ts`

- [ ] **Step 1: Create waha.service.ts**

REST client for sending messages back via WAHA.

Create `lib/services/waha.service.ts`:

```typescript
const WAHA_API_URL = process.env.WAHA_API_URL ?? ''
const WAHA_API_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_BOT_SESSION = process.env.WAHA_BOT_SESSION ?? 'bot'

interface SendMessageParams {
  chatId: string
  text: string
  session?: string
}

export class WahaService {
  private static async request(path: string, options: RequestInit = {}) {
    const url = `${WAHA_API_URL}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`WAHA API error ${response.status}: ${body}`)
    }

    return response.json()
  }

  static async sendMessage({ chatId, text, session }: SendMessageParams) {
    return this.request(`/api/sendText`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        text,
        session: session ?? WAHA_BOT_SESSION,
      }),
    })
  }

  static formatChatId(phoneNumber: string): string {
    // WAHA expects format: 972XXXXXXXXX@c.us
    const cleaned = phoneNumber.replace(/[-\s+]/g, '')
    // Convert Israeli format 05X... to 9725X...
    if (cleaned.startsWith('0')) {
      return `972${cleaned.slice(1)}@c.us`
    }
    // Already international format
    if (cleaned.startsWith('972')) {
      return `${cleaned}@c.us`
    }
    return `${cleaned}@c.us`
  }

  static extractPhoneNumber(chatId: string): string {
    // Convert 972XXXXXXXXX@c.us back to 05XXXXXXXX
    const number = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '')
    if (number.startsWith('972')) {
      return `0${number.slice(3)}`
    }
    return number
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/waha.service.ts
git commit -m "feat: add WAHA REST API client for WhatsApp messaging"
```

---

## Task 5: WhatsApp Agent Tools

**Files:**
- Create: `lib/services/whatsapp-tools.ts`

- [ ] **Step 1: Create whatsapp-tools.ts with all 13 tool definitions**

This is the largest file. Each tool wraps an existing CRM service method and handles fuzzy matching.

Create `lib/services/whatsapp-tools.ts`:

```typescript
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
      parameters: z.object({
        name: z.string().describe('Contact name'),
        phone: z.string().describe('Phone number in Israeli format (05XXXXXXXX)'),
        source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).optional().describe('How the contact was acquired'),
        status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CLIENT']).optional().describe('Contact status, default NEW for leads'),
      }),
      execute: async ({ name, phone, source, status }) => {
        const contact = await ContactsService.create(userId, {
          name,
          phone,
          source: source ?? 'OTHER',
          status,
        })
        return { success: true, contact: { id: contact.id, name: contact.name, phone: contact.phone, status: contact.status } }
      },
    }),

    updateContact: tool({
      description: 'Update an existing contact. Can change status, phone, email, VIP status, etc. Also used to convert a lead to client (set status to CLIENT).',
      parameters: z.object({
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
        const contact = await ContactsService.update(userId, result.match.id, updates)
        return { success: true, contact: { id: contact.id, name: contact.name, status: contact.status } }
      },
    }),

    listContacts: tool({
      description: 'List contacts. Can filter by phase (lead/client) or search by name.',
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({
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
      parameters: z.object({}),
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
      parameters: z.object({
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
      parameters: z.object({
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/whatsapp-tools.ts
git commit -m "feat: add 13 CRM tools for WhatsApp AI agent"
```

---

## Task 6: WhatsApp Agent Service

**Files:**
- Create: `lib/services/whatsapp-agent.service.ts`

- [ ] **Step 1: Create whatsapp-agent.service.ts**

The agent orchestrator — manages conversation history, invokes the AI agent, and returns the response.

Create `lib/services/whatsapp-agent.service.ts`:

```typescript
import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma, Prisma } from '@/lib/db/prisma'
import { createCrmTools } from './whatsapp-tools'

const SYSTEM_PROMPT = `You are a CRM assistant for a Hebrew-speaking freelancer.
You manage contacts (leads and clients), projects, and tasks.

Rules:
- Always respond in Hebrew
- Be concise — short WhatsApp messages, not essays
- When creating/updating, confirm in one line with key details
- When listing, use numbered lists
- When a name matches multiple records, ask which one with numbers
- When required info is missing, ask naturally (one question at a time)
- Never make up data — only use what the tools return
- For task creation: infer category from context (client name mentioned = CLIENT_WORK, marketing terms = MARKETING, lead terms = LEAD_FOLLOWUP)
- For forwarded client messages: extract the action item as task title
- You can check client message history for context using getClientMessages

Categories:
- CLIENT_WORK (עבודת לקוח) — tasks related to client projects
- MARKETING (שיווק) — portfolio, social media, advertising
- LEAD_FOLLOWUP (מעקב לידים) — following up with potential clients
- ADMIN (מנהלה) — invoices, accounting, business admin

Contact statuses:
- NEW, CONTACTED, QUOTED, NEGOTIATING — lead phase
- CLIENT — active client
- INACTIVE — inactive

Project types: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
Project statuses: DRAFT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
Task statuses: TODO, IN_PROGRESS, COMPLETED, CANCELLED
Priorities: LOW, MEDIUM, HIGH, URGENT`

const MAX_CONVERSATION_MESSAGES = 20
const CONVERSATION_ID = 'singleton'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export class WhatsAppAgentService {
  static async processMessage(userId: string, userMessage: string): Promise<string> {
    // 1. Load conversation history
    const history = await this.getConversationHistory()

    // 2. Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user' as const, content: userMessage },
    ]

    // 3. Create tools for this user
    const tools = createCrmTools(userId)

    // 4. Call AI agent
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(5),
    })

    const assistantMessage = result.text

    // 5. Save conversation history
    await this.saveConversationHistory([
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage },
    ])

    return assistantMessage
  }

  private static async getConversationHistory(): Promise<ConversationMessage[]> {
    const conversation = await prisma.botConversation.findFirst({
      where: { id: CONVERSATION_ID },
    })

    if (!conversation) return []

    return (conversation.messages as ConversationMessage[]).slice(-MAX_CONVERSATION_MESSAGES)
  }

  private static async saveConversationHistory(messages: ConversationMessage[]) {
    const trimmed = messages.slice(-MAX_CONVERSATION_MESSAGES)

    await prisma.botConversation.upsert({
      where: { id: CONVERSATION_ID },
      update: {
        messages: trimmed as unknown as Prisma.JsonArray,
        lastActiveAt: new Date(),
      },
      create: {
        id: CONVERSATION_ID,
        messages: trimmed as unknown as Prisma.JsonArray,
        lastActiveAt: new Date(),
      },
    })
  }
}
```

Note: Import `Prisma` at the top — add `import { Prisma } from '@prisma/client'` alongside the prisma import.

- [ ] **Step 2: Commit**

```bash
git add lib/services/whatsapp-agent.service.ts
git commit -m "feat: add WhatsApp AI agent service with conversation history"
```

---

## Task 7: Passive Index Webhook

**Files:**
- Create: `app/api/whatsapp/index/route.ts`

- [ ] **Step 1: Create index webhook**

This endpoint receives messages from the personal WhatsApp number and silently indexes them.

Create `app/api/whatsapp/index/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // WAHA sends different event types — we only care about messages
    if (body.event !== 'message') {
      return NextResponse.json({ ok: true })
    }

    const message = body.payload
    if (!message?.body || !message?.from) {
      return NextResponse.json({ ok: true })
    }

    // Extract phone number from chat ID
    const phoneNumber = WahaService.extractPhoneNumber(
      message.fromMe ? message.to : message.from
    )

    // Try to match to an existing contact by phone
    const contact = await prisma.contact.findFirst({
      where: {
        phone: { contains: phoneNumber.slice(-7) },
      },
      select: { id: true },
    })

    // Store the message
    await prisma.whatsAppMessage.create({
      data: {
        phoneNumber,
        direction: message.fromMe ? 'OUTGOING' : 'INCOMING',
        content: message.body,
        contactId: contact?.id ?? null,
        sessionName: process.env.WAHA_PERSONAL_SESSION ?? 'personal',
        timestamp: new Date(message.timestamp * 1000),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp index webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/whatsapp/index/route.ts
git commit -m "feat: add passive WhatsApp message indexing webhook"
```

---

## Task 8: Bot Webhook

**Files:**
- Create: `app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Create bot webhook**

This endpoint receives messages on the bot number, invokes the AI agent, and sends the reply back.

Create `app/api/whatsapp/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''
const OWNER_PHONE = process.env.WHATSAPP_OWNER_PHONE ?? ''

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Only handle message events
    if (body.event !== 'message') {
      return NextResponse.json({ ok: true })
    }

    const message = body.payload
    if (!message?.body || !message?.from || message.fromMe) {
      return NextResponse.json({ ok: true })
    }

    // Security: only process messages from the owner
    const senderPhone = WahaService.extractPhoneNumber(message.from)
    const ownerNormalized = OWNER_PHONE.replace(/[-\s]/g, '')
    if (!senderPhone.endsWith(ownerNormalized.slice(-7))) {
      console.log(`Ignoring message from non-owner: ${senderPhone}`)
      return NextResponse.json({ ok: true })
    }

    // Get the user ID (single-user system — get the first OWNER user)
    const user = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
    })

    if (!user) {
      console.error('No OWNER user found in database')
      return NextResponse.json({ ok: true })
    }

    // Process through AI agent
    const reply = await WhatsAppAgentService.processMessage(user.id, message.body)

    // Send reply back via WAHA
    await WahaService.sendMessage({
      chatId: message.from,
      text: reply,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp bot webhook error:', error)

    // Try to send error message back
    try {
      const body = await req.clone().json()
      if (body.payload?.from) {
        await WahaService.sendMessage({
          chatId: body.payload.from,
          text: 'שגיאה בעיבוד ההודעה. נסה שוב.',
        })
      }
    } catch {
      // Ignore error sending error message
    }

    return NextResponse.json({ ok: true })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/whatsapp/webhook/route.ts
git commit -m "feat: add WhatsApp bot webhook with AI agent interaction"
```

---

## Task 9: Build Verification

- [ ] **Step 1: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors. The new API routes should appear:
```
├ ƒ /api/whatsapp/index
├ ƒ /api/whatsapp/webhook
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any build issues in WhatsApp bot"
```

---

## Summary

| # | Task | Files | Description |
|---|------|-------|-------------|
| 1 | Prisma schema | 1 modified | WhatsAppMessage + BotConversation models |
| 2 | Dependencies | 0 | Install ai, @ai-sdk/gateway |
| 3 | Fuzzy match | 1 created | Shared name matching utility |
| 4 | WAHA service | 1 created | REST client for sending WhatsApp messages |
| 5 | Agent tools | 1 created | 13 CRM tool definitions |
| 6 | Agent service | 1 created | Agent orchestration + conversation history |
| 7 | Index webhook | 1 created | Passive message indexing |
| 8 | Bot webhook | 1 created | Interactive agent endpoint |
| 9 | Verification | 0 | Build + lint check |
| **Total** | | **7 files** | |

## Post-Implementation Setup

After deploying, you need to:
1. Set up a VPS with Docker
2. Run WAHA Plus container with two sessions (personal + bot)
3. Configure WAHA webhooks pointing to your CRM:
   - Personal session webhook: `https://your-crm.vercel.app/api/whatsapp/index`
   - Bot session webhook: `https://your-crm.vercel.app/api/whatsapp/webhook`
4. Set environment variables on Vercel
5. Scan QR codes in WAHA dashboard to link both WhatsApp numbers
