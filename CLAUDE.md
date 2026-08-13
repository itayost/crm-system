# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server
npm run dev          # Start Next.js development server on http://localhost:3000

# Build & Production
npm run build        # Build the production-ready application
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint for code quality checks

# Database (Prisma)
npm run db:push      # Push schema changes to database without migrations
npm run db:migrate   # Apply migrations to the database
npm run db:studio    # Open Prisma Studio for database management

# Testing
npm test             # Run Vitest unit/route tests (tests/*.test.ts)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Run Playwright E2E tests (62 tests across 8 spec files)
npm run typecheck    # tsc --noEmit
```

## Project Overview

A **Next.js 15 CRM system** for a Hebrew-speaking freelancer (RTL). A 2026-03 redesign cut a 12-model architecture down to four; it has since grown back to **11 models** as WhatsApp support, client requests and phase billing landed. The four originals (User, Contact, Project, Task) are still the spine.

## Business Context

The CRM is built for a freelancer in the digital field who:

- Manages ~10 clients with many one-time projects
- Handles multiple active projects (landing pages, apps, websites, consultations)
- Works with capacity for 3-4 large or 6-7 small projects simultaneously
- Needs efficient time management and accurate project tracking
- Requires fast lead response (< 2 hours)

## Technology Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI primitives, shadcn/ui components
- **Authentication**: NextAuth.js v4 with JWT strategy and credentials provider
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for dashboard analytics
- **Notifications**: react-hot-toast (dashboard), Sonner (toasts)
- **Styling**: Tailwind CSS with RTL support, Hebrew font (Heebo)
- **Testing**: Playwright for E2E tests
- **HTTP Client**: Axios via `lib/api/client.ts`

## Data Model

The schema (`prisma/schema.prisma`) has 11 models. The five that carry the
domain are below; the rest (Client, Request, WhatsAppMessage, BotConversation,
SupportConversation, AgentProjectConfig) are covered in `docs/CODEMAPS/data.md`.

### User

- Authentication and ownership; all data is scoped to a user
- Roles: OWNER, ADMIN, USER

### Contact

- A person. The business they belong to is a separate `Client` model; a Contact points at one via `clientId` (with `role` and `isPrimary`)
- Lead pipeline: NEW -> CONTACTED -> MEETING_SCHEDULED -> QUOTED, then CLIENT if won or **LOST** if not. INACTIVE is for a churned *client*, not a dead lead
- `LEAD_STATUSES` and `CLIENT_STATUSES` live in `lib/validations/enums.ts` and are the single source for the `phase` filter (`lead` | `client`). **LOST is in neither** -- the לידים tab is the active pipeline, and LOST shows under "הכל" or via the status filter
- **Status is not settable on create.** `ContactsService.create` derives it: a contact created with a `clientId` is born CLIENT (with `convertedAt` left null, since it was never a lead we won). Everything else takes the schema default NEW
- `convertedAt` marks when a lead became a client
- `nextActionAt` + `nextActionNote`: the one thing owed to this lead next. Drives the leads-table sort and the morning brief's "פעולות להיום". Cleared automatically on reaching CLIENT / LOST / INACTIVE
- Sources: WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER
- Hebrew labels come from `lib/design/labels.ts`, colours from `lib/design/tones.ts` -- never inline either. `tests/design-tones.test.ts` fails the build on any raw Tailwind palette class (`bg-red-100`, `text-green-600`, ...) under `app/` or `components/`

### Project

- Belongs to a **Client** (the business), with an optional `primaryContactId` pointing at a person in it
- Statuses: **ACTIVE, COMPLETED** only. There is no DRAFT / ON_HOLD / CANCELLED
- Types: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
- Priority: LOW, MEDIUM, HIGH, URGENT
- **Billed per phase.** A project has an `advanceAmount` (מקדמה) plus many `ProjectPhase` rows. There is no `Project.price` -- the total is `advance + Σ phase prices`, computed by `projectTotal()` in `lib/utils/project-money.ts`. Never re-derive money inline; use those helpers
- `retention` + `retentionFrequency` are unchanged (recurring maintenance)
- Has many Tasks and many Requests

### ProjectPhase

- A billable stage: `name`, `order`, `status`, `price`, `approvedAt`, `paidAt`
- Statuses: NOT_STARTED, IN_PROGRESS, PENDING_APPROVAL, REVISIONS, APPROVED. **Not a straight line** -- PENDING_APPROVAL and REVISIONS cycle, which is why the UI uses a Select and not a "next stage" button
- **Approval and payment are separate.** `approvedAt` follows the status both ways; `paidAt` moves only on an explicit `paid` flag, so un-approving a phase never un-pays it
- **No `userId`** -- ownership comes through the project (same as `AgentProjectConfig`), so `PhasesService` proves project ownership on every call. Cascades on project delete
- Dashboard revenue = paid phases + paid advances. Approved-but-unpaid surfaces separately as `outstanding`

### Task

- Optionally linked to a Project (standalone tasks are also supported)
- Statuses: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- Priority: LOW, MEDIUM, HIGH, URGENT

## Architecture

### Directory Structure

```text
app/
  (auth)/
    login/page.tsx           # Login page
    layout.tsx               # Auth layout
  (dashboard)/
    page.tsx                 # Dashboard (KPIs, recent items, charts)
    layout.tsx               # Dashboard layout with sidebar + header
    contacts/
      page.tsx               # Contacts list with lead/client phase tabs
      [id]/page.tsx          # Contact detail page
    projects/
      page.tsx               # Projects list with status filters
      [id]/page.tsx          # Project detail with tasks
    tasks/
      page.tsx               # Tasks list with filters
  api/
    auth/
      [...nextauth]/route.ts # NextAuth handler
      register/route.ts      # User registration
    contacts/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    projects/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    tasks/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    dashboard/
      route.ts               # GET dashboard aggregate data

