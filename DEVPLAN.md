# CRM UX Improvement Plan

> **Created**: February 2025
> **Approach**: Phased — fix broken things first, then deep improvements
> **Focus**: Desktop UI (WhatsApp agent for mobile access later)

---

## Phase 1: Fix All Broken Functionality ✅

**Goal**: Make every existing button, link, and action in the UI actually work. Add basic data quality guards.
**Status**: COMPLETE — all items implemented and verified (build passes clean).

### 1A. Form Component Prerequisites
> LeadForm and ProjectForm lack `initialData` support — must be added before edit dialogs work.
> TaskForm already supports editing via `task` prop — no changes needed.

- [x] Add `initialData` prop to `LeadForm` (`components/forms/lead-form.tsx`)
- [x] Add `initialData` prop to `ProjectForm` (`components/forms/project-form.tsx`)
- [x] Fix `PaymentForm` `defaultValues` — was receiving `client.name` / `project.name` instead of IDs

### 1B. Dashboard (`app/(dashboard)/page.tsx`)
- [x] Wire 3 "ראה הכל" buttons: tasks → `/tasks`, projects → `/projects`, payments → `/payments`
- [x] Wire 4 quick action buttons:
  - "הוסף ליד" → open Lead form Dialog
  - "פרויקט חדש" → open Project form Dialog
  - "התחל טיימר" → navigate to `/time`
  - "הוסף תשלום" → navigate to `/payments` (PaymentForm requires clients/projects props)
- [x] Wire "התחל" task buttons to call `POST /api/time/start`
- [x] Replace `window.location.href` in smart recommendations with `router.push()`
- [x] Replace `window.location.reload()` in error retry with `fetchDashboardData()`

### 1C. Leads (`app/(dashboard)/leads/page.tsx`)
- [x] **Add** "ערוך ליד" option to the lead card dropdown menu
- [x] Add `editingLead` state + Dialog with pre-populated `LeadForm`

### 1D. Clients (`app/(dashboard)/clients/page.tsx`)
- [x] Add `editingClient` state + Dialog with pre-populated `ClientForm`
- [x] Wire "ערוך פרטים" dropdown item to open edit dialog
- [x] Make client cards clickable → toast placeholder until Phase 2
- [x] "צור חשבונית" → toast placeholder until Morning integration (Phase 3)

### 1E. Projects (`app/(dashboard)/projects/page.tsx`)
- [x] Add `editingProject` state + Dialog with pre-populated `ProjectForm`
- [x] Wire "ערוך פרויקט" dropdown to open edit dialog
- [x] Wire "צפה" button → toast placeholder until Phase 2
- [x] Wire timer button to actually call `POST /api/time/start` with `projectId`

### 1F. Payments (`app/(dashboard)/payments/page.tsx`)
- [x] **FIX BUG**: Edit form now passes `editingPayment.clientId` (was `client?.name`)
- [x] **FIX BUG**: Edit form now passes `editingPayment.projectId` (was `project?.name`)
- [x] Wire recurring payment edit button → toast placeholder
- [x] Wire recurring payment suspend/activate → `PUT /api/payments/recurring/[id]`

### 1G. Time Tracking (`app/(dashboard)/time/page.tsx`)
- [x] Wire edit button → Dialog with description editing
- [x] Wire delete button → `DELETE /api/time/[id]` with confirmation
- [x] Add description prompt when stopping timer via Dialog
- [x] Update `TimeService.stopTimer()` to accept and save description

### 1H. Sidebar (`components/layout/sidebar.tsx`)
- [x] Wire "פרויקט חדש" button → `router.push('/projects?new=true')`
- [x] Fix notifications link → changed to `href="/"`

### 1I. Header (`components/layout/header.tsx`)
- [x] Wire Profile dropdown item → `router.push('/settings')`
- [x] Wire Settings dropdown item → `router.push('/settings')`
- [x] Wire Help button → Dialog with keyboard shortcuts reference
- [x] Wire Theme toggle → toast placeholder (full `next-themes` deferred to Phase 5)
- [x] Replace search result `<a href>` tags with Next.js `Link`

