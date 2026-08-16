# Graph Report - crm-system  (2026-08-16)

## Corpus Check
- 274 files · ~187,029 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1981 nodes · 3685 edges · 184 communities (117 shown, 67 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd7bdfa3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- product-card.service.ts
- support-media.service.ts
- requests/page.tsx
- CLAUDE.md
- ארכיטקטורה טכנית - מערכת CRM
- Phase 1: Fix All Broken Functionality ✅
- CRM Architecture Redesign
- api-handler.ts
- fixtures.ts
- compilerOptions
- ClientsService
- contacts.service.ts
- enums.ts
- support-conversation.service.ts
- CRM Public API Documentation
- utils.ts
- PhasesService
- validations/request.ts
- request-form.tsx
- tasks/[id]/route.ts
- dependencies
- webhook/route.ts
- מסמך דרישות מערכת CRM לפרילנסר
- button.tsx
- WahaService
- morning-brief.service.ts
- whatsapp-identity.ts
- header.tsx
- CRM Architecture Redesign — Implementation Plan
- components.json
- devDependencies
- scripts
- whatsapp-bot-webhook.test.ts
- prisma.ts
- projects/[id]/route.ts
- morning-brief-next-actions.test.ts
- requests/[id]/page.tsx
- createCrmTools
- request-approval.test.ts
- 0002 — The support bot degrades, it does not die
- client-view.ts
- resilient-model.test.ts
- support-followups.test.ts
- E2E Testing Design
- RequestsService
- AgentConfigForm.tsx
- support-agent.service.ts
- product-cards.test.ts
- requests.service.ts
- WhatsApp CRM Agent
- request-extraction.test.ts
- support-repo-tools.test.ts
- next-auth.d.ts
- app/layout.tsx
- Task System Upgrade
- eslint.config.mjs
- E2E Testing Implementation Plan
- approval-paths.test.ts
- phases.test.ts
- support-media.test.ts
- whatsapp-index-webhook.test.ts
- Customer Issue/Bug Form — Design
- breadcrumb.tsx
- package.json
- client-profile.test.ts
- react
- WhatsApp CRM Agent — Implementation Plan
- middleware.ts
- next.config.ts
- app-store.ts
- contact-pipeline.test.ts
- contacts-scoping.test.ts
- cron-support-followups.test.ts
- github-service.test.ts
- media-understanding.test.ts
- .sendMessage
- Remove Time Tracking Feature
- autoprefixer
- Morning Brief
- actions.ts
- class-variance-authority
- clsx
- date-fns
- visual.spec.ts
- eslint-config-next
- @eslint/eslintrc
- @hookform/resolvers
- lucide-react
- .mcp.json
- next
- next-auth
- next-themes
- prisma
- request-quote.test.ts
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slot
- react-hook-form
- Models
- sonner
- @supabase/supabase-js
- Remove Time Tracking Implementation Plan
- zustand
- postcss
- postcss-preset-env
- tailwindcss
- ts-node
- @types/bcryptjs
- @types/react
- @types/react-dom
- vitest
- fix-api-params.sh
- fix-api-types.sh
- fix-final-issues.sh
- fix-remaining.sh
- tailwind.config.js
- dashboard-revenue.test.ts
- whatsapp-identity.test.ts
- vercel.json
- types/contact.ts
- 🚀 מדריך פיתוח מלא - CRM System
- 📚 Additional Resources
- Customer Issue/Bug Form Implementation Plan
- request-extraction.service.ts
- alert.tsx
- avatar.tsx
- Phase 2: Core Modules (שבועות 3-5)
- Glossary
- Dependencies Codemap
- תוכנית פיתוח מפורטת - מערכת CRM
- badge.tsx
- Common Issues and Solutions
- 1. Initial Setup
- שבוע 1: Setup והגדרות
- Backend Codemap
- 5. Core Features Development
- Phase 3: תשלומים ודוחות (שבועות 6-7)
- 2. Database Setup
- 0001 — Product knowledge is precomputed cards, not live retrieval
- Domain Docs
- Issue tracker: GitHub
- Frontend Codemap
- 3. Authentication Implementation
- 9. Deployment
- Architecture Codemap
- projects/[id]/page.tsx
- 4. Layout & Navigation
- 📝 Code Standards
- 🚀 Development Checklist
- 🎉 Launch Checklist
- Potential Risks & Mitigations
- README.md
- 8. WhatsApp Integration
- 📚 Documentation Requirements
- 🔍 Quality Assurance
- Phase 4: אינטגרציות ואוטומציות (שבוע 8)
- Phase 5: Testing & Deployment (שבוע 9)
- public-leads.test.ts
- triage-labels.md
- [token]/layout.tsx
- axios
- leads/route.ts
- react-hot-toast
- tailwind-merge
- @ai-sdk/openai-compatible
- @auth/prisma-adapter
- @itayost/wa
- @radix-ui/react-avatar
- @radix-ui/react-switch
- @radix-ui/react-tabs
- react-dom
- zod
- client-view.test.ts

## God Nodes (most connected - your core abstractions)
1. `label()` - 39 edges
2. `toneOf()` - 37 edges
3. `prisma` - 37 edges
4. `cn()` - 32 edges
5. `Button` - 30 edges
6. `createCrmTools()` - 28 edges
7. `CRM Architecture Redesign — Implementation Plan` - 26 edges
8. `RequestsService` - 23 edges
9. `StatusPill()` - 23 edges
10. `SupportConversationService` - 23 edges

## Surprising Connections (you probably didn't know these)
- `FormBody()` --calls--> `toneOf()`  [EXTRACTED]
  app/(dashboard)/projects/[id]/agent/_components/AgentConfigForm.tsx → lib/design/tones.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts
- `handleClientMessage()` --calls--> `greetingMessage()`  [EXTRACTED]
  app/api/whatsapp/webhook/route.ts → lib/services/whatsapp-messages.ts
- `degradedTurn()` --calls--> `degradedTurnOwnerNotice()`  [EXTRACTED]
  app/api/whatsapp/webhook/route.ts → lib/services/whatsapp-messages.ts
- `handleUnknownSender()` --calls--> `unknownSenderOwnerNotice()`  [EXTRACTED]
  app/api/whatsapp/webhook/route.ts → lib/services/whatsapp-messages.ts

## Import Cycles
- 3-file cycle: `lib/services/requests.service.ts -> lib/services/whatsapp-agent.service.ts -> lib/services/whatsapp-tools.ts -> lib/services/requests.service.ts`

## Communities (184 total, 67 thin omitted)

### Community 0 - "product-card.service.ts"
Cohesion: 0.06
Nodes (30): GET(), GET(), maxDuration, GET(), isCronAuthorized(), safeEqual(), isBotPaused(), OFF_VALUES (+22 more)

### Community 1 - "support-media.service.ts"
Cohesion: 0.08
Nodes (30): notifyOwner(), POST(), TYPE_LABELS, mediaKind, MediaUnderstandingService, PROMPTS, TranscriptionResult, PublicRequestsService (+22 more)

### Community 2 - "requests/page.tsx"
Cohesion: 0.12
Nodes (31): Client, STATUS_FILTER_OPTIONS, ClientOption, ALL_OPTION, CATEGORY_FILTER_TABS, STATUS_FILTER_OPTIONS, Task, SELECTABLE (+23 more)

### Community 3 - "CLAUDE.md"
Cohesion: 0.06
Nodes (33): Agent skills, API Route Pattern, Architecture, Authentication, Business Context, Client portal, Code Patterns to Follow, Codebase Metrics (+25 more)

### Community 4 - "ארכיטקטורה טכנית - מערכת CRM"
Cohesion: 0.05
Nodes (36): API, 🔌 API Endpoints Structure, API Protection, Authentication, Authentication Flow, Backend, Clients, Component Hierarchy (+28 more)

### Community 5 - "Phase 1: Fix All Broken Functionality ✅"
Cohesion: 0.06
Nodes (33): 1A. Form Component Prerequisites, 1B. Dashboard (`app/(dashboard)/page.tsx`), 1C. Leads (`app/(dashboard)/leads/page.tsx`), 1D. Clients (`app/(dashboard)/clients/page.tsx`), 1E. Projects (`app/(dashboard)/projects/page.tsx`), 1F. Payments (`app/(dashboard)/payments/page.tsx`), 1G. Sidebar (`components/layout/sidebar.tsx`), 1H. Header (`components/layout/header.tsx`) (+25 more)

### Community 6 - "CRM Architecture Redesign"
Cohesion: 0.06
Nodes (33): 12 routes total (down from 51), 4 models total (down from 12), 4 services total (down from 12), 6 pages total (down from 14), API Routes, Approach: Clean rebuild with data migration, Auth (unchanged), Contact (replaces Lead + Client) (+25 more)

### Community 7 - "api-handler.ts"
Cohesion: 0.13
Nodes (17): POST, GET, createSchema, PATCH, POST, slugSchema, updateSchema, actionSchema (+9 more)

### Community 8 - "fixtures.ts"
Cohesion: 0.07
Nodes (31): TEST_USER, BASE_URL, E2E_PORT, expectToastError(), expectToastSuccess(), fillContactForm(), fillProjectForm(), fillTaskForm() (+23 more)

### Community 10 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, tailwind.config.js, **/*.ts (+19 more)

### Community 11 - "ClientsService"
Cohesion: 0.13
Nodes (12): DELETE, GET, PUT, GET, POST, ClientFilters, ClientsService, ConvertOverrides (+4 more)

### Community 12 - "contacts.service.ts"
Cohesion: 0.13
Nodes (14): DELETE, GET, PUT, GET, POST, ContactFilters, ContactsService, CreateContactInput (+6 more)

### Community 13 - "enums.ts"
Cohesion: 0.21
Nodes (12): ClientDecision, RequestBilling, RequestPriority, RequestSource, RequestStatus, RequestType, clientDecision, priority (+4 more)

### Community 14 - "support-conversation.service.ts"
Cohesion: 0.09
Nodes (24): identity(), PendingDraft, pendingDraftSchema, pendingMediaSchema, readHistory(), readPendingDraft(), readPendingMedia(), StoredDraft (+16 more)

### Community 15 - "CRM Public API Documentation"
Cohesion: 0.06
Nodes (30): Best Practices for Error Handling, Budget Validation, Changelog, Common Error Scenarios, CORS Configuration, Create Lead, CRM Public API Documentation, cURL Command (+22 more)

### Community 16 - "utils.ts"
Cohesion: 0.17
Nodes (9): navigation, Sidebar(), DialogFooter(), Label, labelVariants, PopoverContent, Progress, Separator (+1 more)

### Community 17 - "PhasesService"
Cohesion: 0.20
Nodes (10): DELETE, PUT, GET, POST, PhasesService, phaseStatus, CreatePhaseInput, createPhaseSchema (+2 more)

### Community 18 - "validations/request.ts"
Cohesion: 0.12
Nodes (15): DELETE, GET, PUT, GET, POST, BulkDraftRequestsInput, bulkDraftRequestsSchema, ClientDecisionInput (+7 more)

### Community 19 - "request-form.tsx"
Cohesion: 0.06
Nodes (61): Client, ClientForm(), ClientFormProps, clientFormSchema, ClientFormValues, ClientOption, Contact, ContactFormProps (+53 more)

### Community 21 - "tasks/[id]/route.ts"
Cohesion: 0.14
Nodes (10): DELETE, GET, PUT, GET, POST, TasksService, CreateTaskInput, createTaskSchema (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.18
Nodes (11): ai, @ai-sdk/gateway, bcryptjs, @itayost/il, dependencies, ai, @ai-sdk/gateway, bcryptjs (+3 more)

### Community 23 - "webhook/route.ts"
Cohesion: 0.16
Nodes (20): maxDuration, notifyClientOfProgress(), CHECKING_MESSAGE, CLIENT_ACK_MESSAGE, DegradedTurnNoticeParams, degradedTurnOwnerNotice(), FiledRequestNoticeParams, firstName() (+12 more)

### Community 24 - "מסמך דרישות מערכת CRM לפרילנסר"
Cohesion: 0.06
Nodes (31): 1. מודול ניהול לידים, 2. מודול ניהול לקוחות, 3. מודול ניהול פרויקטים, 4. מודול מעקב זמנים, 5. מודול תשלומים, 6. מערכת תעדוף חכמה (Priority Score), 7. דשבורד ראשי, 8. דוחות ותובנות (+23 more)

### Community 25 - "button.tsx"
Cohesion: 0.16
Nodes (20): isOverdue(), NextActionEditor(), toDateInputValue(), AwaitingClientCard(), daysWaiting(), CHARGEABLE, CommercialCard(), KINDS (+12 more)

### Community 26 - "WahaService"
Cohesion: 0.15
Nodes (14): phoneOf(), SendMessageParams, WahaService, withTyping(), botSessionName(), botTransport(), required(), transportFor() (+6 more)

### Community 27 - "morning-brief.service.ts"
Cohesion: 0.27
Nodes (11): DEGRADED_MAX_OUTPUT_TOKENS, DEGRADED_SYSTEM_PROMPT(), DEGRADED_TIMEOUT_MS, degradedSupportReply(), describeModelError(), isOllamaConfigured(), ollamaModel(), withModelFallback() (+3 more)

### Community 28 - "whatsapp-identity.ts"
Cohesion: 0.12
Nodes (22): POST(), isLeadSubmissionAuthorized(), timingSafeMatch(), isWebhookAuthorized(), personalSessionName(), ClientContact, findContactByExactPhone(), findContactByPhone() (+14 more)

### Community 30 - "header.tsx"
Cohesion: 0.16
Nodes (11): Header(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut() (+3 more)

### Community 31 - "CRM Architecture Redesign — Implementation Plan"
Cohesion: 0.06
Nodes (31): CRM Architecture Redesign — Implementation Plan, File Map, Files to CREATE, Files to DELETE, Files to MODIFY, Files to OVERWRITE, Files UNTOUCHED, Summary (+23 more)

### Community 33 - "components.json"
Cohesion: 0.15
Nodes (12): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+4 more)

### Community 34 - "devDependencies"
Cohesion: 0.15
Nodes (13): eslint, devDependencies, eslint, @playwright/test, tailwindcss-animate, @tailwindcss/postcss, @types/node, typescript (+5 more)

### Community 35 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, db:migrate, db:push, db:studio, dev, lint, postinstall (+5 more)

### Community 36 - "whatsapp-bot-webhook.test.ts"
Cohesion: 0.14
Nodes (9): afterTasks, agentMock, CLIENT_CONTACT, conversationMock, degradedMock, mediaMock, prismaMock, supportMock (+1 more)

### Community 37 - "prisma.ts"
Cohesion: 0.11
Nodes (21): maxDuration, globalForPrisma, prisma, CLIENT_REQUEST_STATUS_SENTENCES, ClientProfileService, GLOSSARY_HEADER, GlossaryEntry, sanitize() (+13 more)

### Community 38 - "projects/[id]/route.ts"
Cohesion: 0.15
Nodes (11): DELETE, GET, PUT, GET, POST, ProjectFilters, ProjectsService, CreateProjectInput (+3 more)

### Community 40 - "morning-brief-next-actions.test.ts"
Cohesion: 0.18
Nodes (3): generateText, prismaMock, Where

### Community 41 - "requests/[id]/page.tsx"
Cohesion: 0.07
Nodes (41): ActiveProject, DashboardData, PendingTask, STATE_EMPHASIS, AttachmentLinks(), IntakeDetails(), AiMark(), SOURCE_ICONS (+33 more)

### Community 42 - "createCrmTools"
Cohesion: 0.18
Nodes (17): DashboardService, fuzzyMatch(), fuzzyMatchClient(), fuzzyMatchContact(), fuzzyMatchProject(), fuzzyMatchRequest(), fuzzyMatchTask(), MatchResult (+9 more)

### Community 43 - "request-approval.test.ts"
Cohesion: 0.20
Nodes (6): BASE_REQUEST, PERSONAL_SOURCE, prismaMock, requests, SUPPORT_SOURCE, wahaMock

### Community 44 - "0002 — The support bot degrades, it does not die"
Cohesion: 0.40
Nodes (4): 0002 — The support bot degrades, it does not die, Consequences, Context, Decision

### Community 45 - "client-view.ts"
Cohesion: 0.10
Nodes (23): dynamic, dynamic, PortalRequestPage(), whatsappLink(), ProjectOption, Props, PublicRequestForm(), TYPES (+15 more)

### Community 46 - "resilient-model.test.ts"
Cohesion: 0.50
Nodes (3): CLIENT, createProviderSpy, generateTextSpy

### Community 47 - "support-followups.test.ts"
Cohesion: 0.25
Nodes (7): conversationRows, DRAFT, filingMock, NOW, prismaMock, seedConversation(), wahaMock

### Community 48 - "E2E Testing Design"
Cohesion: 0.09
Nodes (21): Architecture, Auth Flow, auth.spec.ts (3 tests), Cleanup Strategy, Configuration Notes, contacts.spec.ts (12 tests), dashboard.spec.ts (5 tests), Decisions (+13 more)

### Community 50 - "AgentConfigForm.tsx"
Cohesion: 0.11
Nodes (14): handler, registerSchema, AgentConfigForm(), DEFAULT_VALUES, FormBody(), FormValues, Props, toFormValues() (+6 more)

### Community 51 - "support-agent.service.ts"
Cohesion: 0.06
Nodes (41): IntakeContext, IntakeExtractionService, TurnAnalysis, turnAnalysisSchema, TurnRelation, AFFIRMATIONS, buildSystemPrompt(), isAffirmation() (+33 more)

### Community 52 - "product-cards.test.ts"
Cohesion: 0.25
Nodes (7): CONFIGURED, FULL_CONTENTS, FULL_TREE, GenArgs, generateTextSpy, githubMock, prismaMock

### Community 53 - "requests.service.ts"
Cohesion: 0.19
Nodes (14): AnnouncedStatus, CLIENT_ANNOUNCED_STATUSES, clientBotChat(), isAnnounced(), isLiveTask(), notifyClientOfApproval(), notifyClientOfQuote(), notifyOwnerOfDecision() (+6 more)

### Community 54 - "WhatsApp CRM Agent"
Cohesion: 0.09
Nodes (21): Agent System Prompt, Agent Tools (13 total), Architecture, Contacts (4 tools), Data Model, Dependencies to Install, Dual-Number Setup, Environment Variables (+13 more)

### Community 55 - "request-extraction.test.ts"
Cohesion: 0.33
Nodes (4): generateObjectSpy, MESSAGES, prismaMock, requestsServiceMock

### Community 56 - "support-repo-tools.test.ts"
Cohesion: 0.33
Nodes (4): context, githubMock, prismaMock, PROJECTS

### Community 57 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 60 - "Task System Upgrade"
Cohesion: 0.11
Nodes (18): Add `category` field to Task, API Changes, Category display in task list, Category filter tabs, Dashboard Changes, Data Model, Files to Modify, GET /api/tasks (+10 more)

### Community 61 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 62 - "E2E Testing Implementation Plan"
Cohesion: 0.11
Nodes (17): E2E Testing Implementation Plan, File Map, Files to CREATE, Files to MODIFY, Summary, Task 10: Projects Tests, Task 11: Tasks Tests, Task 12: Run Full Suite and Verify (+9 more)

### Community 63 - "approval-paths.test.ts"
Cohesion: 0.40
Nodes (3): fuzzyMock, params, requestsServiceMock

### Community 64 - "phases.test.ts"
Cohesion: 0.40
Nodes (3): OWNED_PROJECT, PHASE, prismaMock

### Community 65 - "support-media.test.ts"
Cohesion: 0.40
Nodes (4): storageMock, understandingMock, VOICE_NOTE, wahaMock

### Community 67 - "Customer Issue/Bug Form — Design"
Cohesion: 0.11
Nodes (17): Components, Context, Customer Issue/Bug Form — Design, Dashboard integration, Data flow, Decisions, `GET /api/requests/[id]/attachment?path=...` (authenticated, owner-only), Goal (+9 more)

### Community 69 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 72 - "react"
Cohesion: 0.67
Nodes (3): useFormField(), react, react

### Community 73 - "WhatsApp CRM Agent — Implementation Plan"
Cohesion: 0.12
Nodes (15): File Map, Files to CREATE, Files to MODIFY, Post-Implementation Setup, Summary, Task 1: Update Prisma Schema, Task 2: Install Dependencies, Task 3: Fuzzy Name Matching Utility (+7 more)

### Community 75 - "next.config.ts"
Cohesion: 0.50
Nodes (3): nextConfig, portalHeaders, securityHeaders

### Community 82 - ".sendMessage"
Cohesion: 0.21
Nodes (9): GET(), degradedTurn(), handleClientMessage(), handleOwnerMessage(), handleUnknownSender(), POST(), runSupportTurn(), notifyPossiblyMissedRequest() (+1 more)

### Community 83 - "Remove Time Tracking Feature"
Cohesion: 0.12
Nodes (15): Context, Dashboard & Pages, Database Migration, Decision, Documentation Updates, Files to Delete (11 files), Files to Delete (Additional), Files to Modify (20 files) (+7 more)

### Community 85 - "Morning Brief"
Cohesion: 0.13
Nodes (14): Add `lastContactedAt` to Contact, AI Agent Prompt, Architecture, Cron Configuration, Cron Endpoint Security, Data Gathered for the Brief, Data Model, Files (+6 more)

### Community 86 - "actions.ts"
Cohesion: 0.60
Nodes (3): decideOnQuote(), DecisionPanel(), clientDecisionSchema

### Community 100 - "request-quote.test.ts"
Cohesion: 0.25
Nodes (4): phases, prismaMock, requests, wahaMock

### Community 110 - "Models"
Cohesion: 0.14
Nodes (13): Client — a business, Contact — a person, Data Codemap, Enums, Migrations, Models, Project, ProjectPhase — a billable stage (+5 more)

### Community 113 - "Remove Time Tracking Implementation Plan"
Cohesion: 0.14
Nodes (13): Remove Time Tracking Implementation Plan, Task 10: Update Prisma Schema and Migrate, Task 11: Update Documentation, Task 12: Build Verification (Final), Task 1: Delete Pure Time-Tracking Files, Task 2: Clean Up Zustand Store, Task 3: Update Navigation and Layout, Task 4: Update Dashboard Page (+5 more)

### Community 127 - "tailwind.config.js"
Cohesion: 0.50
Nodes (3): config, TONES, toneScale

### Community 136 - "types/contact.ts"
Cohesion: 0.25
Nodes (8): ClientProject, ContactListItem, ContactProject, ContactSource, ContactStatus, PhaseSummary, contactSource, contactStatus

### Community 137 - "🚀 מדריך פיתוח מלא - CRM System"
Cohesion: 0.17
Nodes (11): 6. API Development, 7. State Management, 🎉 Congratulations!, Final Tips:, Remember:, Step 6.1: Create API Utils, Step 6.2: Create API Client, Step 7.1: Create Zustand Store (+3 more)

### Community 138 - "📚 Additional Resources"
Cohesion: 0.17
Nodes (12): 📚 Additional Resources, Code Standards Checklist, ✅ DO:, Documentation, ❌ DON'T:, Environment Variables Template, Git Workflow, Helpful Links (+4 more)

### Community 139 - "Customer Issue/Bug Form Implementation Plan"
Cohesion: 0.18
Nodes (10): Customer Issue/Bug Form Implementation Plan, File Structure, Global Constraints, Manual setup (one-time, outside the automated tasks), Self-Review, Task 1: Schema changes + migration, Task 2: Client form-token endpoint + dashboard link UI, Task 3: Backend submit pipeline (validation, storage, service, public endpoint) (+2 more)

### Community 140 - "request-extraction.service.ts"
Cohesion: 0.29
Nodes (6): ExtractedRequest, ExtractionResult, ExtractionStats, MAX_MESSAGES_PER_CLIENT, MIN_CONFIDENCE, DraftRequestInput

### Community 142 - "alert.tsx"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 143 - "avatar.tsx"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 144 - "Phase 2: Core Modules (שבועות 3-5)"
Cohesion: 0.20
Nodes (10): Phase 2: Core Modules (שבועות 3-5), יום 15-17: Leads Module, יום 18-21: Clients Module, יום 22-24: Projects Base, יום 25-28: Tasks & Subtasks, יום 29-31: Timer Implementation, יום 32-35: Time Reports, שבוע 3: ניהול לידים ולקוחות (+2 more)

### Community 145 - "Glossary"
Cohesion: 0.20
Nodes (9): Context, Glossary, הערות (Client.notes), כרטיס מוצר (ProductCard), ליד (Lead), מוצר (Product), מילון (Glossary), פנייה (Request) (+1 more)

### Community 146 - "Dependencies Codemap"
Cohesion: 0.20
Nodes (9): Auth, Core Framework, Data / Forms, Dependencies Codemap, Dev / Testing, E2E Test Coverage, External Services, State (installed, minimal use in redesign) (+1 more)

### Community 147 - "תוכנית פיתוח מפורטת - מערכת CRM"
Cohesion: 0.22
Nodes (8): Daily Development, Deployment, 💻 Development Commands, MVP Requirements (Must Have), Nice to Have (Phase 2), 🎯 Success Criteria, 📅 לוח זמנים כללי, תוכנית פיתוח מפורטת - מערכת CRM

### Community 148 - "badge.tsx"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 149 - "Common Issues and Solutions"
Cohesion: 0.25
Nodes (8): 10. Troubleshooting, Common Issues and Solutions, Debugging Tips, Issue: Authentication not working, Issue: Database connection failed, Issue: Prisma Client not generated, Issue: RTL layout issues, Issue: WhatsApp not sending

### Community 150 - "1. Initial Setup"
Cohesion: 0.25
Nodes (8): 1. Initial Setup, Step 1.1: Create Next.js Project, Step 1.2: Install Dependencies, Step 1.3: Setup shadcn/ui, Step 1.4: Project Structure Setup, Step 1.5: Environment Variables, Step 1.6: Configure Tailwind for RTL, Step 1.7: Global Styles with RTL

### Community 151 - "שבוע 1: Setup והגדרות"
Cohesion: 0.25
Nodes (8): Phase 1: תשתית בסיסית (שבועות 1-2), יום 11-14: Shared Components, יום 1-2: הקמת הפרויקט, יום 3-4: Database Schema, יום 5-7: Authentication, יום 8-10: Layout Components, שבוע 1: Setup והגדרות, שבוע 2: UI Foundation

### Community 152 - "Backend Codemap"
Cohesion: 0.25
Nodes (7): API Routes, Auth Wrappers (two variants), Backend Codemap, Business Rules (enforced in services), Middleware Chain, Services, Validations

### Community 153 - "5. Core Features Development"
Cohesion: 0.29
Nodes (7): 5. Core Features Development, Step 5.1: Dashboard Page, Step 5.2: Leads API, Step 5.3: Leads Page, Step 5.4: Lead Form Component, Step 5.5: Projects API, Step 5.6: Time Tracking Components

### Community 154 - "Phase 3: תשלומים ודוחות (שבועות 6-7)"
Cohesion: 0.29
Nodes (7): Phase 3: תשלומים ודוחות (שבועות 6-7), יום 36-38: Project Payments, יום 39-42: Recurring Payments, יום 43-45: Dashboard & KPIs, יום 46-49: Reports Module, שבוע 6: מודול תשלומים, שבוע 7: דוחות וניתוחים

### Community 155 - "2. Database Setup"
Cohesion: 0.33
Nodes (6): 2. Database Setup, Step 2.1: Initialize Prisma, Step 2.2: Create Schema, Step 2.3: Setup Supabase, Step 2.4: Run Migrations, Step 2.5: Create Seed File

### Community 156 - "0001 — Product knowledge is precomputed cards, not live retrieval"
Cohesion: 0.33
Nodes (5): 0001 — Product knowledge is precomputed cards, not live retrieval, Amendment — cards v2 (2026-08-01), Consequences, Context, Decision

### Community 157 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 158 - "Issue tracker: GitHub"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 159 - "Frontend Codemap"
Cohesion: 0.33
Nodes (5): Component Hierarchy, Frontend Codemap, Page Tree, RTL/Hebrew, State Management

### Community 160 - "3. Authentication Implementation"
Cohesion: 0.40
Nodes (5): 3. Authentication Implementation, Step 3.1: Create Auth Configuration, Step 3.2: Create Auth Route, Step 3.3: Create Login Page, Step 3.4: Create Middleware

### Community 161 - "9. Deployment"
Cohesion: 0.40
Nodes (5): 9. Deployment, Step 9.1: Prepare for Production, Step 9.2: Deploy to Vercel, Step 9.3: Configure Environment Variables in Vercel, Step 9.4: Setup Cron Jobs

### Community 162 - "Architecture Codemap"
Cohesion: 0.40
Nodes (4): Architecture Codemap, Data Flow, Key Boundaries, System Diagram

### Community 163 - "projects/[id]/page.tsx"
Cohesion: 0.12
Nodes (44): ClientContact, ClientDetail, ClientDetailPage(), ClientRequest, ContactDetailPage(), ContactsPage(), isOverdue(), DashboardPage() (+36 more)

### Community 164 - "4. Layout & Navigation"
Cohesion: 0.50
Nodes (4): 4. Layout & Navigation, Step 4.1: Create Dashboard Layout, Step 4.2: Create Sidebar Component, Step 4.3: Create Header Component

### Community 165 - "📝 Code Standards"
Cohesion: 0.50
Nodes (4): 📝 Code Standards, Code Structure, File Naming, Git Commits

### Community 166 - "🚀 Development Checklist"
Cohesion: 0.50
Nodes (4): 🚀 Development Checklist, Development Environment, Pre-Development, Weekly Milestones

### Community 167 - "🎉 Launch Checklist"
Cohesion: 0.50
Nodes (4): 🎉 Launch Checklist, Launch Day, Post-Launch, Pre-Launch

### Community 168 - "Potential Risks & Mitigations"
Cohesion: 0.50
Nodes (4): Potential Risks & Mitigations, 📊 Risk Management, Technical Risks, Timeline Risks

### Community 170 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 171 - "8. WhatsApp Integration"
Cohesion: 0.67
Nodes (3): 8. WhatsApp Integration, Step 8.1: WhatsApp Service, Step 8.2: Webhook for Lead

### Community 172 - "📚 Documentation Requirements"
Cohesion: 0.67
Nodes (3): 📚 Documentation Requirements, Technical Documentation, User Documentation

### Community 173 - "🔍 Quality Assurance"
Cohesion: 0.67
Nodes (3): Performance Targets, 🔍 Quality Assurance, Testing Checklist

### Community 174 - "Phase 4: אינטגרציות ואוטומציות (שבוע 8)"
Cohesion: 0.67
Nodes (3): Phase 4: אינטגרציות ואוטומציות (שבוע 8), יום 50-52: WhatsApp Integration, יום 53-56: Automations & Webhooks

### Community 175 - "Phase 5: Testing & Deployment (שבוע 9)"
Cohesion: 0.67
Nodes (3): Phase 5: Testing & Deployment (שבוע 9), יום 57-59: Testing, יום 60-63: Deployment & Polish

### Community 176 - "public-leads.test.ts"
Cohesion: 0.29
Nodes (4): agentMock, LEAD, prismaMock, wahaMock

### Community 180 - "leads/route.ts"
Cohesion: 0.11
Nodes (21): Caller, callerOf(), notifyOwnerOfNewLead(), POST(), publicLeadSchema, appendSubmission(), budgetOf(), DUPLICATE_WINDOW_MS (+13 more)

## Knowledge Gaps
- **934 isolated node(s):** `TYPE_LABELS`, `PublicRequestSubmit`, `ResolvedClient`, `ClientOption`, `KINDS` (+929 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **67 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `fixtures.ts`, `axios`, `react-hot-toast`, `tailwind-merge`, `@ai-sdk/openai-compatible`, `@auth/prisma-adapter`, `@itayost/wa`, `@radix-ui/react-avatar`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `react-dom`, `zod`, `package.json`, `react`, `class-variance-authority`, `clsx`, `date-fns`, `@hookform/resolvers`, `lucide-react`, `next`, `next-auth`, `next-themes`, `prisma`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `react-hook-form`, `sonner`, `@supabase/supabase-js`, `zustand`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `useFormField()` connect `react` to `request-form.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `dependencies`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `TYPE_LABELS`, `PublicRequestSubmit`, `ResolvedClient` to the rest of the system?**
  _934 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `product-card.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06219426974143955 - nodes in this community are weakly interconnected._
- **Should `support-media.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08416389811738649 - nodes in this community are weakly interconnected._
- **Should `requests/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11884057971014493 - nodes in this community are weakly interconnected._