lib/
  api/
    api-handler.ts           # Shared API route handler wrapper
    client.ts                # Axios client for frontend API calls
  auth/
    auth.config.ts           # NextAuth provider configuration
    auth.ts                  # NextAuth instance
  db/
    prisma.ts                # Prisma client singleton
  services/
    contacts.service.ts      # Contact CRUD, phase filtering, lead-to-client conversion
    projects.service.ts      # Project CRUD with contact validation
    tasks.service.ts         # Task CRUD with project linking
    dashboard.service.ts     # Dashboard aggregation queries
  validations/
    contact.ts               # Zod schemas for contact input
    project.ts               # Zod schemas for project input
    task.ts                  # Zod schemas for task input
  config/                    # Configuration (currently empty)
  errors/                    # Error utilities (currently empty)
  hooks/                     # Custom hooks (currently empty)
  utils/
    project-money.ts         # projectTotal / projectPaid / projectOutstanding
  utils.ts                   # cn(), formatDate(), formatCurrency()
  design/
    labels.ts                # every enum's Hebrew, decided once
    tones.ts                 # every status's colour, decided once
  types/                     # wire shapes shared by pages (contact, project, request)

components/
  forms/
    contact-form.tsx         # Contact create/edit form
    project-form.tsx         # Project create/edit form
    task-form.tsx            # Task create/edit form
  layout/
    header.tsx               # Top header with user info
    sidebar.tsx              # Navigation sidebar
  ui/                        # shadcn/ui components (23 components)
  charts/                    # Chart components (currently empty)
  shared/                    # Shared components (currently empty)

tests/                       # Vitest route/unit tests (mocked Prisma + WAHA)
  whatsapp-bot-webhook.test.ts   # Bot-session identity routing
  whatsapp-index-webhook.test.ts # Personal-session indexing
  whatsapp-identity.test.ts      # Phone normalization and contact matching

e2e/
  auth.spec.ts               # Authentication flows
  dashboard.spec.ts          # Dashboard page tests
  contacts.spec.ts           # Contact CRUD and conversion tests
  projects.spec.ts           # Project CRUD and status transition tests
  tasks.spec.ts              # Task CRUD and linking tests
  navigation.spec.ts         # Sidebar navigation tests
  fixtures.ts                # Shared test fixtures and helpers
  global-setup.ts            # Playwright global setup (login)
  global-teardown.ts         # Playwright global teardown

prisma/
  schema.prisma              # Database schema
