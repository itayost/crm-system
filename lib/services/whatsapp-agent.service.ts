import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { createCrmTools } from './whatsapp-tools'

const SYSTEM_PROMPT = `You are a CRM assistant for a Hebrew-speaking freelancer.
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

Contact statuses:
- NEW, CONTACTED, QUOTED, NEGOTIATING — lead phase
- CLIENT — active client
- INACTIVE — inactive

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
      stopWhen: stepCountIs(5),
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
