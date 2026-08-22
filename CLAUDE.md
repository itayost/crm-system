# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **Next.js 15 CRM system** for a Hebrew-speaking freelancer (RTL). A 2026-03 redesign cut a 12-model architecture down to four; it has since grown back as WhatsApp support, client requests and phase billing landed. The four originals (User, Contact, Project, Task) are still the spine.

## Business Context

The CRM is built for a freelancer in the digital field who:

- Manages ~10 clients with many one-time projects
- Handles multiple active projects (landing pages, apps, websites, consultations)
- Works with capacity for 3-4 large or 6-7 small projects simultaneously
- Needs efficient time management and accurate project tracking
- Requires fast lead response (< 2 hours)

## Data Model

Read `prisma/schema.prisma` for the full schema. The five models that carry the
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
- **Billed per phase.** A project has an `advanceAmount` (מקדמה) plus many `ProjectPhase` rows. There is no `Project.price` -- the total is `advance + Σ phase prices`, computed by `projectTotal()` in `lib/money/project.ts`. Never re-derive money inline; use those helpers -- and never re-derive "what is owed" either: `collectable()` and `signedOffUnpaid()` in `lib/money/ledger.ts` own that, and `גבייה` (owner-wide, advances included) is deliberately wider than `לתשלום` (per project, phases only). See `docs/adr/0003-collectable-is-not-what-a-client-owes.md`
- `retention` + `retentionFrequency` are unchanged (recurring maintenance)
- Has many Tasks and many Requests

### ProjectPhase

- A billable stage: `name`, `order`, `status`, `price`, `approvedAt`, `paidAt`
- Statuses: NOT_STARTED, IN_PROGRESS, PENDING_APPROVAL, REVISIONS, APPROVED. **Not a straight line** -- PENDING_APPROVAL and REVISIONS cycle, which is why the UI uses a Select and not a "next stage" button
- **The client answers PENDING_APPROVAL from the portal** (`PhasesService.recordClientReview`, token-scoped). Approving stamps `approvedAt` and makes the phase billable; asking for changes moves it to REVISIONS with their note. REVISIONS is *Itay's* turn, so the client sees it as work in progress -- never as something waiting on them
- **Approval and payment are separate.** `approvedAt` follows the status both ways; `paidAt` moves only on an explicit `paid` flag, so un-approving a phase never un-pays it
- **No `userId`** -- ownership comes through the project (same as `AgentProjectConfig`), so `PhasesService` proves project ownership on every call. Cascades on project delete
- Dashboard revenue = paid phases + paid advances. Approved-but-unpaid surfaces separately as `outstanding`

### Task

- Optionally linked to a Project (standalone tasks are also supported)
- Statuses: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- Priority: LOW, MEDIUM, HIGH, URGENT

## Architecture

### Key Files

- `middleware.ts` -- Protects all routes except `/api`, `/_next`, `/favicon.ico`; redirects unauthenticated users to `/login`

### Authentication

- NextAuth.js v4 with credentials provider (email + password with bcrypt)
- JWT strategy with session tokens
- Middleware-based route protection (all non-API routes require auth)
- User ID extracted from session in API routes via the `withAuth` wrapper in `lib/api/api-handler.ts`

### Service Layer Pattern

Each service in `lib/services/` is a static class whose methods take `userId` as
the first parameter. **Every query must be scoped by it** -- that is the only
thing standing between two users' data.

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

`WHATSAPP_BOT_PAUSED` stops the bot talking to clients. The full runbook --
what stays running, and why both pausing and resuming cost a redeploy -- lives
in the `pausing-the-bot` skill.

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

## Client portal

`/r/[token]` is the client's own page: their requests with plain-Hebrew
statuses, the submit form, and the approve button on a quote. The token is
`Client.formToken`, so **the URL is the credential** -- rotating it from
`/clients/[id]` revokes access instantly.

- **Server components only.** Reads go straight to Prisma; there is no public
  JSON GET API, so there is nothing to enumerate and no CORS surface. The one
  write is a Server Action in `app/r/[token]/actions.ts`