```

### Key Files

- `middleware.ts` -- Protects all routes except `/api`, `/_next`, `/favicon.ico`; redirects unauthenticated users to `/login`
- `playwright.config.ts` -- E2E test configuration
- `next.config.ts` -- Next.js configuration
- `tailwind.config.js` -- Tailwind with RTL support

### Authentication

- NextAuth.js v4 with credentials provider (email + password with bcrypt)
- JWT strategy with session tokens
- Middleware-based route protection (all non-API routes require auth)
- User ID extracted from session in API routes via the `withAuth` wrapper in `lib/api/api-handler.ts`

### Service Layer Pattern

Each service is a static class with methods that accept `userId` as the first parameter for data scoping:

```typescript
// Example pattern
class ContactsService {
  static async getAll(userId: string, filters?: ContactFilters): Promise<Contact[]>
  static async getById(userId: string, id: string): Promise<Contact | null>
  static async create(userId: string, data: CreateContactInput): Promise<Contact>
  static async update(userId: string, id: string, data: UpdateContactInput): Promise<Contact>
  static async delete(userId: string, id: string): Promise<void>
}
```

Services: `ContactsService`, `ProjectsService`, `TasksService`, `DashboardService`

### API Route Pattern

API routes use handler functions from `lib/api/`:

- `api-handler.ts` wraps route logic with error handling
- `withAuth` in the same file extracts the authenticated user and forwards route params. It maps an `Error` to a 400 **only if the message contains Hebrew** -- everything else becomes a 500, so service errors must be written in Hebrew
- All mutations validate input with Zod schemas from `lib/validations/`

### Frontend Pattern

- Pages are client components (`'use client'`) that fetch data via `lib/api/client.ts` (Axios)
- Forms use React Hook Form with Zod resolvers
- UI built with shadcn/ui components (Dialog modals for create/edit)
- Toast notifications via react-hot-toast
- All text in Hebrew, all layouts RTL

## Status colours

Three layers, all in `app/globals.css`: primitives (raw palette, meaningless),
semantics (`--tone-{name}-{surface|foreground|mark|solid|on-solid}`), and the
`.tone-*` / `.tone-tag[data-emphasis]` rules.

**Every status renders through `<StatusPill>`** (`components/ui/status-pill.tsx`),
never `<Badge>`. Two orthogonal axes:

- `tone` -- *which* thing it is. From `toneOf(SOME_MAP, value)`.
- `emphasis` -- *how much it matters*. `solid` (at most one per row), `soft`
  (the column you scan), `outline` (elevated), `quiet` (a dot plus body text).

The rule a table follows: status gets the one `soft` pill, type/category/source
go `quiet`, and priority goes through `PRIORITY_EMPHASIS`, which keeps LOW and
MEDIUM as plain text so only HIGH and URGENT show a chip. Hue lives in the dot,
not the pale surface -- that is what makes two dark statuses distinguishable at
12px. `Badge` still exists for non-status chips but has no toned call sites.

**Two traps, both of which already cost us a silent, product-wide outage:**

1. The `.tone-*` rules sit **outside** `@layer components` on purpose. Tailwind
   tree-shakes its own layers against the content globs, and the only file that
   names these classes is `lib/design/tones.ts`. When they were inside the layer
   and `lib/` was not in `content`, all eight rules were purged from every build
   and every badge in the product rendered `bg-secondary` grey for weeks. Both
   halves are now fixed; do not undo either.
2. Unlayered also means the rules are emitted after `@tailwind utilities`, so a
   tone beats a `bg-*` utility instead of losing a coin-toss on emit order. Never
   pass a `bg-*` through `StatusPill`'s `className`.

`tests/design-tones.test.ts` guards both, plus "every map value is a real tone"
and "no raw palette classes anywhere".

## Hebrew/RTL Support

- Full RTL layout with `dir="rtl"` and `lang="he"`
- All UI labels, messages, and validation errors in Hebrew
- Israeli date format (DD/MM/YYYY)
- Week starts on Sunday
- Currency in ILS (formatted with toLocaleString)

## Environment Configuration

Required environment variables:

- `DATABASE_URL` -- PostgreSQL connection string (Supabase pooled)
- `DIRECT_URL` -- Direct database URL for migrations
- `NEXTAUTH_SECRET` -- JWT encryption secret
- `NEXTAUTH_URL` -- Application URL for auth callbacks
- `PUBLIC_LEAD_SECRET` -- shared secret for `/api/public/leads`; the endpoint **fails closed** while it is unset. The website holds the same value as `CRM_LEAD_SECRET` and sends it as `x-lead-secret` from its own server route

WhatsApp (WAHA) variables, required for the two webhooks:

- `WHATSAPP_WEBHOOK_SECRET` -- shared secret for both webhooks; they **fail closed** while it is unset
- `OWNER_PHONE` -- Itay's number; the only sender routed to the owner agent on the bot session
- `WAHA_API_URL`, `WAHA_API_KEY` -- self-hosted WAHA instance
- `WAHA_PERSONAL_SESSION` (default `personal`), `WAHA_BOT_SESSION` (default `bot`)
- `GITHUB_TOKEN` -- fine-grained **read-only** token; lets the support agent consult a client project's repo. Optional
- `SUPPORT_MEDIA_MODEL` -- transcription model id (default `google/gemini-2.5-flash`)
- `PRODUCT_CARD_MODEL`, `INTAKE_MODEL` -- optional model overrides for the card generator and the per-message intake/relation pre-pass (both default `anthropic/claude-sonnet-4.6`)
- `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL` -- the local-model tier on the VPS (Ollama behind an authenticated proxy; base URL includes `/v1`). Fallback for the support bot when the gateway fails, primary for the morning brief. Unset disables the tier and the chain still works (gateway -> canned reply). See `docs/adr/0002-degrade-dont-die.md`
- `WHATSAPP_BOT_PAUSED` -- the pause switch, read per request by `isBotPaused()` in `lib/config/bot-pause.ts`. Optional; unset means running

## Pausing the bot

`WHATSAPP_BOT_PAUSED=1` (any value other than `0`/`false`/`off`/`no`/empty) plus a
redeploy stops the bot talking to clients:

- the bot webhook drops **CLIENT and UNKNOWN** senders whole -- no reply, no
  `WhatsAppMessage` row, and therefore no ticket from `extract-requests`. A
  message sent to the bot while it is paused reaches WhatsApp and nothing else
- the hourly `support-followups` sweep sends no reminders; unanswered
  confirmations keep waiting and are swept once the bot is back

Deliberately **not** paused: the owner agent (Itay's own line into the CRM), the
morning brief, the personal-session indexing webhook, and the other crons.
Sender classification runs before the check -- it is the only way to tell the
owner from a client, and it reads without sending or writing anything.

Because Vercel env changes only reach new deployments, both pausing and
resuming cost a redeploy. For an instant stop with no deploy, stop the `bot`
session on WAHA instead -- but WhatsApp then queues everything and delivers it
in a burst on restart.

## Website lead intake

`POST /api/public/leads` is unauthenticated by *session*, not open. Three layers,
all added 2026-08-13 after six leads were written from outside in six minutes:

- **Secret.** `x-lead-secret` must match `PUBLIC_LEAD_SECRET`; unset rejects
  everything (`lib/api/public-lead-auth.ts`). Server-to-server only, so there is
  no CORS grant and no `OPTIONS` handler -- a browser cannot hold the secret. The
  demo files in `public/` (`lead-form.js`, `lead-form-demo.html`) post from the
  browser and therefore no longer work
- **Rate limit.** 10/min per caller IP, in memory, per instance
  (`lib/utils/rate-limit.ts`). Defence in depth for a leaked secret, not the
  primary gate
- **One phone, one contact.** `PublicLeadsService` matches on the normalized
  phone: unknown number creates (201), known number merges into that contact's
  notes and fills its blank fields (200), and the identical payload again within
  10 minutes writes nothing and sends no WhatsApp (200). The window is measured
  from `updatedAt`, so a client resubmitting months later is still heard

## Prompt caching

Both agent loops send `providerOptions: { gateway: { caching: 'auto' } }`.
Measured 2026-07-31: caching works through the gateway (7,112-token prefix
written once, read back at 0.1x on the next call), but the TTL is
**effectively 5 minutes** -- a probe 6.5 minutes after the last hit had to
re-write the full prefix. The 1-hour Anthropic TTL does not survive the
AI SDK -> Gateway path. Consequences: the intra-turn agent steps and rapid
message bursts get cache reads; a WhatsApp reply gap longer than ~5 minutes
pays one fresh cache write (1.25x) on the next turn. Editing any tool
description invalidates the whole cache (tools -> system -> messages cascade),
so batch tool-wording changes.

## E2E Testing

62 Playwright tests across 8 spec files covering:

- Authentication (login, registration)
- Dashboard (KPIs, data display)
- Contacts (CRUD, lead-to-client conversion, phase filtering)
- Projects (CRUD, status transitions, delete protection when tasks exist)
- Tasks (CRUD, project linking, standalone tasks, inline completion)
- Navigation (sidebar links)

Tests use a shared global setup that logs in once and stores auth state. Test fixtures in `e2e/fixtures.ts` provide seeded data helpers.

Run with: `npm run test:e2e`

## Code Patterns to Follow

- **Services**: Static classes in `lib/services/`, always scope queries by `userId`
- **API Routes**: Wrap with `withAuth` from `lib/api/api-handler.ts`, validate with Zod, throw Hebrew errors
- **Forms**: React Hook Form + Zod schemas, Dialog modals for create/edit
- **Error Handling**: Hebrew error messages with toast notifications
- **UI Components**: shadcn/ui with consistent RTL styling
- **Immutability**: Never mutate objects; use spread operator for updates
- **Contact phases**: Use the `phase` filter (lead/client) rather than separate models

## Codebase Metrics

- ~74 TypeScript files
- 11 database models, 15 enums
- 4 service classes
- 9 API route files (7 resource routes + 2 auth routes)
- 6 dashboard pages (+ detail pages for contacts and projects)
- 62 E2E tests across 8 spec files, plus 223 Vitest tests in 22 files
- 23 shadcn/ui components

## Legacy Context

The `claude-context/` directory contains planning documents from the original 12-model design. These documents describe the old architecture (leads, clients, payments, activities, notifications, milestones, documents as separate models) and are outdated. The current system uses the simplified 4-model architecture described above. Do not rely on those documents for understanding the current codebase.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for itayost/crm-system via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names used as-is: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by /domain-modeling). See `docs/agents/domain.md`.
