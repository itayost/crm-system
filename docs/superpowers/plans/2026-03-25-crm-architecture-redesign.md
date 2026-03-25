# CRM Architecture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the CRM from 12 models to 4 (User, Contact, Project, Task), merging Lead+Client into a unified Contact with status progression, removing payments/notifications/activities, and rebuilding all services, API routes, and pages.

**Architecture:** Clean rebuild approach — replace Prisma schema, delete all old code, then rebuild services/routes/pages from scratch. Auth system, shadcn/ui components, layout shell, and utilities stay. The existing `withAuth` wrapper, `createResponse`/`errorResponse` helpers, and Zod validation patterns are reused.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma + PostgreSQL, Zod, shadcn/ui, Tailwind CSS (RTL/Hebrew)

**Spec:** `docs/superpowers/specs/2026-03-25-crm-architecture-redesign.md`

---

## File Map

### Files to CREATE

```
scripts/migrate-data.ts                       — Data migration script (run BEFORE db:push)
lib/validations/contact.ts                    — Zod schemas for Contact
lib/validations/project.ts                    — Zod schemas for Project
lib/validations/task.ts                       — Zod schemas for Task
lib/services/contacts.service.ts              — Contact CRUD + status transitions
lib/services/projects.service.ts              — Project CRUD + contact validation
lib/services/tasks.service.ts                 — Task CRUD + optional project linking
lib/services/dashboard.service.ts             — KPI aggregation
app/api/contacts/route.ts                     — GET (list) + POST (create)
app/api/contacts/[id]/route.ts                — GET + PUT + DELETE
app/api/projects/route.ts                     — GET (list) + POST (create)
app/api/projects/[id]/route.ts                — GET + PUT + DELETE
app/api/tasks/route.ts                        — GET (list) + POST (create)
app/api/tasks/[id]/route.ts                   — GET + PUT + DELETE
app/api/dashboard/route.ts                    — GET (KPIs)
components/forms/contact-form.tsx             — Contact create/edit form
components/forms/project-form.tsx             — Project create/edit form
components/forms/task-form.tsx                 — Task create/edit form
app/(dashboard)/contacts/page.tsx             — Contacts list with tabs
app/(dashboard)/contacts/[id]/page.tsx        — Contact detail
app/(dashboard)/projects/page.tsx             — Projects list
app/(dashboard)/projects/[id]/page.tsx        — Project detail
app/(dashboard)/tasks/page.tsx                — Tasks list
app/(dashboard)/page.tsx                      — Dashboard
```

### Files to OVERWRITE

```
prisma/schema.prisma                          — New 4-model schema (replaces old 12-model schema)
```

### Files to MODIFY

```
components/layout/sidebar.tsx                 — Update navigation items
components/layout/header.tsx                  — Remove notification/search refs to old models
prisma/seed.ts                               — Rewrite for new schema (if kept)
```

### Files to DELETE

```
# Old services (all of lib/services/ except what we recreate)
lib/services/base.service.ts
lib/services/leads.service.ts
lib/services/clients.service.ts
lib/services/payments.service.ts
lib/services/morning.service.ts
lib/services/notifications.service.ts
lib/services/priority-scoring.service.ts
lib/services/reports.service.ts
lib/services/whatsapp.service.ts
lib/services/dashboard.service.ts             — recreated
lib/services/projects.service.ts              — recreated
lib/services/tasks.service.ts                 — recreated

# Old API routes
app/api/leads/                                — entire directory
app/api/clients/                              — entire directory
app/api/payments/                             — entire directory
app/api/notifications/                        — entire directory
app/api/activities/                           — entire directory
app/api/reminders/                            — entire directory
app/api/reports/                              — entire directory
app/api/morning/                              — entire directory
app/api/whatsapp/                             — entire directory
app/api/cron/                                 — entire directory
app/api/priority/                             — entire directory
app/api/webhooks/                             — entire directory
app/api/admin/                                — entire directory
app/api/public/                               — entire directory
app/api/dashboard/                            — entire directory (recreated as single file)
app/api/projects/                             — entire directory (recreated)
app/api/tasks/                                — entire directory (recreated)

# Old pages
app/(dashboard)/leads/                        — entire directory
app/(dashboard)/clients/                      — entire directory
app/(dashboard)/payments/                     — entire directory
app/(dashboard)/reports/                      — entire directory
app/(dashboard)/settings/                     — entire directory
app/(dashboard)/morning/                      — entire directory
app/(dashboard)/projects/                     — entire directory (recreated)
app/(dashboard)/tasks/                        — entire directory (recreated)
app/(dashboard)/page.tsx                      — recreated

# Old components
components/forms/lead-form.tsx
components/forms/client-form.tsx
components/forms/payment-form.tsx
components/forms/recurring-payment-form.tsx
components/forms/project-form.tsx             — recreated
components/forms/task-form.tsx                — recreated
components/payments/                          — entire directory
components/public/                            — entire directory
components/notifications/                     — entire directory
components/activity/                          — entire directory

# Old lib files
lib/api/mock-db.ts
```

