# CRM Architecture Redesign

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Full architectural simplification of the CRM system

## Goal

Strip the CRM down to its core flow: **Contact -> Project -> Task**. Remove payments, notifications, activities, documents, milestones, morning briefing, WhatsApp integration, and priority scoring. These can return in a future phase.

The system serves a single freelancer managing leads, clients, projects, and tasks — nothing more.

## Core Decision

**Unified Contact model** — Lead and Client are merged into a single `Contact` entity with a status that progresses from lead phase (`NEW, CONTACTED, QUOTED, NEGOTIATING`) to client phase (`CLIENT, INACTIVE`). "Converting" a lead is just a status update, not a separate record.

---

## Data Model

### 4 models total (down from 12)

### User (unchanged)

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| email | String | unique |
| password | String | bcrypt hashed |
| name | String | |
| role | UserRole | OWNER, ADMIN, USER |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Contact (replaces Lead + Client)

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| email | String? | optional |
| phone | String | required, Israeli phone format |
| company | String? | |
| status | ContactStatus | NEW, CONTACTED, QUOTED, NEGOTIATING, CLIENT, INACTIVE |
| source | ContactSource | WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER |
| estimatedBudget | Decimal? | @db.Decimal(10, 2), relevant during lead phase |
| projectType | String? | what kind of project the lead needs, relevant during lead phase |
| isVip | Boolean | default false, client categorization |
| address | String? | relevant during client phase |
| taxId | String? | relevant during client phase |
| notes | String? | @db.Text |
| convertedAt | DateTime? | set when status changes to CLIENT |
| userId | String (FK) | references User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** status, createdAt

**Status progression:**
- Lead phase: NEW -> CONTACTED -> QUOTED -> NEGOTIATING
- Conversion: status = CLIENT, convertedAt = now()
- Client phase: CLIENT, INACTIVE

### Project

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| description | String? | @db.Text |
| type | ProjectType | LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION |
| status | ProjectStatus | DRAFT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED |
| priority | Priority | LOW, MEDIUM, HIGH, URGENT |
| startDate | DateTime? | |
| deadline | DateTime? | |
| completedAt | DateTime? | |
| price | Decimal? | @db.Decimal(10, 2), what the freelancer charges |
| retention | Decimal? | @db.Decimal(10, 2), optional recurring maintenance fee |
| retentionFrequency | RetentionFrequency? | MONTHLY, YEARLY — only relevant if retention is set |
| contactId | String (FK) | references Contact (must be CLIENT status) |
| userId | String (FK) | references User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** status, deadline

**Validation:**
- Creating a project requires the linked contact to have status = CLIENT.
- A contact with projects (any status) cannot be deleted — delete or reassign projects first.
- A contact with active projects (DRAFT, IN_PROGRESS, ON_HOLD) cannot be set to INACTIVE.

### Task

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| title | String | required |
| description | String? | @db.Text |
| status | TaskStatus | TODO, IN_PROGRESS, COMPLETED, CANCELLED |
| priority | Priority | LOW, MEDIUM, HIGH, URGENT |
| dueDate | DateTime? | |
| completedAt | DateTime? | |
| projectId | String? (FK) | optional — references Project |
| userId | String (FK) | references User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** projectId, status

**Key behavior:** Tasks with projectId = null are standalone personal/business tasks.

---

## Models and Fields Removed

| Model/Field | Reason |
|-------------|--------|
| Lead | Merged into Contact |
| Client | Merged into Contact |
| Client.type (VIP/REGULAR) | Replaced by Contact.isVip boolean |
| Client.totalRevenue | Computed on-the-fly from project prices |
| Payment | Replaced by price/retention fields on Project |
| RecurringPayment | Replaced by retention fields on Project |
| Notification | Phase 2 |
| Activity | Phase 2 |
| Document | Phase 2 |
| Milestone | Phase 2 |
| Task subtasks (parentTaskId) | Removed for simplicity, Phase 2 if needed |
| Task.WAITING_APPROVAL status | Removed, migrated to IN_PROGRESS |
| Project.stage | Redundant with Project.status |
| Project.priorityScore | Phase 2 (priority scoring algorithm) |
| Task.priorityScore | Phase 2 (priority scoring algorithm) |
| Frequency.QUARTERLY | Dropped — retention only supports MONTHLY/YEARLY |

---

## API Routes

### 12 routes total (down from 51)

### Contacts — `/api/contacts`

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/contacts` | List with filtering by status, source, search term |
| POST | `/api/contacts` | Create new contact (starts as NEW) |
| GET | `/api/contacts/[id]` | Get contact with projects |
| PUT | `/api/contacts/[id]` | Update fields, including status changes (conversion) |
| DELETE | `/api/contacts/[id]` | Delete — blocked if contact has any projects (regardless of status) |

**Conversion is a PUT:** `PUT /api/contacts/[id]` with `{ status: "CLIENT" }` sets `convertedAt = now()`. No separate endpoint.

### Projects — `/api/projects`

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/projects` | List with filtering by status, contactId, search term |
| POST | `/api/projects` | Create — validates contact has CLIENT status |
| GET | `/api/projects/[id]` | Get project with tasks |
| PUT | `/api/projects/[id]` | Update |
| DELETE | `/api/projects/[id]` | Delete — blocked if project has tasks (delete tasks first) |

