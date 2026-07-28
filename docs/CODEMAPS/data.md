# Data Codemap

Freshness: 2026-07-28 | Models: 11 | Enums: 15

## Schema: prisma/schema.prisma

A person is a `Contact`. The business they belong to is a `Client`, and it is
the Client that owns projects and tickets. That split is why a Contact carries
`clientId` / `role` / `isPrimary` rather than owning projects directly.

```
User ──< Client ──< Project ──< ProjectPhase
          │           │  └───< Task
          │           └──< Request
          └──< Contact ──< Request
                  └──< WhatsAppMessage
```

## Models

### User

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| email | String | unique |
| password | String | bcrypt hash |
| name | String | |
| role | UserRole | default OWNER |

### Contact — a person

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name, phone | String | required |
| email, company, address, taxId, notes | String? | |
| status | ContactStatus | default NEW; derived to CLIENT on create when clientId is given |
| source | ContactSource | required |
| estimatedBudget | Decimal(10,2)? | |
| projectType | String? | |
| isVip | Boolean | default false |
| convertedAt | DateTime? | set when a *lead* was won; null for contacts born as clients |
| lastContactedAt | DateTime? | written by the WhatsApp webhooks only |
| nextActionAt | DateTime? | the one thing owed to this lead next |
| nextActionNote | Text? | what that thing is |
| role, isPrimary, clientId | membership in a Client | |
| userId | String | FK -> User |
| **indexes** | status, (userId,status), createdAt, clientId, (userId,nextActionAt) | |

### Client — a business

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| isVip, isInternal | Boolean | |
| address, taxId, notes | String? | |
| formToken | String? | public request-form token |
| userId | String | FK -> User |

### Project

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| description | Text? | |
| type | ProjectType | required |
| status | ProjectStatus | default ACTIVE |
| priority | Priority | default MEDIUM |
| startDate, deadline, completedAt | DateTime? | |
| advanceAmount | Decimal(10,2)? | מקדמה paid up front |
| advancePaidAt | DateTime? | set only by an explicit `advancePaid` flag |
| retention | Decimal(10,2)? | recurring |
| retentionFrequency | RetentionFrequency? | MONTHLY/YEARLY |
| clientId | String | FK -> Client |
| primaryContactId | String? | FK -> Contact |
| userId | String | FK -> User |
| **indexes** | status, (userId,status), deadline, clientId, primaryContactId | |

There is **no `price` column**. A project's total is `advanceAmount` plus the
sum of its phases — see `lib/utils/project-money.ts`.

### ProjectPhase — a billable stage

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| order | Int | 1..n, renumbered on delete |
| status | PhaseStatus | default NOT_STARTED |
| price | Decimal(10,2) | default 0; zero is a valid answer |
| approvedAt | DateTime? | follows status both ways |
| paidAt | DateTime? | moves only on an explicit `paid` flag |
| projectId | String | FK -> Project, ON DELETE CASCADE |
| **indexes** | projectId, (projectId,order), status | |

**No `userId`.** Ownership is proven through the project, the same way
`AgentProjectConfig` works. `PhasesService` checks it on every call.

### Task

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| title | String | required |
| description | Text? | |
| status | TaskStatus | default TODO |
| priority | Priority | default MEDIUM |
| category | TaskCategory | default CLIENT_WORK |
| dueDate, completedAt | DateTime? | |
| projectId | String? | FK -> Project (nullable = standalone) |
| userId | String | FK -> User |

### Request — a client ticket

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| title | String | required |
| description | Text? | |
| type, status, priority, source | enums | status defaults PENDING_REVIEW for AI drafts |
| isAiGenerated, aiConfidence, aiNote | AI provenance | |
| intake | Jsonb? | structured intake filled by the support agent |
| attachments | String[] | |
| clientId | String | FK -> Client, required |
| contactId, projectId, taskId | String? | optional links |
| userId | String | FK -> User |

Remaining models — `WhatsAppMessage`, `BotConversation`, `SupportConversation`,
`AgentProjectConfig` — belong to the WhatsApp/support surface.

## Enums

| Enum | Values |
|------|--------|
| UserRole | OWNER, ADMIN, USER |
| ContactStatus | NEW, CONTACTED, MEETING_SCHEDULED, QUOTED, CLIENT, LOST, INACTIVE |
| ContactSource | WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER |
| ProjectType | LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION |
| ProjectStatus | ACTIVE, COMPLETED |
| PhaseStatus | NOT_STARTED, IN_PROGRESS, PENDING_APPROVAL, REVISIONS, APPROVED |
| Priority | LOW, MEDIUM, HIGH, URGENT |
| TaskStatus | TODO, IN_PROGRESS, COMPLETED, CANCELLED |
| TaskCategory | CLIENT_WORK, MARKETING, LEAD_FOLLOWUP, ADMIN |
| RetentionFrequency | MONTHLY, YEARLY |
| RequestType | REQUEST, BUG, IMPROVEMENT, QUESTION, OTHER |
| RequestStatus | PENDING_REVIEW, OPEN, IN_PROGRESS, RESOLVED, DISMISSED |
| RequestSource | WHATSAPP, MANUAL, EMAIL, FORM, OTHER |
| MessageDirection | INBOUND, OUTBOUND |
| AgentMonitoringStatus | see AgentProjectConfig |

## Rules that live in services, not the schema

- **Lead phase** — `LEAD_STATUSES` (NEW, CONTACTED, MEETING_SCHEDULED, QUOTED)
  and `CLIENT_STATUSES` (CLIENT, INACTIVE) in `lib/validations/enums.ts` drive
  the `phase` filter. **LOST is in neither**: it is a terminal lead state, so it
  leaves the pipeline without joining the client roster.
- **Phase on create** — a Contact created with a `clientId` is born CLIENT with
  `convertedAt` left null. Derived in `ContactsService.create` so the form, the
  API and the WhatsApp agent cannot disagree.
- **Next action** — cleared automatically when a contact reaches CLIENT, LOST or
  INACTIVE, unless the same request sets one.
- **Money** — revenue is paid phases plus paid advances. Approval (`approvedAt`)
  and payment (`paidAt`) are independent, so un-approving never un-pays. All
  three totals come from `lib/utils/project-money.ts`.

## Migrations

`prisma db push` times out on the Supabase pooler, so schema changes ship as
idempotent SQL in `scripts/NN_*.sql`, applied with:

```bash
npx prisma db execute --schema prisma/schema.prisma --file scripts/NN_name.sql
npx prisma generate
```

`scripts/12_contact_pipeline.sql` (the lead pipeline, and this repo's first enum
value rebuild) and `scripts/13_project_phases.sql` (phases; **drops
`Project.price`** after migrating it into one phase) are the two most recent.
