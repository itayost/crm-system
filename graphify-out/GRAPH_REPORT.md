# Graph Report - .  (2026-08-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1224 nodes · 2748 edges · 136 communities (75 shown, 61 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd652849`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 130
- Community 131

## God Nodes (most connected - your core abstractions)
1. `prisma` - 35 edges
2. `label()` - 35 edges
3. `Tone` - 33 edges
4. `cn()` - 30 edges
5. `Button` - 28 edges
6. `createCrmTools()` - 28 edges
7. `WahaService` - 25 edges
8. `SupportConversationService` - 23 edges
9. `api` - 22 edges
10. `Badge()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `DialogFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dialog.tsx → lib/utils.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts
- `ClientProject` --references--> `PhaseSummary`  [EXTRACTED]
  app/(dashboard)/clients/[id]/page.tsx → lib/types/project.ts
- `TasksPage()` --calls--> `Tone`  [EXTRACTED]
  app/(dashboard)/tasks/page.tsx → lib/design/tones.ts
- `GET()` --calls--> `isCronAuthorized()`  [EXTRACTED]
  app/api/cron/morning-brief/route.ts → lib/api/cron-auth.ts

## Import Cycles
- None detected.

## Communities (136 total, 61 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (26): GET(), GET(), maxDuration, GET(), isCronAuthorized(), safeEqual(), GitHubService, isSafeRepoPath() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (29): POST(), TYPE_LABELS, MediaKind, MediaUnderstandingService, PROMPTS, TranscriptionResult, PublicRequestsService, PublicRequestSubmit (+21 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (29): Client, isOverdue(), STATUS_FILTER_OPTIONS, ClientOption, CATEGORY_FILTER_TABS, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_FILTER_OPTIONS (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (23): SELECTABLE, AttachmentLinks(), IntakeDetails(), AiBadge(), RequestListItem, Badge(), BadgeProps, badgeVariants (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (30): ClientDetailPage(), ContactDetailPage(), ContactsPage(), DashboardPage(), ProjectDetailPage(), ProjectsPageContent(), RequestDetailPage(), RequestsPage() (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (25): ClientContact, ClientDetail, ClientRequest, TASK_STATUS_LABELS, ClientProfileCard(), isOverdue(), NextActionEditor(), toDateInputValue() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): ExtractedRequest, ExtractionResult, ExtractionStats, MAX_MESSAGES_PER_CLIENT, MIN_CONFIDENCE, AnnouncedStatus, CLIENT_ANNOUNCED_STATUSES, clientBotChat() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (17): POST, actionSchema, POST, GET, DELETE, GET, PUT, GET (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (18): TEST_USER, BASE_URL, E2E_PORT, expectToastError(), expectToastSuccess(), fillContactForm(), fillProjectForm(), fillTaskForm() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (23): IntakeContext, TurnAnalysis, turnAnalysisSchema, TurnRelation, SystemPromptParams, RequestPriority, RequestSource, RequestStatus (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, tailwind.config.js, **/*.ts (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (12): DELETE, GET, PUT, GET, POST, ClientFilters, ClientsService, ConvertOverrides (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (17): DELETE, GET, PUT, GET, POST, GET, ContactFilters, DashboardService (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (16): IntakeExtractionService, AFFIRMATIONS, buildSystemPrompt(), isAffirmation(), openStatuses(), PROJECT_TYPE_LABELS, recentClientRequests(), relationLine() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (13): identity(), pendingDraftSchema, pendingMediaSchema, readHistory(), readPendingDraft(), readPendingMedia(), StoredDraft, SupportConversationService (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (16): handler, registerSchema, createSchema, PATCH, POST, slugSchema, updateSchema, authOptions (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (10): ButtonProps, buttonVariants, CardDescription, EmptyStateProps, Label, labelVariants, PopoverContent, Progress (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (9): DELETE, PUT, GET, POST, PhasesService, CreatePhaseInput, createPhaseSchema, UpdatePhaseInput (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (11): DELETE, GET, PUT, GET, POST, ProjectFilters, ProjectsService, CreateProjectInput (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (15): Client, ClientForm(), ClientFormProps, clientFormSchema, ClientFormValues, ClientOption, Contact, ContactFormProps (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (10): GET(), notifyOwner(), degradedTurn(), handleClientMessage(), handleOwnerMessage(), handleUnknownSender(), POST(), runSupportTurn() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (11): DELETE, GET, PUT, GET, POST, TaskFilters, TasksService, CreateTaskInput (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (17): ai, @ai-sdk/openai-compatible, @auth/prisma-adapter, dependencies, ai, @ai-sdk/openai-compatible, @auth/prisma-adapter, @radix-ui/react-avatar (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.19
Nodes (15): maxDuration, CHECKING_MESSAGE, CLIENT_ACK_MESSAGE, DegradedTurnNoticeParams, degradedTurnOwnerNotice(), FiledRequestNoticeParams, firstName(), greetingMessage() (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (12): Header(), navigation, Sidebar(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (15): CATEGORY_OPTIONS, PRIORITY_OPTIONS, ProjectOption, Task, TaskForm(), TaskFormProps, taskFormSchema, TaskFormValues (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (12): POST(), isWebhookAuthorized(), safeEqual(), personalSessionName(), SendMessageParams, findContactByPhone(), MESSAGE_EVENTS, parseWahaMessageEvent() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (9): AgentConfigForm(), DEFAULT_VALUES, FormValues, Props, toFormValues(), AgentConfigPage(), PageProps, getCurrentUser() (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (9): ContactsService, fuzzyMatch(), fuzzyMatchClient(), fuzzyMatchContact(), fuzzyMatchProject(), fuzzyMatchRequest(), fuzzyMatchTask(), MatchResult (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (11): agentMock, CompoundWhere, conversations, extractMock, GenerateTextArgs, generateTextSpy, githubMock, input (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.16
Nodes (12): ClientProject, ContactListItem, ContactProject, ContactSource, ContactStatus, PhaseStatus, PhaseSummary, ProjectListItem (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (12): IntakeEditForm(), IntakeFormValues, toFormValues(), toIntake(), FormControl, FormDescription, FormField(), FormFieldContext (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.26
Nodes (3): readCapped(), WahaService, withTyping()

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (12): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (13): eslint, devDependencies, eslint, @playwright/test, tailwindcss-animate, @tailwindcss/postcss, @types/node, typescript (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (13): scripts, build, db:migrate, db:push, db:studio, dev, lint, postinstall (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (8): afterTasks, agentMock, CLIENT_CONTACT, conversationMock, mediaMock, prismaMock, supportMock, wahaMock

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (10): PendingDraft, CLIENT_STATUS_LABELS, CLIENT_VISIBLE_STATUSES, clientProjects(), createSupportTools(), resolveProjectId(), sameSummary(), similarity() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.24
Nodes (7): FILE_ANYWAY_HOURS, FIRST_REMINDER_HOURS, SECOND_REMINDER_HOURS, SupportFollowupsService, SweepStats, firstConfirmationReminder(), secondConfirmationReminder()

### Community 39 - "Community 39"
Cohesion: 0.31
Nodes (10): ClientContact, findContactByExactPhone(), IdentifiedContact, identifySender(), IdentifySenderParams, isOwnerPhone(), MatchedContact, normalizePhone() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (3): generateText, prismaMock, Where

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (9): ClientOption, ContactOption, FREQUENCY_OPTIONS, PRIORITY_OPTIONS, Project, ProjectFormProps, projectFormSchema, ProjectFormValues (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (8): PhaseForm(), phaseFormSchema, PhaseFormValues, DialogContent, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (6): BASE_REQUEST, PERSONAL_SOURCE, prismaMock, requests, SUPPORT_SOURCE, wahaMock

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): Option, PRIORITY_OPTIONS, RequestFormProps, RequestFormRecord, requestFormSchema, RequestFormValues, TYPE_OPTIONS, DialogDescription

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (7): DEGRADED_MAX_OUTPUT_TOKENS, DEGRADED_SYSTEM_PROMPT(), DEGRADED_TIMEOUT_MS, degradedSupportReply(), describeModelError(), isOllamaConfigured(), ollamaModel()

### Community 46 - "Community 46"
Cohesion: 0.28
Nodes (8): mapLeadStatus(), mapTaskStatus(), migrate(), OldClient, OldLead, OldProject, OldTask, prisma

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (7): conversationRows, DRAFT, filingMock, NOW, prismaMock, seedConversation(), wahaMock

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (7): ActiveProject, CATEGORY_LABELS, DashboardData, PendingTask, PROJECT_STATUS_LABELS, PROJECT_STATUS_TONES, TASK_CATEGORY_TONES

### Community 49 - "Community 49"
Cohesion: 0.29
Nodes (5): dynamic, ProjectOption, Props, PublicRequestForm(), TYPES

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (5): ClientProfileService, GLOSSARY_HEADER, GlossaryEntry, sanitize(), splitGlossary()

### Community 51 - "Community 51"
Cohesion: 0.32
Nodes (5): RepoRef, ConfiguredProject, configuredProjects(), createRepoTools(), degraded()

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (7): CONFIGURED, FULL_CONTENTS, FULL_TREE, GenArgs, generateTextSpy, githubMock, prismaMock

### Community 53 - "Community 53"
Cohesion: 0.38
Nodes (6): botSessionName(), archiveBotMessage(), ArchiveBotMessageParams, ArchivedMessage, isUniqueViolation(), releaseArchivedMessage()

### Community 54 - "Community 54"
Cohesion: 0.40
Nodes (4): LeadData, notifyOwnerOfNewLead(), POST(), publicLeadSchema

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (4): generateObjectSpy, MESSAGES, prismaMock, requestsServiceMock

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (4): context, githubMock, prismaMock, PROJECTS

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (4): globalTeardown(), prisma, @prisma/client, @prisma/client

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 62 - "Community 62"
Cohesion: 0.60
Nodes (4): SupportConversationContext, FilingContext, notifyOwner(), filedRequestOwnerNotice()

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (3): fuzzyMock, params, requestsServiceMock

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (3): OWNED_PROJECT, PHASE, prismaMock

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (4): storageMock, understandingMock, VOICE_NOTE, wahaMock

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (3): useFormField(), react, react

## Knowledge Gaps
- **431 isolated node(s):** `supabase`, `ClientRequest`, `ClientContact`, `ClientDetail`, `Client` (+426 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **61 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 22` to `Community 60`, `Community 69`, `Community 72`, `Community 82`, `Community 85`, `Community 86`, `Community 87`, `Community 88`, `Community 89`, `Community 93`, `Community 94`, `Community 96`, `Community 97`, `Community 98`, `Community 99`, `Community 100`, `Community 101`, `Community 102`, `Community 103`, `Community 104`, `Community 105`, `Community 106`, `Community 107`, `Community 108`, `Community 109`, `Community 110`, `Community 111`, `Community 112`, `Community 113`, `Community 114`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Why does `useFormField()` connect `Community 72` to `Community 31`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `react` connect `Community 72` to `Community 22`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **What connects `supabase`, `ClientRequest`, `ClientContact` to the rest of the system?**
  _431 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07246376811594203 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0824524312896406 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._