### 1J. Data Quality
- [x] Add duplicate detection in lead creation — warns if lead with same phone exists (non-blocking)
- [x] Add duplicate detection in client creation — warns if client with same email exists (non-blocking)
- [x] Add Israeli phone format validation to Zod schemas
- [x] Apply phone validation to lead and client API routes

### 1K. Standardize All Forms to Dialog Modals
- [x] Leads page: inline form → Dialog
- [x] Clients page: inline form → Dialog
- [x] Projects page: inline form → Dialog
- [x] Tasks page: inline form → Dialog

---

## Phase 2: Entity Detail Pages ✅

**Goal**: Users can click any lead, client, or project to see full info, related data, and activity history.
**Status**: COMPLETE — all items implemented and verified (build passes clean).

### 2A. Shared Components (create first, reuse across all detail pages)
- [x] Create `components/ui/breadcrumb.tsx` — path-based breadcrumb with Hebrew route labels and `ChevronLeft` (RTL)
- [x] Create `components/activity/activity-timeline.tsx` — chronological activity feed from Activity table, with Hebrew action labels and relative timestamps
- [x] Create `components/ui/empty-state.tsx` — consistent empty state with icon, title, description, and optional CTA button
- [x] Create `app/api/activities/route.ts` — GET activities filtered by `entityType`, `entityId`

### 2B. Lead Detail Page (`app/(dashboard)/leads/[id]/page.tsx`)
- [x] Breadcrumb: דשבורד > לידים > {lead name}
- [x] Header: lead name, status badge, quick actions (call, WhatsApp, email, convert to client)
- [x] Main section (2-col grid): lead info with editable fields (left 2/3) + status pipeline timeline (right 1/3)
- [x] Activity timeline section at bottom
- [x] Wire conversion button to existing convert endpoint (navigates to new client on success)
- [x] Update Phase 1 toast placeholders to navigate here

### 2C. Client Detail Page (`app/(dashboard)/clients/[id]/page.tsx`)
- [x] Breadcrumb: דשבורד > לקוחות > {client name}
- [x] Header: client name, type badge (VIP/Regular), contact quick actions
- [x] Stats row: 4 cards — total projects, total revenue, total hours, client since date
- [x] Tabbed content (shadcn Tabs): פרויקטים, תשלומים, זמנים, פעילות, מידע (editable)
- [x] Stats computed client-side from eager-loaded data (no separate stats API needed)
- [x] Update Phase 1 toast placeholders to navigate here

### 2D. Project Detail Page (`app/(dashboard)/projects/[id]/page.tsx`)
- [x] Breadcrumb: דשבורד > פרויקטים > {project name}
- [x] Header: project name, type/stage badges, link to client detail page, actions (start timer, edit)
- [x] Progress overview card: progress bar, budget (spent vs total), hours (actual/estimated), deadline, days remaining
- [x] Main grid (2-col): tasks list with sub-tasks + inline "add task" (left 2/3) + project info, recent time entries, payments (right 1/3)
- [x] Activity timeline / stage change history at bottom
- [x] Uses existing service `getById()` with enhanced includes (no separate stats/tasks API needed)
- [x] Update Phase 1 toast placeholders to navigate here

### 2E. Sub-tasks UI
- [x] Add sub-task display on task cards (collapsible checklist under parent task)
- [x] Add "הוסף תת-משימה" button on task cards in project detail page
- [x] Create/complete/edit/delete sub-tasks inline (checkbox toggle + text input + keyboard support)
- [x] Schema already has `parentTaskId` self-relation — uses existing tasks API with parentTaskId

---

## Bug Fix Pass ✅

**Goal**: Fix bugs and issues found during codebase review after Phase 2.
**Status**: COMPLETE — all 7 bugs fixed, build passes clean.

