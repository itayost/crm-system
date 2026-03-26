# Task System Upgrade

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Add task categories, filter tabs, and quick capture to the task system

## Goal

Make the task system the primary tool for a freelancer who receives work items from WhatsApp, needs to track marketing tasks, lead follow-ups, and admin work — all in one place with fast capture.

This is Sub-project 1 of 2. Sub-project 2 (WhatsApp bot) builds on top of this.

---

## Data Model

### Add `category` field to Task

```
category: TaskCategory — required, default CLIENT_WORK
```

**Enum: TaskCategory**
- `CLIENT_WORK` — עבודת לקוח
- `MARKETING` — שיווק
- `LEAD_FOLLOWUP` — מעקב לידים
- `ADMIN` — מנהלה

**Migration:** Existing tasks get `CLIENT_WORK` as default.

No other model changes. Contact, Project, User stay the same.

---

## Tasks Page Changes

### Category filter tabs

Add tabs at the top of the tasks page, above the existing status/standalone filters:
- "הכל" — all tasks (default)
- "עבודת לקוח" — CLIENT_WORK
- "שיווק" — MARKETING
- "מעקב לידים" — LEAD_FOLLOWUP
- "מנהלה" — ADMIN

Filter works alongside existing status filter and standalone toggle — they combine (e.g., "show me MARKETING tasks that are TODO").

### Quick capture input

Always visible at the top of the page, above the task list. Inline row with:
- Text input for title (placeholder: "משימה חדשה...")
- Category select (default: עבודת לקוח)
- Submit button (or Enter key)

On submit: creates a task with the entered title + selected category, priority MEDIUM, no project, no due date, status TODO. The task appears immediately in the list.

The existing "משימה חדשה" dialog button stays for creating tasks with full details (project, priority, due date, description).

### Category display in task list

Add a small category badge in each task row, next to the project name column. Use distinct colors:
- CLIENT_WORK: blue
- MARKETING: purple
- LEAD_FOLLOWUP: orange
- ADMIN: gray

---

## Task Form Changes

Add a **category select** field to the TaskForm dialog, between title and priority.

Options: עבודת לקוח, שיווק, מעקב לידים, מנהלה
Default: עבודת לקוח

---

## Dashboard Changes

In the "pending tasks" card, show the task category as a small label next to the project name in each task row.

---

## API Changes

### GET /api/tasks

Add `category` query parameter for filtering:
- `?category=MARKETING` — filter by category
- Combines with existing `status`, `projectId`, `standalone`, `search` filters

### POST /api/tasks

Accept `category` field (optional, defaults to CLIENT_WORK).

### PUT /api/tasks/[id]

Accept `category` field for updating.

---

## Validation Changes

### lib/validations/task.ts

Add `category` to both create and update schemas:
- createTaskSchema: `category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional()` (defaults to CLIENT_WORK in service)
- updateTaskSchema: `category: z.enum(['CLIENT_WORK', 'MARKETING', 'LEAD_FOLLOWUP', 'ADMIN']).optional()`

---

## Files to Modify

```
prisma/schema.prisma                     — add TaskCategory enum + category field on Task
lib/validations/task.ts                   — add category to schemas
lib/services/tasks.service.ts             — add category filter + default
app/api/tasks/route.ts                    — pass category filter
components/forms/task-form.tsx            — add category select
app/(dashboard)/tasks/page.tsx            — add tabs, quick capture, category badges
app/(dashboard)/page.tsx                  — show category label in pending tasks
lib/services/dashboard.service.ts         — include category in pending tasks query
```

## What's NOT Included

- WhatsApp bot integration (Sub-project 2)
- Task notifications / reminders
- Task due date calendar view
- Task assignment to others (single-user system)
