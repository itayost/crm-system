# Morning Brief

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Daily AI-generated WhatsApp morning summary with proactive suggestions

## Goal

Every morning at 09:00, send a WhatsApp message with an AI-generated daily briefing: overdue tasks, today's priorities, new leads, follow-up reminders, and proactive suggestions (upsells, marketing nudges).

## Architecture

A Vercel cron job triggers daily at 09:00 Israel time. It calls a service that gathers CRM data, sends it to the AI agent to write a natural Hebrew summary, and delivers it via WAHA to the owner's personal WhatsApp.

```
Vercel Cron (09:00 daily, Asia/Jerusalem)
    → POST /api/cron/morning-brief
    → validates CRON_SECRET header
    → MorningBriefService.generateBrief(userId)
        → gathers raw data from DB
        → calls AI Gateway (generateText) to write the brief
    → WahaService.sendMessage to owner's WhatsApp
```

## Data Model

### Add `lastContactedAt` to Contact

```
lastContactedAt  DateTime?  — updated when index webhook captures a message
```

Default: null. The index webhook sets this to `new Date()` whenever a message is stored for a matched contact (both INCOMING and OUTGOING).

## Data Gathered for the Brief

| Data | Query | Purpose |
|------|-------|---------|
| Overdue tasks | status TODO/IN_PROGRESS, dueDate < today | Show what's late |
| Tasks due today | dueDate = today | Today's work |
| Tasks due this week | dueDate within 7 days | Upcoming deadlines |
| New leads (24h) | contacts with lead-phase status, createdAt > 24h ago | New opportunities |
| Stale clients | lastContactedAt > 7 days ago, status = CLIENT | Follow-up reminders |
| Stale leads | lastContactedAt > 3 days ago, status in lead phase | Urgent follow-ups |
| Active projects | status IN_PROGRESS | Context for priorities |
| Pending tasks by category | grouped count | Category breakdown |
| Recent marketing tasks | category = MARKETING, createdAt in last 14 days | Marketing nudge trigger |

## AI Agent Prompt

The brief service sends all gathered data to the AI agent with a specific prompt:

```
Generate a morning brief for a Hebrew-speaking freelancer.

Data provided:
- Overdue tasks: [list]
- Tasks due today: [list]
- Tasks due this week: [list]
- New leads: [list]
- Stale clients (no contact 7+ days): [list]
- Stale leads (no contact 3+ days): [list]
- Active projects: [list]
- Task counts by category: [counts]
- Marketing tasks in last 14 days: [count]

Write a concise WhatsApp message in Hebrew with:
1. Top 3 priorities for today (you decide based on urgency, deadlines, staleness)
2. Summary counts (overdue, today, new leads)
3. Proactive suggestions section:
   - Follow-up reminders for stale contacts/leads
   - Upsell suggestion if a project is near completion (status COMPLETED recently or all tasks done)
   - Marketing nudge if no MARKETING tasks in 14 days

Use WhatsApp formatting (*bold*, _italic_). Keep it scannable — not a wall of text.
Start with "בוקר טוב!" and the date.
```

## Cron Configuration

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/morning-brief",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Note: `0 6 * * *` is 06:00 UTC = 09:00 Israel time (Asia/Jerusalem, UTC+3).

## Cron Endpoint Security

The endpoint validates the `CRON_SECRET` header that Vercel automatically sends for cron jobs:

```typescript
if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

## Sending the Brief

The brief is sent to the owner's WhatsApp via WAHA. The chatId is constructed from `WHATSAPP_OWNER_PHONE` using `WahaService.formatChatId()`.

Since WAHA uses LID format, the bot webhook stores the owner's chatId (LID) in the BotConversation record on first interaction. The morning brief reads it from there. If no previous interaction exists, the brief is skipped (the owner needs to message the bot at least once first).

## Files

### New
```
lib/services/morning-brief.service.ts    — gather data + AI brief generation
app/api/cron/morning-brief/route.ts      — cron endpoint
vercel.json                              — cron schedule configuration
```

### Modified
```
prisma/schema.prisma                     — add lastContactedAt to Contact, add ownerChatId to BotConversation
app/api/whatsapp/index/route.ts          — update lastContactedAt on message capture
app/api/whatsapp/webhook/route.ts        — save owner's chatId (LID) to BotConversation on each interaction
```

## What's NOT Included

- Configurable brief time (hardcoded 09:00)
- Weekend/holiday skip
- Brief via CRM UI (WhatsApp only)
- Customizable brief sections
