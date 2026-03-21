# Remove Time Tracking Feature

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Full removal of all time-tracking functionality from the CRM

## Context

The time tracking feature (timer widget, time entries, time statistics) is not in use. Removing it simplifies the codebase and reduces maintenance surface.

## Decision

Remove everything time-related: the TimeEntry database model, all API routes, the dashboard page, the timer widget, time-related fields on projects (estimatedHours, actualHours), and all references in mixed files.

## Files to Delete (11 files)

| File | Purpose |
|------|---------|
| `app/api/time/route.ts` | List/create time entries |
| `app/api/time/start/route.ts` | Start timer |
| `app/api/time/stop/route.ts` | Stop timer |
| `app/api/time/active/route.ts` | Get active timer |
| `app/api/time/[id]/route.ts` | Update/delete time entry |
| `app/api/time/stats/route.ts` | Time statistics |
| `app/api/time/entries/route.ts` | Mock time entries |
| `app/api/reports/time/route.ts` | Time analytics endpoint |
| `app/(dashboard)/time/page.tsx` | Time tracking dashboard page |
| `lib/services/time.service.ts` | TimeService class |
| `components/timer/timer-widget.tsx` | Floating timer widget |

The `app/api/time/` and `components/timer/` directories are deleted entirely after their contents are removed.

## Files to Modify (20 files)

### Schema & State

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `TimeEntry` model; remove `timeEntries` relations from User, Project, Task; remove `estimatedHours`/`actualHours` from Project and Task |
| `prisma/seed.ts` | Remove `estimatedHours` from seed data |
| `store/app-store.ts` | Remove `Timer` interface, `activeTimer` state, `startTimer`/`stopTimer` methods |

### Navigation & Layout

| File | Change |
|------|--------|
| `components/layout/sidebar.tsx` | Remove `/time` navigation link |
| `app/(dashboard)/layout.tsx` | Remove `TimerWidget` import and render |

### Dashboard & Pages

| File | Change |
|------|--------|
| `app/(dashboard)/page.tsx` | Remove `handleStartTaskTimer()`, `/time` navigation, `weeklyHours` display |
| `app/(dashboard)/tasks/page.tsx` | Remove `TimerWidget` import and timer start logic |
| `app/(dashboard)/projects/page.tsx` | Remove `estimatedHours`/`actualHours` from interface and mock data, `handleStartTimer()`, timer buttons, hours display |
| `app/(dashboard)/projects/[id]/page.tsx` | Remove `TimeEntry` interface, time entries display, total hours calculations |
| `app/(dashboard)/clients/[id]/page.tsx` | Remove time aggregation logic |
| `app/(dashboard)/reports/page.tsx` | Remove `TimeData` interface, time tab, `fetchTimeData()`, `totalHours`/`weeklyHours` KPIs, `estimatedHours`/`actualHours` in project analytics |

### Forms & API Routes

| File | Change |
|------|--------|
| `components/forms/project-form.tsx` | Remove `estimatedHours` field from form type, default value, API payload, and UI |
| `app/api/projects/route.ts` | Remove `estimatedHours` from Zod create schema |
| `app/api/projects/[id]/route.ts` | Remove `estimatedHours`/`actualHours` from Zod update schema |

### Services

| File | Change |
|------|--------|
| `lib/services/dashboard.service.ts` | Remove `weeklyHours` from interface, `prisma.timeEntry.aggregate()` call, `task.estimatedHours` reference |
| `lib/services/projects.service.ts` | Remove `timeEntries` includes in queries, `actualHours` references |
| `lib/services/clients.service.ts` | Remove `timeEntries` includes in queries |
| `lib/services/tasks.service.ts` | Remove `timeEntries` references, `totalMinutes` calculations |
| `lib/services/reports.service.ts` | Remove `getTimeAnalytics()` method |

### Mock Data & CSS

| File | Change |
|------|--------|
| `lib/api/mock-db.ts` | Remove `timeEntries` array |
| `app/globals.css` | Remove `.timer-active` CSS class and its `@keyframes pulse` rule |

## Files to Delete (Additional)

| File | Purpose |
|------|---------|
| `claude-context/crm-time-tracking.html` | Time tracking wireframe document (no longer relevant) |

## Database Migration

- Drop `TimeEntry` table
- Remove `estimatedHours` and `actualHours` columns from `Project` table
- Remove `estimatedHours` and `actualHours` columns from `Task` table (if present)
- Apply via `npm run db:migrate`

## Documentation Updates

| File | Change |
|------|--------|
| `CLAUDE.md` | Remove time tracking references from feature lists and project status |
| `DEVPLAN.md` | Remove `TimeService` references, timer tasks, and time-tracking items |

## Out of Scope

- No package removals needed (`date-fns`, `lucide-react` used elsewhere)
- No changes to auth, payments, leads, clients, or other modules