- **One scoping rule.** Every portal query is
  `where: { id, client: { formToken: token } }`. A caller can pass any request
  id and still only reach their own client's rows. Never look a request up by
  id alone here
- **`lib/services/client-view.ts` decides what a client sees** -- the visible
  statuses (never DISMISSED), the field whitelist, and `clientStatusOf()`, which
  derives התקבלה / ממתין לביצוע / ממתין לאישורך / בפיתוח / הושלם / לא אושר from
  the internal status plus the quote fields. The support bot's `getMyRequests`
  reads the same module, so the two surfaces cannot tell a client two different
  stories
- **Headers.** `next.config.ts` gives `/r/:path*` `noindex` and, importantly,
  `Referrer-Policy: no-referrer` -- the token is in the path, so anything else
  leaks it to every outbound request

## Request billing

A request carries `billingKind` (INCLUDED / BILLABLE / WARRANTY /
QUOTE_REQUIRED), `estimateHours`, `quotedPrice`, `quotedAt` and the client's
`clientDecision`. **`billingKind` is nullable and null means today's behaviour**,
so the gate is opt-in per request and nothing written before it existed changed.

- `RequestsService.sendQuote` refuses a chargeable request with no price or no
  project. Requiring the project at quote time is what guarantees the billing
  phase has somewhere to land later
- `ensureTask` withholds the Task while a BILLABLE / QUOTE_REQUIRED request has
  no client approval. Owner triage still runs: `approve()` moves
  PENDING_REVIEW -> OPEN, only the work item waits
- `recordClientDecision(token, ...)` is scoped by the token, not by `userId` --
  the caller is the client. Approving materialises a `ProjectPhase`, claimed via
  a unique `Request.phaseId`, so a double-tap cannot bill twice
- **The phase is born NOT_STARTED with `approvedAt` null.** The client approved
  the *quote*, not the *work*. `PhaseStatus.APPROVED` is what
  `projectOutstanding()` reads for "invoices worth chasing", so stamping it here
  would put unearned money in the dashboard and the morning brief. Quote
  sign-off lives on `Request.clientDecisionAt`; work sign-off stays on the phase
- **The gate only bites when `billingKind` is set before approval.** Approve
  first and the Task already exists, which is the state of every request that
  predates the feature. So a decline can land on live work. It is **flagged,
  never cancelled**: the owner notice names the open Task and the request page
  offers one-click "בטל משימה". Auto-cancelling would kill work possibly already
  half done, and a decline is often the opening of a negotiation rather than the
  end of one -- both are calls only Itay can make
- `clientBotChat()` takes `allowPhoneFallback`, and all three client notices
  (quote, approval, progress) pass it. The rule is **"an explicit owner action
  just happened"**: Itay pressed שלח הצעה, אשר, or moved the status, so the
  message is a reply to something he did rather than an unsolicited ping. It
  defaults to `false` so a future *automatic* sender has to opt in and think
  first -- which is the case the original bot-session-only rule was protecting
- **Every notice goes out from the bot number**, and a paused bot drops whatever
  comes back. So the "finished" notice asks `isBotPaused()` and swaps its
  sign-off: `אני כאן` when the bot can hear a reply, the portal link when it
  cannot. Never promise a channel that is switched off
- **`notifyOwner()` in `lib/services/owner-line.ts` is the only way to reach
  Itay.** It owns resolving his chat id -- the stored LID, else `OWNER_PHONE` --
  plus delivery, the missing-recipient guard and swallowing failures. Never
  hand-roll a `WahaService.sendMessage` to him: three notification paths once
  resolved without the phone fallback and went silent on a fresh deployment.
  Notices are Hebrew; the `about` label is short English because it is the only
  part that reaches a log, and notices carry client names

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

## Legacy Context

The `claude-context/` directory contains planning documents from the original 12-model design. These documents describe the old architecture (leads, clients, payments, activities, notifications, milestones, documents as separate models) and are outdated. Do not rely on those documents for understanding the current codebase.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for itayost/crm-system via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names used as-is: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by /domain-modeling). See `docs/agents/domain.md`.