- [x] **CRITICAL**: Add `MAINTENANCE` to stage enum in `app/api/projects/[id]/route.ts` — was rejecting updates to projects in MAINTENANCE stage
- [x] **HIGH**: Bind timer description input to state in `app/(dashboard)/time/page.tsx` — input was silently discarded
- [x] **HIGH**: Add `group` class to sub-task row in `app/(dashboard)/projects/[id]/page.tsx` — pencil edit button was permanently invisible
- [x] **HIGH**: Remove hardcoded stats ("3 tasks", "2 projects") from time page summary card
- [x] **HIGH**: Replace hardcoded "משה" with `project.client?.name` in `app/(dashboard)/projects/page.tsx`
- [x] **MEDIUM**: Add `endTime <= startTime` validation for manual time entry
- [x] **MEDIUM**: Add explicit parentheses for operator precedence in sub-task expansion logic

---

## Phase 3: Notifications, Reminders & Integrations ✅ (3D skipped)

**Goal**: Surface hidden data (notifications, activity logs), add follow-up reminders, connect Morning invoice integration to workflow.
**Status**: 3A/3B/3C COMPLETE + bug fix pass — 3D (Morning invoice) skipped per user request.

### 3A. Fix Notification Architecture ✅
- [x] Create `app/api/notifications/route.ts` — GET (fetch user notifications, ordered by date, limit 50), PUT (mark multiple as read)
- [x] Create `app/api/notifications/[id]/route.ts` — PUT mark single notification as read
- [x] Rewrite header notification popover to fetch from database instead of Zustand store
- [x] Each notification shows: type-based icon, title, message, relative timestamp, clickable link to entity
- [x] Removed Zustand notification state entirely — DB-only with 30s polling
- [x] Update sidebar notification badge to use DB count instead of Zustand count
- [x] Added `scheduledFor` field to Notification model for scheduled reminders
- [x] Created `NotificationsService` with getNotifications, getUnreadCount, markAsRead, createReminder, getTodayReminders
- [x] Created `NotificationBell` component — self-contained with popover, polling, mark-as-read

### 3B. Activity Display ✅
- [x] Activity timeline component (built in Phase 2A) reused on all 3 detail pages
- [x] Add "פעילות אחרונה" card to dashboard page — last 10 activities
- [x] Hebrew action label mapping: LEAD_CREATED → "ליד נוצר", LEAD_CONVERTED → "ליד הומר ללקוח", etc.
- [x] Clickable activities on dashboard — navigate to entity detail pages

### 3C. Follow-up Reminders for Leads ✅
- [x] Add "תזכורת מעקב" button on lead cards and lead detail page
- [x] Allow setting reminder date/time (e.g., "follow up in 3 days", "call back tomorrow at 10am")
- [x] Store as a scheduled notification in DB (reuse Notification model with `DEADLINE_APPROACHING` type + scheduledFor date)
- [x] Show upcoming reminders on dashboard ("תזכורות להיום")
- [x] Added `scheduledFor` field on Notification model
- [x] Created `ReminderDialog` component with date/time picker and quick shortcuts

### 3E. Bug Fix Pass (post-implementation review) ✅
- [x] Added missing entity types (Task, Payment, RecurringPayment) to `ENTITY_ROUTES` and `getNotificationUrl` — clicks now navigate correctly
- [x] Fixed invalid date bypass in reminders API — replaced `z.string().min(1)` with `z.coerce.date()` per Zod docs
- [x] Added `countOnly` param to notifications API — sidebar now polls lightweight count-only endpoint instead of full notification list
- [x] Added explicit Prisma `select` to `getNotifications` query — only fetches display fields

### 3D. Morning (Green Invoice) Workflow Integration — SKIPPED
- [ ] Add "הפק חשבונית" button on project detail page (Phase 2D) that opens Morning invoice creation pre-filled with project budget + client data
- [ ] Add "הפק חשבונית" button on payment records that opens Morning invoice creation pre-filled with payment amount + client
- [ ] After invoice created in Morning, store the invoice number back in the CRM Payment record
- [ ] Show invoice status/link on payment cards where Morning invoice exists