### Files UNTOUCHED

```
lib/api/api-handler.ts                        — withAuth, createResponse, errorResponse
lib/api/auth-handler.ts                       — getCurrentUserId, isAuthenticated
lib/api/client.ts                             — Frontend API client
lib/auth/auth.ts                              — NextAuth config
lib/auth/auth.config.ts                       — Auth options
lib/db/prisma.ts                              — Prisma client instance
lib/utils.ts                                  — cn() utility
middleware.ts                                 — Auth middleware
app/(auth)/                                   — Login/register pages
app/(dashboard)/layout.tsx                    — Dashboard layout
app/layout.tsx                                — Root layout
components/ui/                                — All shadcn components
tailwind.config.ts                            — Styling config
```

---

## Task 1: Data Migration Script (Before Schema Change)

**Files:**
- Create: `scripts/migrate-data.ts`

- [ ] **Step 1: Write migration script**

Create `scripts/migrate-data.ts` that reads from old tables and writes to new ones. This script must be written and run BEFORE `db:push` — it reads old data using raw SQL (since the old Prisma models won't exist after schema change).

The script should:
1. Read all Lead records -> insert as Contact (status mapping: CONVERTED->CLIENT, LOST->INACTIVE)
2. Read all Client records -> insert as Contact with status=CLIENT (isVip=true if type was VIP)
3. For leads that were converted, match via convertedToClientId to avoid duplicating the same person
4. Read all Project records -> insert with contactId (mapped from clientId)
5. Read all Task records -> insert with nullable projectId (WAITING_APPROVAL->IN_PROGRESS)

Note: This script is only needed if there's production data to preserve. For a fresh start, skip this task and just run `db:push` in the final task.

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-data.ts
git commit -m "feat: add data migration script for old schema to new schema"
```

---

## Task 2: Replace Prisma Schema

**Files:**
- Overwrite: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema.prisma with the new 4-model schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      UserRole @default(OWNER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contacts Contact[]
  projects Project[]
  tasks    Task[]
}

model Contact {
  id              String        @id @default(cuid())
  name            String
  email           String?
  phone           String
  company         String?
  status          ContactStatus @default(NEW)
  source          ContactSource
  estimatedBudget Decimal?      @db.Decimal(10, 2)
  projectType     String?
  isVip           Boolean       @default(false)
  address         String?
  taxId           String?
  notes           String?       @db.Text
  convertedAt     DateTime?

  userId   String
  user     User      @relation(fields: [userId], references: [id])
  projects Project[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}

model Project {
  id                 String              @id @default(cuid())
  name               String
  description        String?             @db.Text
  type               ProjectType
  status             ProjectStatus       @default(DRAFT)
  priority           Priority            @default(MEDIUM)
  startDate          DateTime?
  deadline           DateTime?
  completedAt        DateTime?
  price              Decimal?            @db.Decimal(10, 2)
  retention          Decimal?            @db.Decimal(10, 2)
  retentionFrequency RetentionFrequency?

  contactId String
  contact   Contact @relation(fields: [contactId], references: [id])
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  tasks     Task[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([deadline])
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?    @db.Text
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  completedAt DateTime?

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([status])
}

enum UserRole {
  OWNER
  ADMIN
  USER
}

enum ContactStatus {
  NEW
  CONTACTED
  QUOTED
  NEGOTIATING
  CLIENT
  INACTIVE
}

enum ContactSource {
  WEBSITE
  PHONE
  WHATSAPP
  REFERRAL
  OTHER
}

enum ProjectType {
  LANDING_PAGE
  WEBSITE
  ECOMMERCE
  WEB_APP
  MOBILE_APP
  MANAGEMENT_SYSTEM
  CONSULTATION
}

enum ProjectStatus {
  DRAFT
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum RetentionFrequency {
  MONTHLY
  YEARLY
}
```

- [ ] **Step 2: Generate Prisma client (don't push to DB yet)**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success message. This validates the schema syntax without touching the database.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: replace schema with 4-model architecture (User, Contact, Project, Task)"
```

---

## Task 3: Delete All Old Code

**Files:** See "Files to DELETE" in the file map above.

- [ ] **Step 1: Delete old services**

```bash
rm lib/services/base.service.ts
rm lib/services/leads.service.ts
rm lib/services/clients.service.ts
rm lib/services/payments.service.ts
rm lib/services/morning.service.ts
rm lib/services/notifications.service.ts
rm lib/services/priority-scoring.service.ts
rm lib/services/reports.service.ts
rm lib/services/whatsapp.service.ts
rm lib/services/dashboard.service.ts
rm lib/services/projects.service.ts
rm lib/services/tasks.service.ts
```

- [ ] **Step 2: Delete old API routes**

```bash
rm -rf app/api/leads
rm -rf app/api/clients
rm -rf app/api/payments
rm -rf app/api/notifications
rm -rf app/api/activities
rm -rf app/api/reminders
rm -rf app/api/reports
rm -rf app/api/morning
rm -rf app/api/whatsapp
rm -rf app/api/cron
rm -rf app/api/priority
rm -rf app/api/webhooks
rm -rf app/api/admin
rm -rf app/api/public
rm -rf app/api/dashboard
rm -rf app/api/projects
rm -rf app/api/tasks
```

- [ ] **Step 3: Delete old pages**

```bash
rm -rf app/\(dashboard\)/leads
rm -rf app/\(dashboard\)/clients
rm -rf app/\(dashboard\)/payments
rm -rf app/\(dashboard\)/reports
rm -rf app/\(dashboard\)/settings
rm -rf app/\(dashboard\)/morning
rm -rf app/\(dashboard\)/projects
rm -rf app/\(dashboard\)/tasks
rm app/\(dashboard\)/page.tsx
```

- [ ] **Step 4: Delete old components**

```bash
rm components/forms/lead-form.tsx
rm components/forms/client-form.tsx
rm components/forms/payment-form.tsx
rm components/forms/recurring-payment-form.tsx
rm components/forms/project-form.tsx
rm components/forms/task-form.tsx
rm -rf components/payments
rm -rf components/public
rm -rf components/notifications
rm -rf components/activity
```

- [ ] **Step 5: Delete misc old files**

```bash
rm -f lib/api/mock-db.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete all old services, routes, pages, and components"
```

---

## Task 4: Create Zod Validation Schemas

**Files:**
- Create: `lib/validations/contact.ts`
- Create: `lib/validations/project.ts`
- Create: `lib/validations/task.ts`

- [ ] **Step 1: Create contact validation schemas**

Create `lib/validations/contact.ts`:

```typescript
import { z } from 'zod'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

export const createContactSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string().min(9, 'טלפון חובה').regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']),
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
})

