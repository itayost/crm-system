# Graph Report - crm-system  (2026-08-01)

## Corpus Check
- 250 files · ~167,935 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1265 nodes · 2767 edges · 134 communities (70 shown, 64 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b0626cd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- product-card.service.ts
- support-media.service.ts
- projects/[id]/page.tsx
- CLAUDE.md
- project-money.ts
- enums.ts
- RequestsService
- api-handler.ts
- fixtures.ts
- intake-edit-form.tsx
- compilerOptions
- ClientsService
- contacts.service.ts
- support-agent.service.ts
- support-conversation.service.ts
- public/requests/route.ts
- cn
- PhasesService
- createCrmTools
- contact-form.tsx
- prisma.ts
- tasks/[id]/route.ts
- dependencies
- webhook/route.ts
- header.tsx
- task-form.tsx
- waha.service.ts
- AgentConfigForm.tsx
- request-extraction.service.ts
- support-agent.test.ts
- types/project.ts
- request-form.tsx
- WahaService
- components.json
- devDependencies
- scripts
- whatsapp-bot-webhook.test.ts
- support-tools.ts
- support-followups.service.ts
- whatsapp-identity.ts
- morning-brief-next-actions.test.ts
- project-form.tsx
- select.tsx
- request-approval.test.ts
- 0002 — The support bot degrades, it does not die
- morning-brief/route.ts
- resilient-model.test.ts
- support-followups.test.ts
- @ai-sdk/openai-compatible
- [token]/page.tsx
- client-profile.service.ts
- support-repo-tools.ts
- product-cards.test.ts
- whatsapp-archive.ts
- @radix-ui/react-avatar
- request-extraction.test.ts
- support-repo-tools.test.ts
- next-auth.d.ts
- app/layout.tsx
- alert.tsx
- @radix-ui/react-switch
- eslint.config.mjs
- @radix-ui/react-tabs
- approval-paths.test.ts
- phases.test.ts
- support-media.test.ts
- whatsapp-index-webhook.test.ts
- react-dom
- breadcrumb.tsx
- package.json
- client-profile.test.ts
- react
- sonner.tsx
- middleware.ts
- next.config.ts
- app-store.ts
- contact-pipeline.test.ts
- contacts-scoping.test.ts
- cron-support-followups.test.ts
- github-service.test.ts
- media-understanding.test.ts
- @ai-sdk/gateway
- autoprefixer
- zod
- bcryptjs
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
- @radix-ui/react-alert-dialog
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slot
- react-hook-form
- sonner
- @supabase/supabase-js
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

## God Nodes (most connected - your core abstractions)
1. `prisma` - 35 edges
2. `label()` - 34 edges
3. `Tone` - 33 edges
4. `cn()` - 30 edges
5. `Button` - 28 edges
6. `createCrmTools()` - 28 edges
7. `WahaService` - 25 edges
8. `SupportConversationService` - 23 edges
9. `api` - 22 edges
10. `Badge()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts
- `runSupportTurn()` --calls--> `describeModelError()`  [EXTRACTED]
  app/api/whatsapp/webhook/route.ts → lib/ai/resilient-model.ts
- `degradedTurn()` --calls--> `degradedSupportReply()`  [EXTRACTED]
  app/api/whatsapp/webhook/route.ts → lib/ai/resilient-model.ts
- `globalTeardown()` --references--> `@prisma/client`  [EXTRACTED]
  e2e/global-teardown.ts → package.json
- `ClientProject` --references--> `PhaseSummary`  [EXTRACTED]
  app/(dashboard)/clients/[id]/page.tsx → lib/types/project.ts

## Import Cycles
- None detected.

## Communities (134 total, 64 thin omitted)

### Community 0 - "product-card.service.ts"
Cohesion: 0.09
Nodes (20): GET(), GitHubService, isSafeRepoPath(), MAX_FILE_CHARS, MAX_ROUTE_FILES, MAX_SEARCH_RESULTS, MAX_TREE_ENTRIES, RepoResult (+12 more)

### Community 1 - "support-media.service.ts"
Cohesion: 0.13
Nodes (21): MediaKind, MediaUnderstandingService, PROMPTS, TranscriptionResult, ALLOWED_MIME, ALLOWED_SUPPORT_MEDIA_MIME, ATTACHMENT_MAX_BYTES, baseMimeType() (+13 more)

### Community 2 - "projects/[id]/page.tsx"
Cohesion: 0.06
Nodes (114): ClientContact, ClientDetail, ClientDetailPage(), ClientRequest, Client, ContactDetailPage(), ContactsPage(), isOverdue() (+106 more)

### Community 3 - "CLAUDE.md"
Cohesion: 0.07
Nodes (28): Agent skills, API Route Pattern, Architecture, Authentication, Business Context, Code Patterns to Follow, Codebase Metrics, Contact (+20 more)

### Community 4 - "project-money.ts"
Cohesion: 0.25
Nodes (8): amount(), DecimalLike, Money, PhaseAmount, projectOutstanding(), projectPaid(), sum(), PHASES

### Community 5 - "enums.ts"
Cohesion: 0.13
Nodes (17): DELETE, GET, PUT, GET, POST, RequestPriority, RequestSource, RequestStatus (+9 more)

### Community 6 - "RequestsService"
Cohesion: 0.18
Nodes (6): isAnnounced(), RequestsService, taskDescription(), BulkDraftRequestsInput, CreateRequestInput, UpdateRequestInput

### Community 7 - "api-handler.ts"
Cohesion: 0.10
Nodes (23): POST, GET, createSchema, PATCH, POST, slugSchema, updateSchema, DELETE (+15 more)

### Community 8 - "fixtures.ts"
Cohesion: 0.07
Nodes (30): TEST_USER, BASE_URL, E2E_PORT, expectToastError(), expectToastSuccess(), fillContactForm(), fillProjectForm(), fillTaskForm() (+22 more)

### Community 9 - "intake-edit-form.tsx"
Cohesion: 0.15
Nodes (17): IntakeEditForm(), IntakeFormValues, toFormValues(), toIntake(), IntakeContext, TurnAnalysis, turnAnalysisSchema, EMPTY_INTAKE (+9 more)

### Community 10 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, tailwind.config.js, **/*.ts (+19 more)

### Community 11 - "ClientsService"
Cohesion: 0.13
Nodes (12): DELETE, GET, PUT, GET, POST, ClientFilters, ClientsService, ConvertOverrides (+4 more)

### Community 12 - "contacts.service.ts"
Cohesion: 0.13
Nodes (13): DELETE, GET, PUT, GET, POST, ContactFilters, ContactsService, CreateContactInput (+5 more)

### Community 13 - "support-agent.service.ts"
Cohesion: 0.19
Nodes (16): IntakeExtractionService, TurnRelation, AFFIRMATIONS, buildSystemPrompt(), isAffirmation(), openStatuses(), PROJECT_TYPE_LABELS, recentClientRequests() (+8 more)

### Community 14 - "support-conversation.service.ts"
Cohesion: 0.12
Nodes (13): identity(), pendingDraftSchema, pendingMediaSchema, readHistory(), readPendingDraft(), readPendingMedia(), StoredDraft, SupportConversationService (+5 more)

### Community 15 - "public/requests/route.ts"
Cohesion: 0.20
Nodes (8): POST(), TYPE_LABELS, PublicRequestsService, PublicRequestSubmit, ResolvedClient, SubmitResult, PublicRequestInput, publicRequestSchema

### Community 16 - "cn"
Cohesion: 0.15
Nodes (10): Avatar, AvatarFallback, AvatarImage, DialogFooter(), DialogHeader(), DialogOverlay, PopoverContent, Progress (+2 more)

### Community 17 - "PhasesService"
Cohesion: 0.20
Nodes (10): DELETE, PUT, GET, POST, PhasesService, phaseStatus, CreatePhaseInput, createPhaseSchema (+2 more)

### Community 18 - "createCrmTools"
Cohesion: 0.17
Nodes (14): DashboardService, fuzzyMatch(), fuzzyMatchClient(), fuzzyMatchContact(), fuzzyMatchProject(), fuzzyMatchRequest(), fuzzyMatchTask(), MatchResult (+6 more)

### Community 19 - "contact-form.tsx"
Cohesion: 0.15
Nodes (15): Client, ClientForm(), ClientFormProps, clientFormSchema, ClientFormValues, ClientOption, Contact, ContactFormProps (+7 more)

### Community 20 - "prisma.ts"
Cohesion: 0.11
Nodes (16): maxDuration, LeadData, notifyOwnerOfNewLead(), POST(), publicLeadSchema, notifyOwner(), globalForPrisma, prisma (+8 more)

### Community 21 - "tasks/[id]/route.ts"
Cohesion: 0.14
Nodes (10): DELETE, GET, PUT, GET, POST, TasksService, CreateTaskInput, createTaskSchema (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.18
Nodes (11): ai, @auth/prisma-adapter, axios, dependencies, ai, @auth/prisma-adapter, axios, react-hot-toast (+3 more)

### Community 23 - "webhook/route.ts"
Cohesion: 0.11
Nodes (31): degradedTurn(), handleClientMessage(), handleOwnerMessage(), handleUnknownSender(), maxDuration, POST(), runSupportTurn(), AnnouncedStatus (+23 more)

### Community 24 - "header.tsx"
Cohesion: 0.16
Nodes (12): Header(), navigation, Sidebar(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem (+4 more)

### Community 25 - "task-form.tsx"
Cohesion: 0.20
Nodes (9): CATEGORY_OPTIONS, PRIORITY_OPTIONS, ProjectOption, Task, TaskForm(), TaskFormProps, taskFormSchema, TaskFormValues (+1 more)

### Community 26 - "waha.service.ts"
Cohesion: 0.21
Nodes (11): POST(), isWebhookAuthorized(), safeEqual(), personalSessionName(), SendMessageParams, MESSAGE_EVENTS, parseWahaMessageEvent(), wahaEventSchema (+3 more)

### Community 27 - "AgentConfigForm.tsx"
Cohesion: 0.11
Nodes (13): handler, registerSchema, AgentConfigForm(), DEFAULT_VALUES, FormValues, Props, toFormValues(), AgentConfigPage() (+5 more)

### Community 28 - "request-extraction.service.ts"
Cohesion: 0.21
Nodes (7): ExtractedRequest, ExtractionResult, ExtractionStats, MAX_MESSAGES_PER_CLIENT, MIN_CONFIDENCE, RequestExtractionService, DraftRequestInput

### Community 29 - "support-agent.test.ts"
Cohesion: 0.12
Nodes (12): agentMock, CompoundWhere, conversations, extractMock, GenerateTextArgs, generateTextSpy, githubMock, input (+4 more)

### Community 30 - "types/project.ts"
Cohesion: 0.15
Nodes (13): ClientProject, ContactListItem, ContactProject, ContactSource, ContactStatus, PhaseStatus, PhaseSummary, ProjectListItem (+5 more)

### Community 31 - "request-form.tsx"
Cohesion: 0.11
Nodes (22): Option, PRIORITY_OPTIONS, RequestFormProps, RequestFormRecord, requestFormSchema, RequestFormValues, TYPE_OPTIONS, PhaseForm() (+14 more)

### Community 32 - "WahaService"
Cohesion: 0.25
Nodes (3): readCapped(), WahaService, withTyping()

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

### Community 37 - "support-tools.ts"
Cohesion: 0.30
Nodes (11): PendingDraft, CLIENT_STATUS_LABELS, CLIENT_VISIBLE_STATUSES, clientProjects(), createSupportTools(), resolveProjectId(), sameSummary(), similarity() (+3 more)

### Community 38 - "support-followups.service.ts"
Cohesion: 0.18
Nodes (11): GET(), GET(), isCronAuthorized(), safeEqual(), FILE_ANYWAY_HOURS, FIRST_REMINDER_HOURS, SECOND_REMINDER_HOURS, SupportFollowupsService (+3 more)

### Community 39 - "whatsapp-identity.ts"
Cohesion: 0.30
Nodes (11): ClientContact, findContactByExactPhone(), findContactByPhone(), IdentifiedContact, identifySender(), IdentifySenderParams, isOwnerPhone(), MatchedContact (+3 more)

### Community 40 - "morning-brief-next-actions.test.ts"
Cohesion: 0.18
Nodes (3): generateText, prismaMock, Where

### Community 41 - "project-form.tsx"
Cohesion: 0.20
Nodes (9): ClientOption, ContactOption, FREQUENCY_OPTIONS, PRIORITY_OPTIONS, Project, ProjectFormProps, projectFormSchema, ProjectFormValues (+1 more)

### Community 42 - "select.tsx"
Cohesion: 0.40
Nodes (4): SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator

### Community 43 - "request-approval.test.ts"
Cohesion: 0.20
Nodes (6): BASE_REQUEST, PERSONAL_SOURCE, prismaMock, requests, SUPPORT_SOURCE, wahaMock

### Community 44 - "0002 — The support bot degrades, it does not die"
Cohesion: 0.40
Nodes (4): 0002 — The support bot degrades, it does not die, Consequences, Context, Decision

### Community 45 - "morning-brief/route.ts"
Cohesion: 0.18
Nodes (13): GET(), maxDuration, DEGRADED_MAX_OUTPUT_TOKENS, DEGRADED_SYSTEM_PROMPT(), DEGRADED_TIMEOUT_MS, degradedSupportReply(), describeModelError(), isOllamaConfigured() (+5 more)

### Community 46 - "resilient-model.test.ts"
Cohesion: 0.50
Nodes (3): CLIENT, createProviderSpy, generateTextSpy

### Community 47 - "support-followups.test.ts"
Cohesion: 0.25
Nodes (7): conversationRows, DRAFT, filingMock, NOW, prismaMock, seedConversation(), wahaMock

### Community 49 - "[token]/page.tsx"
Cohesion: 0.29
Nodes (5): dynamic, ProjectOption, Props, PublicRequestForm(), TYPES

### Community 50 - "client-profile.service.ts"
Cohesion: 0.32
Nodes (5): ClientProfileService, GLOSSARY_HEADER, GlossaryEntry, sanitize(), splitGlossary()

### Community 51 - "support-repo-tools.ts"
Cohesion: 0.47
Nodes (4): RepoRef, ConfiguredProject, createRepoTools(), degraded()

### Community 52 - "product-cards.test.ts"
Cohesion: 0.25
Nodes (7): CONFIGURED, FULL_CONTENTS, FULL_TREE, GenArgs, generateTextSpy, githubMock, prismaMock

### Community 53 - "whatsapp-archive.ts"
Cohesion: 0.38
Nodes (6): botSessionName(), archiveBotMessage(), ArchiveBotMessageParams, ArchivedMessage, isUniqueViolation(), releaseArchivedMessage()

### Community 55 - "request-extraction.test.ts"
Cohesion: 0.33
Nodes (4): generateObjectSpy, MESSAGES, prismaMock, requestsServiceMock

### Community 56 - "support-repo-tools.test.ts"
Cohesion: 0.33
Nodes (4): context, githubMock, prismaMock, PROJECTS

### Community 57 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 59 - "alert.tsx"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 61 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 63 - "approval-paths.test.ts"
Cohesion: 0.40
Nodes (3): fuzzyMock, params, requestsServiceMock

### Community 64 - "phases.test.ts"
Cohesion: 0.40
Nodes (3): OWNED_PROJECT, PHASE, prismaMock

### Community 65 - "support-media.test.ts"
Cohesion: 0.40
Nodes (4): storageMock, understandingMock, VOICE_NOTE, wahaMock

### Community 69 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 72 - "react"
Cohesion: 0.67
Nodes (3): useFormField(), react, react

## Knowledge Gaps
- **464 isolated node(s):** `Development Commands`, `Project Overview`, `Business Context`, `Technology Stack`, `User` (+459 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `fixtures.ts`, `@ai-sdk/openai-compatible`, `@radix-ui/react-avatar`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `react-dom`, `package.json`, `react`, `@ai-sdk/gateway`, `zod`, `bcryptjs`, `class-variance-authority`, `clsx`, `date-fns`, `@hookform/resolvers`, `lucide-react`, `next`, `next-auth`, `next-themes`, `prisma`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `react-hook-form`, `sonner`, `@supabase/supabase-js`, `zustand`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Why does `useFormField()` connect `react` to `request-form.tsx`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `dependencies`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `Development Commands`, `Project Overview`, `Business Context` to the rest of the system?**
  _464 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `product-card.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0928030303030303 - nodes in this community are weakly interconnected._
- **Should `support-media.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1330049261083744 - nodes in this community are weakly interconnected._
- **Should `projects/[id]/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05680770842061165 - nodes in this community are weakly interconnected._