---

## Phase 4: Automations & Workflows

**Goal**: Implement the business workflows documented in CLAUDE.md. Migrate existing mock cron jobs to real data.

### 4A. AutomationsService (`lib/services/automations.service.ts` — new file)
- [ ] `checkQuotedLeadsFollowup()` — leads in QUOTED status 3+ days without activity → follow-up notification (deduplicate: skip if sent in last 24h)
- [ ] `checkCompletedProjectsPayment()` — completed projects in last 7 days without payment → notification to create payment request
- [ ] `checkMaintenanceOffers()` — projects in DELIVERY stage 7+ days → notification to offer maintenance
- [ ] `checkReviewRequests()` — projects completed 30+ days ago → notification to request review
- [ ] `checkOverduePayments()` — PENDING payments past due: day 7 / day 14 / day 17 escalation. Mark status as OVERDUE.
- [ ] `runAll()` — execute all above with `Promise.allSettled`

### 4B. Cron & Auto-triggers
- [ ] Create `app/api/cron/automations/route.ts` — GET endpoint protected with `CRON_SECRET`
- [ ] Add `CRON_SECRET` to `.env.example`
- [ ] Configure daily 9 AM schedule (Vercel cron or external)
- [ ] **Migrate** existing `app/api/cron/reminders/route.ts` from mock data to real DB queries
- [ ] **Migrate** existing `app/api/cron/notifications/route.ts` from mock data to real DB queries
- [ ] Note: `app/api/cron/priority-recalc/route.ts` already works — no changes needed
- [ ] In `LeadsService.create()`: auto-create notification "מעקב אחר ליד חדש — יצירת קשר תוך 24 שעות"
- [ ] In `TasksService.update()` and `ProjectsService.update()`: trigger priority recalc on deadline/status/budget changes

### 4C. Improved Lead Conversion
> Current one-click convert works but provides no preview. Add a simple 2-step confirm dialog.

- [ ] Create `components/leads/lead-convert-dialog.tsx` — 2-step Dialog:
  - Step 1: Preview client data (pre-filled from lead) + option to edit + checkbox "create project too"
  - Step 2: Confirm and convert
- [ ] Add duplicate detection: warn if client with same email/phone already exists before converting
- [ ] Reuse existing `POST /api/leads/[id]/convert` endpoint (already works) — extend if needed for project creation

---

## Phase 5: Polish & Consistency

**Goal**: Better loading states, keyboard shortcuts, and consistent empty states.

### 5A. Loading & Empty States
- [ ] Create skeleton loader variants: card grid (3-col), table rows, stat cards row (Skeleton component already exists at `components/ui/skeleton.tsx`)
- [ ] Replace all "טוען..." text spinners with skeleton loaders across all module pages
- [ ] Apply `EmptyState` component (from Phase 2A) across all list pages with relevant icons and CTAs

### 5B. Keyboard & Search
- [ ] Add `Ctrl+K` / `Cmd+K` global listener to focus search input
- [ ] Add `Escape` listener to close search dropdown and blur input

---

## Verification Checklist

Run after each phase:
- [ ] `npm run build` — no TypeScript errors
- [ ] `npm run lint` — no ESLint warnings
- [ ] Manual testing with `npm run dev`:
  - **Phase 1**: Click every button on every page — verify it triggers an action. Try creating duplicate lead with same phone → should warn. Try editing a payment → should save correctly.
  - **Phase 2**: Click lead/client/project cards → detail page loads with breadcrumb, data, activity timeline. Add a sub-task → shows as checklist.
  - **Phase 3**: Create a lead → notification appears in header bell. Set a follow-up reminder → shows on dashboard. Create invoice from project detail → Morning opens pre-filled.
  - **Phase 4**: Wait for cron → automation notifications appear. Convert lead with preview dialog → client + optional project created.
  - **Phase 5**: Throttle network → skeleton loaders visible. Press Ctrl+K → search focuses. Empty database → empty states show.
