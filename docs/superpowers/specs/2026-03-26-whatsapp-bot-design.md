# WhatsApp CRM Agent

**Date:** 2026-03-26
**Status:** Approved
**Scope:** AI-powered WhatsApp bot that acts as a full CRM assistant with passive conversation indexing

## Goal

Build a WhatsApp-based AI agent that can perform any CRM action via natural Hebrew conversation — create/edit contacts, projects, tasks, query data, get dashboard stats. The agent also passively indexes all WhatsApp conversations with clients for context.

## Architecture

### Dual-Number Setup

**Number 1 (your personal number):**
- WAHA session passively listens to all incoming/outgoing messages
- Indexes messages in the database, matched to contacts by phone number
- Never sends replies — silent listener only

**Number 2 (bot number — separate SIM):**
- WAHA session for interactive conversation with the AI agent
- You message this number to give commands, ask questions
- Bot responds with results, confirmations, clarifications

Both numbers run as separate WAHA sessions in the same Docker container on a VPS.

### Message Flow

```
Your personal WhatsApp (Number 1)
  ↓ all messages
WAHA Session 1 → webhook → /api/whatsapp/index
  → store in WhatsAppMessage table
  → match phone to Contact by phone number
  → no response sent

You message bot (Number 2)
  ↓
WAHA Session 2 → webhook → /api/whatsapp/webhook
  ↓
AI Agent (Vercel AI SDK Agent class, via AI Gateway)
  → system prompt: Hebrew CRM assistant
  → 13 tools wrapping existing CRM services
  → can query indexed message history for client context
  ↓
Agent generates Hebrew response
  ↓
WAHA Session 2 sends reply to you
```

---

## Data Model

### New Model: WhatsAppMessage

```
WhatsAppMessage:
  id            String    @id @default(cuid())
  phoneNumber   String    — the other party's phone number
  direction     MessageDirection — INCOMING or OUTGOING
  content       String    @db.Text — message text
  contactId     String?   — FK to Contact (matched by phone, nullable if unknown)
  sessionName   String    — which WAHA session captured this ("personal" or "bot")
  timestamp     DateTime  — when the message was sent/received
  createdAt     DateTime  @default(now())

  @@index([phoneNumber])
  @@index([contactId])
  @@index([timestamp])
```

**Enum: MessageDirection**
- `INCOMING` — message received
- `OUTGOING` — message sent by you

### New Model: BotConversation

Stores the AI agent's conversation history for multi-turn context on the bot number.

```
BotConversation:
  id            String    @id @default(cuid())
  messages      Json      — array of { role, content } pairs
  lastActiveAt  DateTime  — last message timestamp
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
```

Single record (one conversation with yourself). Keeps last 20 agent messages for context. Older messages are trimmed on each interaction.

---

## Agent Tools (13 total)

### Contacts (4 tools)

**createContact**
- Input: name (required), phone (required), source (optional, default OTHER), status (optional, default NEW)
- Action: calls ContactsService.create
- Response: confirms contact created with details

**updateContact**
- Input: nameQuery (fuzzy match), fields to update (status, phone, email, isVip, etc.)
- Action: fuzzy-match name against Contact table, call ContactsService.update
- If multiple matches: return list for clarification
- Includes conversion: updating status to CLIENT triggers convertedAt

**listContacts**
- Input: phase (optional: lead/client), search (optional)
- Action: calls ContactsService.getAll
- Response: numbered list of contacts with status

**getContact**
- Input: nameQuery (fuzzy match)
- Action: calls ContactsService.getById
- Response: full contact details including projects list

### Projects (3 tools)

**createProject**
- Input: name (required), type (required), contactName (required, fuzzy match), price (optional), retention (optional)
- Action: fuzzy-match contact, validate CLIENT status, call ProjectsService.create
- Response: confirms project created

**updateProject**
- Input: nameQuery (fuzzy match project name), fields to update (status, price, deadline, etc.)
- Action: fuzzy-match project name, call ProjectsService.update
- Response: confirms update

**listProjects**
- Input: status (optional), contactName (optional, fuzzy match)
- Action: calls ProjectsService.getAll
- Response: numbered list with status and contact name

### Tasks (3 tools)