export const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין').optional(),
  company: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CLIENT', 'INACTIVE']).optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).optional(),
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
```

- [ ] **Step 2: Create project validation schemas**

Create `lib/validations/project.ts`:

```typescript
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1, 'שם פרויקט חובה'),
  description: z.string().optional(),
  type: z.enum([
    'LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP',
    'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  price: z.number().optional(),
  retention: z.number().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
  contactId: z.string().min(1, 'לקוח חובה'),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum([
    'LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP',
    'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION',
  ]).optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  price: z.number().nullable().optional(),
  retention: z.number().nullable().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
```

- [ ] **Step 3: Create task validation schemas**

Create `lib/validations/task.ts`:

```typescript
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'כותרת משימה חובה'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  projectId: z.string().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  projectId: z.string().nullable().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
```

- [ ] **Step 4: Commit**

```bash
git add lib/validations/
git commit -m "feat: add Zod validation schemas for Contact, Project, Task"
```

---

## Task 5: Contacts Service

**Files:**
- Create: `lib/services/contacts.service.ts`

- [ ] **Step 1: Create the contacts service**

Create `lib/services/contacts.service.ts`:

```typescript
import { prisma } from '@/lib/db/prisma'
import { ContactStatus, ContactSource, Prisma } from '@prisma/client'

const LEAD_STATUSES: ContactStatus[] = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING']
const CLIENT_STATUSES: ContactStatus[] = ['CLIENT', 'INACTIVE']

interface ContactFilters {
  status?: ContactStatus
  source?: ContactSource
  phase?: 'lead' | 'client'
  search?: string
}

interface CreateContactInput {
  name: string
  email?: string
  phone: string
  company?: string
  source: ContactSource
  estimatedBudget?: number
  projectType?: string
  notes?: string
}

interface UpdateContactInput {
  name?: string
  email?: string
  phone?: string
  company?: string
  status?: ContactStatus
  source?: ContactSource
  estimatedBudget?: number
  projectType?: string
  isVip?: boolean
  address?: string
  taxId?: string
  notes?: string
}

export class ContactsService {
  static async getAll(userId: string, filters?: ContactFilters) {
    const where: Prisma.ContactWhereInput = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.source && { source: filters.source }),
      ...(filters?.phase === 'lead' && { status: { in: LEAD_STATUSES } }),
      ...(filters?.phase === 'client' && { status: { in: CLIENT_STATUSES } }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { email: { contains: filters.search, mode: 'insensitive' as const } },
          { phone: { contains: filters.search } },
          { company: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    return prisma.contact.findMany({
      where,
      include: {
        projects: {
          select: { id: true, name: true, status: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: {
        projects: {
          include: {
            tasks: { select: { id: true, title: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    return contact
  }

  static async create(userId: string, data: CreateContactInput) {
    return prisma.contact.create({
      data: {
        ...data,
        userId,
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateContactInput) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: { projects: { select: { status: true } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    // If setting to INACTIVE, check for active projects
    if (data.status === 'INACTIVE') {
      const activeProjectStatuses = ['DRAFT', 'IN_PROGRESS', 'ON_HOLD']
      const hasActiveProjects = contact.projects.some((p) =>
        activeProjectStatuses.includes(p.status)
      )
      if (hasActiveProjects) {
        throw new Error('לא ניתן לסמן איש קשר כלא פעיל כאשר יש לו פרויקטים פעילים')
      }
    }

    // If converting to CLIENT, set convertedAt
    const updateData: Prisma.ContactUpdateInput = { ...data }
    if (data.status === 'CLIENT' && contact.status !== 'CLIENT') {
      updateData.convertedAt = new Date()
    }

    return prisma.contact.update({
      where: { id },
      data: updateData,
    })
  }

  static async delete(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: { projects: { select: { id: true } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact.projects.length > 0) {
      throw new Error('לא ניתן למחוק איש קשר עם פרויקטים קיימים')
    }

    return prisma.contact.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/contacts.service.ts
git commit -m "feat: add ContactsService with CRUD, status transitions, and validation"
```

---

## Task 6: Projects Service

**Files:**
- Create: `lib/services/projects.service.ts`

- [ ] **Step 1: Create the projects service**

Create `lib/services/projects.service.ts`:

```typescript
import { prisma } from '@/lib/db/prisma'
import { ProjectStatus, Prisma } from '@prisma/client'

interface ProjectFilters {
  status?: ProjectStatus
  contactId?: string
  search?: string
}

interface CreateProjectInput {
  name: string
  description?: string
  type: string
  priority?: string
  startDate?: string
  deadline?: string
  price?: number
  retention?: number
  retentionFrequency?: string
  contactId: string
}

interface UpdateProjectInput {
  name?: string
  description?: string
  type?: string
  status?: string
  priority?: string
  startDate?: string | null
  deadline?: string | null
  price?: number | null
  retention?: number | null
  retentionFrequency?: string | null
}

export class ProjectsService {
  static async getAll(userId: string, filters?: ProjectFilters) {
    const where: Prisma.ProjectWhereInput = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.contactId && { contactId: filters.contactId }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    return prisma.project.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        tasks: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    return project
  }

  static async create(userId: string, data: CreateProjectInput) {
    // Validate contact exists and is a CLIENT
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, userId },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact.status !== 'CLIENT') {
      throw new Error('ניתן ליצור פרויקט רק עבור לקוח (לא ליד)')
    }

    return prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type as Prisma.ProjectCreateInput['type'],
        priority: (data.priority as Prisma.ProjectCreateInput['priority']) ?? 'MEDIUM',
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        price: data.price,
        retention: data.retention,
        retentionFrequency: data.retentionFrequency as Prisma.ProjectCreateInput['retentionFrequency'],
        contactId: data.contactId,
        userId,
      },
      include: {
        contact: { select: { id: true, name: true } },
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateProjectInput) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    // If completing, set completedAt
    const updateData: Record<string, unknown> = { ...data }
    if (data.status === 'COMPLETED' && project.status !== 'COMPLETED') {
      updateData.completedAt = new Date()
    }
    // If un-completing, clear completedAt
    if (data.status && data.status !== 'COMPLETED' && project.status === 'COMPLETED') {
      updateData.completedAt = null
    }
    // Parse dates
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null
    }
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null
    }

    return prisma.project.update({
      where: { id },
      data: updateData as Prisma.ProjectUpdateInput,
    })
  }

  static async delete(userId: string, id: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: { tasks: { select: { id: true } } },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    if (project.tasks.length > 0) {
      throw new Error('לא ניתן למחוק פרויקט עם משימות קיימות — מחק קודם את המשימות')
    }

    return prisma.project.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/projects.service.ts
git commit -m "feat: add ProjectsService with CRUD and contact validation"
```

---

## Task 7: Tasks Service

**Files:**
- Create: `lib/services/tasks.service.ts`

- [ ] **Step 1: Create the tasks service**

Create `lib/services/tasks.service.ts`:

```typescript
import { prisma } from '@/lib/db/prisma'
import { TaskStatus, Prisma } from '@prisma/client'

interface TaskFilters {
  status?: TaskStatus
  projectId?: string
  standalone?: boolean
  search?: string
}

interface CreateTaskInput {
  title: string
  description?: string
  priority?: string
  dueDate?: string
  projectId?: string
}

interface UpdateTaskInput {
  title?: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string | null
  projectId?: string | null
}

export class TasksService {
  static async getAll(userId: string, filters?: TaskFilters) {
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.projectId && { projectId: filters.projectId }),
      ...(filters?.standalone && { projectId: null }),
      ...(filters?.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' as const } },
          { description: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    return prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  static async getById(userId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            contact: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    return task
  }

  static async create(userId: string, data: CreateTaskInput) {
    // If projectId provided, validate it exists
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
      })
      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }
    }

    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: (data.priority as Prisma.TaskCreateInput['priority']) ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        projectId: data.projectId || undefined,
        userId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateTaskInput) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    const updateData: Record<string, unknown> = { ...data }

    // If completing, set completedAt
    if (data.status === 'COMPLETED' && task.status !== 'COMPLETED') {
      updateData.completedAt = new Date()
    }
    if (data.status && data.status !== 'COMPLETED' && task.status === 'COMPLETED') {
      updateData.completedAt = null
    }
    // Parse date
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null
    }

    return prisma.task.update({
      where: { id },
      data: updateData as Prisma.TaskUpdateInput,
    })
  }

  static async delete(userId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    return prisma.task.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/tasks.service.ts
git commit -m "feat: add TasksService with CRUD and optional project linking"
```

---

## Task 8: Dashboard Service

**Files:**
- Create: `lib/services/dashboard.service.ts`

- [ ] **Step 1: Create the dashboard service**

Create `lib/services/dashboard.service.ts`:

```typescript
import { prisma } from '@/lib/db/prisma'

export interface DashboardData {
  revenue: {
    total: number
    thisMonth: number
  }
  contacts: {
    leads: number
    clients: number
    newThisWeek: number
  }
  projects: {
    active: number
    completed: number
    total: number
  }
  tasks: {
    pending: number
    overdue: number
    completedThisWeek: number
  }
  recentContacts: Array<{
    id: string
    name: string
    status: string
    createdAt: Date
  }>
  activeProjects: Array<{
    id: string
    name: string
    status: string
    deadline: Date | null
    contact: { name: string }
  }>
}

export class DashboardService {
  static async getData(userId: string): Promise<DashboardData> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const [
      totalRevenue,
      monthlyRevenue,
      leadCount,
      clientCount,
      newContactsThisWeek,
      activeProjects,
      completedProjects,
      totalProjects,
      pendingTasks,
      overdueTasks,
      completedTasksThisWeek,
      recentContacts,
      activeProjectsList,
    ] = await Promise.all([
      // Revenue: sum of price for COMPLETED projects
      prisma.project.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { price: true },
      }),
      prisma.project.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: startOfMonth },
        },
        _sum: { price: true },
      }),
      // Contact counts
      prisma.contact.count({
        where: { userId, status: { in: ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] } },
      }),
      prisma.contact.count({
        where: { userId, status: 'CLIENT' },
      }),
      prisma.contact.count({
        where: { userId, createdAt: { gte: startOfWeek } },
      }),
      // Project counts
      prisma.project.count({
        where: { userId, status: { in: ['DRAFT', 'IN_PROGRESS', 'ON_HOLD'] } },
      }),
      prisma.project.count({
        where: { userId, status: 'COMPLETED' },
      }),
      prisma.project.count({ where: { userId } }),
      // Task counts
      prisma.task.count({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: startOfWeek },
        },
      }),
      // Recent contacts
      prisma.contact.findMany({
        where: { userId },
        select: { id: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Active projects list
      prisma.project.findMany({
        where: { userId, status: { in: ['DRAFT', 'IN_PROGRESS', 'ON_HOLD'] } },
        select: {
          id: true,
          name: true,
          status: true,
          deadline: true,
          contact: { select: { name: true } },
        },
        orderBy: { deadline: 'asc' },
        take: 5,
      }),
    ])

    return {
      revenue: {
        total: Number(totalRevenue._sum.price ?? 0),
        thisMonth: Number(monthlyRevenue._sum.price ?? 0),
      },
      contacts: {
        leads: leadCount,
        clients: clientCount,
        newThisWeek: newContactsThisWeek,
      },
      projects: {
        active: activeProjects,
        completed: completedProjects,
        total: totalProjects,
      },
      tasks: {
        pending: pendingTasks,
        overdue: overdueTasks,
        completedThisWeek: completedTasksThisWeek,
      },
      recentContacts,
      activeProjects: activeProjectsList,
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/dashboard.service.ts
git commit -m "feat: add DashboardService with KPI aggregation"
```

---

## Task 9: Contacts API Routes

**Files:**
- Create: `app/api/contacts/route.ts`
- Create: `app/api/contacts/[id]/route.ts`

- [ ] **Step 1: Create contacts list + create route**

Create `app/api/contacts/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { createContactSchema } from '@/lib/validations/contact'
import { ContactStatus, ContactSource } from '@prisma/client'

export const GET = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as ContactStatus | null
  const source = searchParams.get('source') as ContactSource | null
  const phase = searchParams.get('phase') as 'lead' | 'client' | null
  const search = searchParams.get('search') || undefined

  const contacts = await ContactsService.getAll(userId, {
    status: status || undefined,
    source: source || undefined,
    phase: phase || undefined,
    search,
  })

  return createResponse(contacts)
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const data = createContactSchema.parse(body)

  const contact = await ContactsService.create(userId, {
    ...data,
    source: data.source as ContactSource,
  })

  return createResponse(contact, 201)
})
```

- [ ] **Step 2: Create contacts detail route**

Create `app/api/contacts/[id]/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { updateContactSchema } from '@/lib/validations/contact'

export const GET = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  const contact = await ContactsService.getById(userId, id)
  return createResponse(contact)
})

export const PUT = withAuth(async (req, { userId, params }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateContactSchema.parse(body)

  const contact = await ContactsService.update(userId, id, data)
  return createResponse(contact)
})

export const DELETE = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  await ContactsService.delete(userId, id)
  return createResponse({ success: true })
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/contacts/
git commit -m "feat: add contacts API routes (list, create, get, update, delete)"
```

---

## Task 10: Projects API Routes

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: Create projects list + create route**

Create `app/api/projects/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { createProjectSchema } from '@/lib/validations/project'
import { ProjectStatus } from '@prisma/client'

export const GET = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as ProjectStatus | null
  const contactId = searchParams.get('contactId') || undefined
  const search = searchParams.get('search') || undefined

  const projects = await ProjectsService.getAll(userId, {
    status: status || undefined,
    contactId,
    search,
  })

  return createResponse(projects)
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const data = createProjectSchema.parse(body)

  const project = await ProjectsService.create(userId, data)
  return createResponse(project, 201)
})
```

- [ ] **Step 2: Create projects detail route**

Create `app/api/projects/[id]/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ProjectsService } from '@/lib/services/projects.service'
import { updateProjectSchema } from '@/lib/validations/project'

export const GET = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  const project = await ProjectsService.getById(userId, id)
  return createResponse(project)
})

export const PUT = withAuth(async (req, { userId, params }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateProjectSchema.parse(body)

  const project = await ProjectsService.update(userId, id, data)
  return createResponse(project)
})

export const DELETE = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  await ProjectsService.delete(userId, id)
  return createResponse({ success: true })
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/
git commit -m "feat: add projects API routes (list, create, get, update, delete)"
```

---

## Task 11: Tasks API Routes

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create tasks list + create route**

Create `app/api/tasks/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { createTaskSchema } from '@/lib/validations/task'
import { TaskStatus } from '@prisma/client'

export const GET = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as TaskStatus | null
  const projectId = searchParams.get('projectId') || undefined
  const standalone = searchParams.get('standalone') === 'true' || undefined
  const search = searchParams.get('search') || undefined

  const tasks = await TasksService.getAll(userId, {
    status: status || undefined,
    projectId,
    standalone,
    search,
  })

  return createResponse(tasks)
})

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const data = createTaskSchema.parse(body)

  const task = await TasksService.create(userId, data)
  return createResponse(task, 201)
})
```

- [ ] **Step 2: Create tasks detail route**

Create `app/api/tasks/[id]/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { TasksService } from '@/lib/services/tasks.service'
import { updateTaskSchema } from '@/lib/validations/task'

