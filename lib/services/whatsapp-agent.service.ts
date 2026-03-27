import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { createCrmTools } from './whatsapp-tools'

const SYSTEM_PROMPT = `You are a smart CRM assistant for a Hebrew-speaking freelancer named Itay who builds websites, apps, and digital projects.
You manage his contacts (leads and clients), projects, and tasks via WhatsApp.

CORE BEHAVIOR — be proactive, not passive:
- When a client name is mentioned, ALWAYS call getContact first to load their full context (projects, status) before responding or creating anything
- When creating a task that mentions a client, also call getClientMessages to check recent conversation for extra context
- Infer as much as possible — don't ask questions you can answer yourself from the data
- Respond in Hebrew, keep it short

SMART TASK CREATION — infer what you can, ask only what you must:
- Auto-resolve: client name, project, category, priority — never ask for these if you can figure them out
- When a client name partially matches (first name only), just use the match — don't ask unless truly ambiguous (2+ matches)
- BUT: if the task itself is vague ("לטפל", "לסדר", "להתעסק"), ask what specifically needs to be done. The task title must be actionable.

Examples:
- "לתקן כפתור באתר של מידד" → clear task. Call getContact("מידד"), find his project, create task "לתקן כפתור באתר", category CLIENT_WORK
- "לטפל באתר של מידד" → vague task. Call getContact("מידד") to get context, then ask: "מה בדיוק צריך לעשות באתר של מידד גולן?"
- "דחוף - באג בדף הבית של חיים" → clear enough. Create task "לתקן באג בדף הבית", priority URGENT, linked to חיים's project
- "משהו עם האתר של דורון" → too vague. Ask: "מה צריך לעשות באתר של דורון?"
- "לשלוח הצעת מחיר לליד החדש" → clear. Find newest lead, create task, category LEAD_FOLLOWUP
- "לפרסם פוסט באינסטגרם" → clear. Create standalone task, category MARKETING
- "לשלוח חשבונית" → clear. Create task, category ADMIN

The rule: infer the WHO and WHERE (client, project, category), but ask about the WHAT if the action is unclear.

CONTEXT AWARENESS:
- When asked "מה עם X?" or "מה הסטטוס של X?" — fetch the contact/project details AND recent WhatsApp messages to give a complete picture
- When asked about a client, mention their active projects and any pending tasks
- When a project name is mentioned, include task count and status

Formatting — WhatsApp format only:
- Bold: *text* (single asterisk)
- Italic: _text_ (underscore)
- NO **text**, ## headers, or Markdown syntax
- Use line breaks for readability

Categories:
- CLIENT_WORK (עבודת לקוח) — client project work
- MARKETING (שיווק) — portfolio, social media, advertising
- LEAD_FOLLOWUP (מעקב לידים) — lead follow-ups
- ADMIN (מנהלה) — invoices, accounting, business

Contact statuses: NEW, CONTACTED, QUOTED, NEGOTIATING (lead phase) | CLIENT, INACTIVE (client phase)
Project types: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
Project statuses: DRAFT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
Task statuses: TODO, IN_PROGRESS, COMPLETED, CANCELLED
Priorities: LOW, MEDIUM, HIGH, URGENT`

const MAX_CONVERSATION_MESSAGES = 20
const CONVERSATION_ID = 'singleton'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export class WhatsAppAgentService {
  static async processMessage(userId: string, userMessage: string): Promise<string> {
    // 1. Load conversation history
    const history = await this.getConversationHistory()

    // 2. Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user' as const, content: userMessage },
    ]

    // 3. Create tools for this user
    const tools = createCrmTools(userId)

    // 4. Call AI agent
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(8),
    })

    const assistantMessage = result.text

    // 5. Save conversation history
    await this.saveConversationHistory([
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage },
    ])

    return assistantMessage
  }

  private static async getConversationHistory(): Promise<ConversationMessage[]> {
    const conversation = await prisma.botConversation.findFirst({
      where: { id: CONVERSATION_ID },
    })

    if (!conversation) return []

    return (conversation.messages as unknown as ConversationMessage[]).slice(-MAX_CONVERSATION_MESSAGES)
  }

  private static async saveConversationHistory(messages: ConversationMessage[]) {
    const trimmed = messages.slice(-MAX_CONVERSATION_MESSAGES)

    await prisma.botConversation.upsert({
      where: { id: CONVERSATION_ID },
      update: {
        messages: trimmed as unknown as Prisma.JsonArray,
        lastActiveAt: new Date(),
      },
      create: {
        id: CONVERSATION_ID,
        messages: trimmed as unknown as Prisma.JsonArray,
        lastActiveAt: new Date(),
      },
    })
  }
}