**createTask**
- Input: title (required), category (optional, default CLIENT_WORK), priority (optional, default MEDIUM), projectName (optional, fuzzy match), dueDate (optional)
- Action: if projectName given, fuzzy-match project, call TasksService.create
- Response: confirms task created with all details

**updateTask**
- Input: titleQuery (fuzzy match), fields to update (status, priority, category, etc.)
- Action: fuzzy-match task title, call TasksService.update
- Response: confirms update

**listTasks**
- Input: category (optional), status (optional), projectName (optional, fuzzy match)
- Action: calls TasksService.getAll
- Response: numbered list with priority and category

### General (3 tools)

**getDashboard**
- Input: none
- Action: calls DashboardService.getData
- Response: formatted summary — revenue, active projects, pending tasks, leads count

**getClientMessages**
- Input: contactName (fuzzy match), days (optional, default 7)
- Action: query WhatsAppMessage table by contactId, recent messages
- Response: recent conversation history with that client

**searchEverything**
- Input: query (free text)
- Action: search across contacts, projects, tasks by name/title
- Response: combined results

### Fuzzy Name Matching

All tools that accept a name use fuzzy matching:
1. Exact match first
2. Starts-with match
3. Contains match
4. If multiple matches, return numbered list for the agent to present as clarification

Matching is done in a shared utility function used by all tools.

---

## Agent System Prompt

```
You are a CRM assistant for a Hebrew-speaking freelancer.
You manage contacts (leads and clients), projects, and tasks.

Rules:
- Always respond in Hebrew
- Be concise — short WhatsApp messages, not essays
- When creating/updating, confirm in one line with key details
- When listing, use numbered lists
- When a name matches multiple records, ask which one with numbers
- When required info is missing, ask naturally (one question at a time)
- Never make up data — only use what the tools return
- For task creation: infer category from context (client name mentioned = CLIENT_WORK, marketing terms = MARKETING, lead terms = LEAD_FOLLOWUP)
- For forwarded client messages: extract the action item as task title
- You can check client message history for context using getClientMessages

Categories:
- CLIENT_WORK (עבודת לקוח) — tasks related to client projects
- MARKETING (שיווק) — portfolio, social media, advertising
- LEAD_FOLLOWUP (מעקב לידים) — following up with potential clients
- ADMIN (מנהלה) — invoices, accounting, business admin
```

---

## Security

- **Bot number webhook:** only processes messages from `WHATSAPP_OWNER_PHONE` env var. All other senders are ignored.
- **Personal number webhook:** indexes all messages but never responds. No agent invocation.
- **Webhook validation:** WAHA sends a configurable secret header, validated by the endpoint.
- **WAHA API key:** required for sending messages back.

---

## Environment Variables

```
WAHA_API_URL              — WAHA instance URL (e.g., https://waha.your-vps.com)
WAHA_API_KEY              — WAHA authentication key
WAHA_PERSONAL_SESSION     — session name for your personal number (e.g., "personal")
WAHA_BOT_SESSION          — session name for the bot number (e.g., "bot")
WHATSAPP_OWNER_PHONE      — your phone number (only this number can command the bot)
WHATSAPP_WEBHOOK_SECRET   — secret for webhook validation
```

AI Gateway credentials are already configured via Vercel OIDC.

---

## Files to Create

```
lib/services/waha.service.ts                — WAHA REST API client (send messages, manage sessions)
lib/services/whatsapp-agent.service.ts      — AI Agent definition (system prompt, tool registration)
lib/services/whatsapp-tools.ts              — 13 tool definitions wrapping CRM services
lib/services/fuzzy-match.ts                 — Shared fuzzy name matching utility
app/api/whatsapp/webhook/route.ts           — Bot webhook (agent interaction)
app/api/whatsapp/index/route.ts             — Personal number webhook (passive indexing)
```

### Files to Modify

```
prisma/schema.prisma                        — Add WhatsAppMessage, BotConversation, MessageDirection enum
```

### Dependencies to Install

```
ai                    — Vercel AI SDK core
@ai-sdk/react         — React hooks (if needed for future UI)
@ai-sdk/gateway       — AI Gateway provider
```

---

## What's NOT Included

- WhatsApp media handling (images, voice notes, documents) — text only
- Group chat support — single-user bot only
- CRM UI for viewing WhatsApp message history (can be added later)
- WAHA deployment automation (manual Docker setup on VPS)
- Rate limiting on agent invocations