### Tasks — `/api/tasks`

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/tasks` | List with filtering by status, projectId, standalone flag, search |
| POST | `/api/tasks` | Create — projectId is optional |
| GET | `/api/tasks/[id]` | Get single task |
| PUT | `/api/tasks/[id]` | Update |
| DELETE | `/api/tasks/[id]` | Delete |

### Auth (unchanged)

| Route | Action |
|-------|--------|
| `/api/auth/[...nextauth]` | NextAuth handler |
| `/api/auth/register` | User registration |

### Dashboard

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/dashboard` | Aggregated KPIs: total revenue (sum of price for COMPLETED projects), contacts by status, active projects count, pending tasks count |

---

## Routes Removed

All payment routes, recurring payment routes, notification routes, activity routes, morning briefing routes, WhatsApp routes, cron routes, priority recalculation routes, report routes, webhook routes, search routes, badge routes.

---

## Pages

### 6 pages total (down from 14)

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — revenue KPIs, pipeline summary, active projects, pending tasks |
| `/contacts` | Unified contacts view with tab filters: leads / clients / all. Kanban board for lead-phase contacts. |
| `/contacts/[id]` | Contact detail — contact info, projects list (if client) |
| `/projects` | Projects list with status and contact filtering |
| `/projects/[id]` | Project detail — info, price/retention, tasks list |
| `/tasks` | All tasks — filterable by status, project, standalone |

Auth pages (login, register) remain unchanged.

### Contacts Page — Tab Filtering

The contacts page replaces both the old Leads and Clients pages:
- **"לידים" tab** — contacts with status NEW, CONTACTED, QUOTED, NEGOTIATING
- **"לקוחות" tab** — contacts with status CLIENT, INACTIVE
- **"הכל" tab** — all contacts

The Kanban board (drag-drop) is available in the leads tab, showing columns for each lead-phase status.

### Pages Removed

Payments page, Reports page, Settings pages (WhatsApp, users), Morning briefing page.

---

## Services

### 4 services total (down from 12)

| Service | Replaces | Responsibility |
|---------|----------|----------------|
| `contacts.service.ts` | leads.service + clients.service | Contact CRUD, status transitions, search/filtering |
| `projects.service.ts` | projects.service (simplified) | Project CRUD, contact validation, price/retention |
| `tasks.service.ts` | tasks.service (simplified) | Task CRUD, optional project linking |
| `dashboard.service.ts` | dashboard.service + reports.service | KPI aggregation |

### Services Removed

payments.service, morning.service, notifications.service, priority-scoring.service, reports.service, whatsapp.service, base.service

---

## Migration Strategy

### Approach: Clean rebuild with data migration

This is a destructive redesign. The old code is replaced, not incrementally refactored.

### Steps

1. **Write data migration script** — before schema changes:
   - Merge Lead + Client into Contact:
     - Leads with status NEW, CONTACTED, QUOTED, NEGOTIATING keep their status
     - Leads with status CONVERTED map to CLIENT (set convertedAt from lead's convertedAt)
     - Leads with status LOST map to INACTIVE
     - Existing Client records map to CLIENT status, with isVip = true if type was VIP
     - Lead's `projectType` field maps to Contact's `projectType`
   - Copy projects with FK updated from `clientId` to `contactId`
   - Copy tasks:
     - `projectId` made nullable
     - Tasks with status WAITING_APPROVAL map to IN_PROGRESS
   - Discard subtask relationships (parentTaskId) — not supported in new schema
   - Skip: payments, notifications, activities, documents, milestones, recurring payments
   - totalRevenue field is dropped — computed on-the-fly from project prices instead

2. **Replace Prisma schema** — new 4-model schema

3. **Delete old code** — remove all old services, API routes, pages, feature components

4. **Build new code** — new services, API routes, pages

5. **Apply schema** — `npm run db:push`

### What stays untouched

- Auth system (NextAuth config, middleware, login/register pages)
- UI component library (`components/ui/` — shadcn components)
- Tailwind config, RTL setup, Hebrew font (Heebo)
- Layout shell (sidebar, header) — updated to reflect new navigation
- Utility functions (`lib/utils.ts`, `lib/db/`)

### What gets rewritten

- `prisma/schema.prisma`
- All services (`lib/services/`)
- All API routes (`app/api/`)
- All dashboard pages (`app/(dashboard)/`)
- Feature components (forms, lists, detail views)

---

## Enums Summary

```
ContactStatus: NEW, CONTACTED, QUOTED, NEGOTIATING, CLIENT, INACTIVE
ContactSource: WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER
ProjectType: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
ProjectStatus: DRAFT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
TaskStatus: TODO, IN_PROGRESS, COMPLETED, CANCELLED
Priority: LOW, MEDIUM, HIGH, URGENT
RetentionFrequency: MONTHLY, YEARLY
UserRole: OWNER, ADMIN, USER
```

### Enums Removed

LeadSource (replaced by ContactSource), LeadStatus (merged into ContactStatus), ClientType, ClientStatus, ProjectStage, PaymentStatus, PaymentType, Frequency, NotificationType

---

## Phase 2 (future)

Features intentionally excluded from this redesign, to be reconsidered later:
- Notifications system
- Activity logging / audit trail
- Document management
- Milestone tracking
- Reports and analytics
- WhatsApp integration
- Morning briefing
- Priority scoring algorithm
- User management / settings