export const GET = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  const task = await TasksService.getById(userId, id)
  return createResponse(task)
})

export const PUT = withAuth(async (req, { userId, params }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateTaskSchema.parse(body)

  const task = await TasksService.update(userId, id, data)
  return createResponse(task)
})

export const DELETE = withAuth(async (_req, { userId, params }) => {
  const { id } = await params
  await TasksService.delete(userId, id)
  return createResponse({ success: true })
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/tasks/
git commit -m "feat: add tasks API routes (list, create, get, update, delete)"
```

---

## Task 12: Dashboard API Route

**Files:**
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Create dashboard route**

Create `app/api/dashboard/route.ts`:

```typescript
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { DashboardService } from '@/lib/services/dashboard.service'

export const GET = withAuth(async (_req, { userId }) => {
  const data = await DashboardService.getData(userId)
  return createResponse(data)
})
```

- [ ] **Step 2: Commit**

```bash
git add app/api/dashboard/
git commit -m "feat: add dashboard API route with KPI aggregation"
```

---

## Task 13: Update Sidebar Navigation

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/header.tsx`

- [ ] **Step 1: Rewrite sidebar with new navigation**

Replace the navigation items and badge fetching in `components/layout/sidebar.tsx`. The new sidebar has:
- Dashboard (/)
- Contacts (/contacts) — badge: lead count
- Projects (/projects) — badge: active count
- Tasks (/tasks) — badge: overdue count

Remove: payments, reports, morning, settings links. Remove notification badge at bottom. Remove the `SidebarBadges` import from the old dashboard service. Remove the badges API call (`/dashboard/badges`) and notification count call (`/notifications?countOnly=true`). Replace with a single lightweight call or remove badge fetching entirely (dashboard page shows the numbers).

Key changes:
- Remove `DollarSign`, `BarChart`, `Target`, `FileText` icon imports
- Keep `LayoutDashboard`, `Users`, `Briefcase`, `CheckSquare`, `Settings`
- Remove `bottomNavigation` array entirely
- Remove notification bell section at bottom
- Update `getNavigation` to only include: Dashboard, Contacts, Projects, Tasks
- Replace `/leads` href with `/contacts`

- [ ] **Step 2: Update header to remove old references**

In `components/layout/header.tsx`, remove any imports or references to notification bell, old search results that reference leads/clients/payments separately. If header imports from old services, remove those imports.

- [ ] **Step 3: Commit**

```bash
git add components/layout/sidebar.tsx components/layout/header.tsx
git commit -m "refactor: update sidebar and header for simplified navigation"
```

---

## Task 14: Contact Form Component

**Files:**
- Create: `components/forms/contact-form.tsx`

- [ ] **Step 1: Create contact form**

Create `components/forms/contact-form.tsx` using React Hook Form + Zod (matching the existing client-form pattern). The form includes:
- name (required), phone (required, Israeli format), email (optional), company (optional)
- source (select: WEBSITE/PHONE/WHATSAPP/REFERRAL/OTHER)
- estimatedBudget (number, optional), projectType (text, optional)
- notes (textarea, optional)
- For editing: isVip (switch), address, taxId fields shown when contact is in CLIENT phase

Use shadcn/ui components: Input, Select, Textarea, Button, Switch, Dialog, Form (react-hook-form).
All labels in Hebrew. RTL layout.

- [ ] **Step 2: Commit**

```bash
git add components/forms/contact-form.tsx
git commit -m "feat: add ContactForm component with Zod validation"
```

---

## Task 15: Contacts Page

**Files:**
- Create: `app/(dashboard)/contacts/page.tsx`

- [ ] **Step 1: Create contacts page with tabs**

Create `app/(dashboard)/contacts/page.tsx` as a `'use client'` component. Features:
- Tab bar with 3 tabs: "לידים" (leads phase), "לקוחות" (clients phase), "הכל" (all)
- Search input that filters by name/phone/email
- "איש קשר חדש" button that opens ContactForm in a Dialog
- Table/card list of contacts with columns: name, phone, status, source, createdAt
- Status badge with color coding
- Click row to navigate to `/contacts/[id]`
- For leads tab: Kanban board view option with columns for each lead status (NEW, CONTACTED, QUOTED, NEGOTIATING)

Fetch data from `GET /api/contacts?phase=lead|client` based on active tab. Use the existing `api` client from `lib/api/client.ts`.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/contacts/page.tsx
git commit -m "feat: add contacts page with tabs (leads/clients/all) and Kanban view"
```

---

## Task 16: Contact Detail Page

**Files:**
- Create: `app/(dashboard)/contacts/[id]/page.tsx`

- [ ] **Step 1: Create contact detail page**

Create `app/(dashboard)/contacts/[id]/page.tsx` as a `'use client'` component. Features:
- Breadcrumb: Contacts > Contact Name
- Contact info card: name, phone, email, company, source, status badge
- Edit button that opens ContactForm in Dialog with pre-filled data
- Delete button with AlertDialog confirmation (blocked if has projects)
- Status transition buttons (e.g., "המר ללקוח" button when in lead phase)
- If CLIENT status: show projects list with link to each project, show "פרויקט חדש" button
- If lead phase: show estimatedBudget, projectType

Fetch from `GET /api/contacts/[id]`.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/contacts/\[id\]/page.tsx
git commit -m "feat: add contact detail page with projects list and status transitions"
```

---

## Task 17: Project Form Component

**Files:**
- Create: `components/forms/project-form.tsx`

- [ ] **Step 1: Create project form**

Create `components/forms/project-form.tsx` using React Hook Form + Zod. Fields:
- name (required), description (textarea), type (select from ProjectType enum)
- priority (select), startDate (date input), deadline (date input)
- price (number, ILS), retention (number, optional), retentionFrequency (select: MONTHLY/YEARLY, shown only if retention > 0)
- contactId (select from contacts with CLIENT status — passed as prop or fetched)

All labels in Hebrew. RTL layout.

- [ ] **Step 2: Commit**

```bash
git add components/forms/project-form.tsx
git commit -m "feat: add ProjectForm component with price and retention fields"
```

---

## Task 18: Projects Page

**Files:**
- Create: `app/(dashboard)/projects/page.tsx`

- [ ] **Step 1: Create projects page**

Create `app/(dashboard)/projects/page.tsx` as a `'use client'` component. Features:
- "פרויקט חדש" button that opens ProjectForm in Dialog
- Filter by status (select), filter by contact (select)
- Search input
- Table/card list: name, contact name, type, status badge, priority, deadline, price
- Click row to navigate to `/projects/[id]`

Fetch from `GET /api/projects`. Fetch contacts with CLIENT status for the contact filter and the form's contactId select.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/projects/page.tsx
git commit -m "feat: add projects page with filtering and project creation"
```

---

## Task 19: Project Detail Page

**Files:**
- Create: `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Create project detail page**

Create `app/(dashboard)/projects/[id]/page.tsx` as a `'use client'` component. Features:
- Breadcrumb: Projects > Project Name
- Project info card: name, type, status, priority, dates, contact link
- Price + retention display (formatted as ILS)
- Edit button → ProjectForm in Dialog
- Delete button with AlertDialog (blocked if has tasks)
- Status transition buttons
- Tasks section: list of tasks for this project, "משימה חדשה" button (pre-fills projectId)
- Task form opens in Dialog

Fetch from `GET /api/projects/[id]`.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/projects/\[id\]/page.tsx
git commit -m "feat: add project detail page with tasks list and price/retention display"
```

---

## Task 20: Task Form Component

**Files:**
- Create: `components/forms/task-form.tsx`

- [ ] **Step 1: Create task form**

Create `components/forms/task-form.tsx` using React Hook Form + Zod. Fields:
- title (required), description (textarea)
- priority (select), dueDate (date input)
- projectId (optional select from user's projects — passed as prop or fetched)

All labels in Hebrew. RTL layout.

- [ ] **Step 2: Commit**

```bash
git add components/forms/task-form.tsx
git commit -m "feat: add TaskForm component with optional project linking"
```

---

## Task 21: Tasks Page

**Files:**
- Create: `app/(dashboard)/tasks/page.tsx`

- [ ] **Step 1: Create tasks page**

Create `app/(dashboard)/tasks/page.tsx` as a `'use client'` component. Features:
- "משימה חדשה" button → TaskForm in Dialog
- Filter by status, filter by project, toggle "standalone only"
- Search input
- Table/card list: title, status badge, priority badge, dueDate, project name (or "ללא פרויקט")
- Inline status toggle (checkbox to mark completed)
- Click row to expand or navigate to detail

Fetch from `GET /api/tasks`.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/tasks/page.tsx
git commit -m "feat: add tasks page with filtering and inline status toggle"
```

---

## Task 22: Dashboard Page

**Files:**
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Create dashboard page**

Create `app/(dashboard)/page.tsx` as a `'use client'` component. Features:
- 4 KPI cards at top: Total Revenue (ILS), Active Projects, Leads in Pipeline, Pending Tasks
- Recent contacts list (last 5)
- Active projects list with deadlines
- Quick action buttons: "ליד חדש", "פרויקט חדש", "משימה חדשה"

Fetch from `GET /api/dashboard`. Use Recharts if desired for a simple revenue chart, but keep it minimal.

All text in Hebrew. RTL layout.

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/page.tsx
git commit -m "feat: add dashboard page with KPIs and quick actions"
```

---

## Task 23: Apply Schema and Build Verification

- [ ] **Step 1: Push schema to database**

Run: `npm run db:push`
Expected: Prisma applies the new schema. Old tables are dropped, new tables created.

**WARNING:** This is destructive. If preserving data, run the migration script FIRST against the old schema.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors. All imports resolve correctly.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 4: Run dev server and verify**

Run: `npm run dev`
Verify:
- Login works
- Dashboard loads with KPIs (all zeros for fresh DB)
- Contacts page loads with tabs
- Can create a new contact (lead)
- Can change contact status to CLIENT
- Can create a project for a CLIENT contact
- Can create a task (with and without project)
- Projects page lists projects
- Tasks page lists tasks

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete CRM architecture redesign — 4 models, simplified UI"
```

---

## Summary

| # | Task | Files | Steps |
|---|------|-------|-------|
| 1 | Migration script | 1 file | 2 |
| 2 | Prisma schema | 1 file | 3 |
| 3 | Delete old code | ~50 files | 6 |
| 4 | Zod schemas | 3 files | 4 |
| 5 | Contacts service | 1 file | 2 |
| 6 | Projects service | 1 file | 2 |
| 7 | Tasks service | 1 file | 2 |
| 8 | Dashboard service | 1 file | 2 |
| 9 | Contacts API | 2 files | 3 |
| 10 | Projects API | 2 files | 3 |
| 11 | Tasks API | 2 files | 3 |
| 12 | Dashboard API | 1 file | 2 |
| 13 | Sidebar + header | 2 files | 3 |
| 14 | Contact form | 1 file | 2 |
| 15 | Contacts page | 1 file | 2 |
| 16 | Contact detail | 1 file | 2 |
| 17 | Project form | 1 file | 2 |
| 18 | Projects page | 1 file | 2 |
| 19 | Project detail | 1 file | 2 |
| 20 | Task form | 1 file | 2 |
| 21 | Tasks page | 1 file | 2 |
| 22 | Dashboard page | 1 file | 2 |
| 23 | Build verification | 0 files | 5 |
| **Total** | | **~30 new files** | **58 steps** |
