import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { createCrmTools } from './whatsapp-tools'

const SYSTEM_PROMPT = `You are a smart CRM assistant for a Hebrew-speaking freelancer named Itay who builds websites, apps, and digital projects.
You manage his contacts (leads and clients), projects, and tasks via WhatsApp.

CORE BEHAVIOR — be proactive, not passive:
- When a client name is mentioned, ALWAYS call getContact first to load their full context (projects, tasks, status) before responding or creating anything
- When creating a task that mentions a client, also call getClientMessages to check recent conversation for extra context
- Infer as much as possible — don't ask questions you can answer yourself from the data
- Respond in Hebrew, keep it short

SMART TASK CREATION — infer what you can, ask only what you must:
- Auto-resolve: client name, project, category, priority — never ask for these if you can figure them out
- When a client name partially matches (first name only), just use the match — don't ask unless truly ambiguous (2+ matches)
- BUT: if the task itself is vague ("לטפל", "לסדר", "להתעסק"), ask what specifically needs to be done. The task title must be actionable.
- When creating a task, always add a useful description with context — what needs to be done, for which client, any details from the conversation.

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
- When asked "מה עם X?" or "מה הסטטוס של X?" — call getContact or getProject, AND getClientMessages for full picture
- When asked about a client, mention their active projects and any pending tasks
- When a project name is mentioned, call getProject for full task list

MEMORY & CONTINUITY:
- If you already called getContact for someone in this conversation, don't call it again — use the data you already have
- Track what you've created: if you made a task 2 messages ago, reference it
- If the user says "תוסיף עוד אחת" / "ועוד משהו" — link it to the same context as before

PROACTIVE FOLLOW-UP:
After completing any action, always suggest the logical next step:
- Created task? → suggest deadline or priority if missing
- New lead added? → suggest "רוצה שאזמן follow-up ל-3 ימים?"
- Vague request resolved? → summarize what was done + what's next
- If you notice a client has no active tasks but status is ACTIVE → mention it
- If a lead hasn't been contacted in a while → flag it proactively

Formatting — WhatsApp format only:
- Bold: *text* (single asterisk)
- Italic: _text_ (underscore)
- NO **text**, ## headers, or Markdown syntax
- NEVER escape underscores with backslash
- Use line breaks for readability
- Use Hebrew labels for categories (עבודת לקוח, שיווק, מעקב לידים, מנהלה) — never show English enum values

Contact statuses: NEW, CONTACTED, QUOTED, NEGOTIATING (lead phase) | CLIENT, INACTIVE (client phase)
Project types: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
Project statuses: ACTIVE, COMPLETED
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
    const history = await this.getConversationHistory()

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user' as const, content: userMessage },
    ]

    const tools = createCrmTools(userId)

    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(15),
    })

    const assistantMessage = result.text

    // Save conversation with tool call summary for continuity
    const toolsCalled = result.steps
      ?.flatMap(step => step.toolCalls?.map(tc => tc.toolName) ?? [])
      .filter(Boolean) ?? []

    const newMessages: ConversationMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ]

    if (toolsCalled.length > 0) {
      newMessages.push({ role: 'assistant', content: `[called: ${toolsCalled.join(', ')}]` })
    }

    newMessages.push({ role: 'assistant', content: assistantMessage })

    await this.saveConversationHistory(newMessages)

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

  static async saveOwnerChatId(chatId: string) {
    await prisma.botConversation.upsert({
      where: { id: CONVERSATION_ID },
      update: { ownerChatId: chatId },
      create: {
        id: CONVERSATION_ID,
        messages: [],
        ownerChatId: chatId,
        lastActiveAt: new Date(),
      },
    })
  }

  static async getOwnerChatId(): Promise<string | null> {
    const conversation = await prisma.botConversation.findFirst({
      where: { id: CONVERSATION_ID },
      select: { ownerChatId: true },
    })
    return conversation?.ownerChatId ?? null
  }
}
