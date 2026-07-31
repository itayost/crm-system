import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { RequestsService } from './requests.service'
import type { DraftRequestInput } from '@/lib/validations/request'

const MIN_CONFIDENCE = Number(process.env.EXTRACTION_MIN_CONFIDENCE ?? 0.55)
const MAX_MESSAGES_PER_CLIENT = Number(process.env.EXTRACTION_MAX_MESSAGES_PER_CLIENT ?? 200)

const ExtractedRequest = z.object({
  type: z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER']),
  title: z.string().max(120),
  description: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  contactId: z.string(),
  projectId: z.string().nullable(),
  sourceMessageId: z.string(),
  confidence: z.number().min(0).max(1),
})

const ExtractionResult = z.object({
  requests: z.array(ExtractedRequest),
})

const EXTRACTION_SYSTEM_PROMPT = `אתה מנתח שיחות וואטסאפ של לקוחות עבור פרילנסר ישראלי (איתי) שבונה אתרים, אפליקציות ומערכות.
מטרתך: לזהות *בקשות אמיתיות ואקשנביליות* מתוך ההודעות הנכנסות, ולהחזיר אותן כאובייקטים מובנים.

מה כן בקשה (החזר אותה):
- בקשה לתיקון תקלה/באג ("הכפתור לא עובד", "האתר נופל") → type=BUG
- בקשה לשינוי/הוספה/שיפור ("אפשר להוסיף עמוד צור קשר?", "תחליף את התמונה") → type=IMPROVEMENT או REQUEST
- שאלה שדורשת מענה/פעולה → type=QUESTION

מה *לא* בקשה (אל תחזיר, או החזר confidence נמוך מ-0.5):
- צ'יטצ'ט, ברכות, "תודה", "מעולה", "אוקיי", אישורים, תיאום זמנים בלבד
- הודעות לא ברורות שלא ניתן לפעול לפיהן

כללים:
- כתוב title ו-description בעברית. ה-title חייב להיות אקשנבילי וקצר.
- שייך כל בקשה ל-contactId הנכון מתוך הרשימה שסופקה (מי שכתב את ההודעה).
- אם הבקשה מתייחסת בבירור לפרויקט מהרשימה — מלא projectId, אחרת null.
- כמה הודעות יכולות להיות אותה בקשה — אחד אותן לפנייה אחת והשתמש ב-sourceMessageId של ההודעה המייצגת.
- אל תיצור בקשה שכבר מופיעה ברשימת "בקשות פתוחות".
- priority: URGENT רק אם הלקוח כתב במפורש שדחוף או שמשהו שבור בפרודקשן.
- confidence: 0.9+ לבקשה ברורה, 0.5-0.7 לבקשה מעורפלת, מתחת ל-0.5 לצ'יטצ'ט.
- אם אין בקשות אמיתיות — החזר { "requests": [] }.`

interface ExtractionStats {
  clientsProcessed: number
  messagesProcessed: number
  requestsDrafted: number
}

export class RequestExtractionService {
  static async runForOwner(userId: string): Promise<ExtractionStats> {
    // Scope to THIS owner's messages. clientId is a denormalized scalar (no relation),
    // so we tenant-scope through the contact relation (clientId is only ever set when
    // a contact resolved, so every clientId-bearing message has an owning contact).
    const groups = await prisma.whatsAppMessage.groupBy({
      by: ['clientId'],
      where: {
        clientId: { not: null },
        direction: 'INCOMING',
        processedAt: null,
        contact: { userId },
      },
      _count: true,
    })

    let messagesProcessed = 0
    let requestsDrafted = 0

    for (const group of groups) {
      if (!group.clientId) continue
      const result = await this.extractForClient(userId, group.clientId)
      messagesProcessed += result.messagesProcessed
      requestsDrafted += result.requestsDrafted
    }

    return {
      clientsProcessed: groups.length,
      messagesProcessed,
      requestsDrafted,
    }
  }

  private static async extractForClient(userId: string, clientId: string) {
    // Confirm the client belongs to this owner BEFORE touching any messages,
    // so we never mark another tenant's messages as processed.
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: {
        id: true,
        name: true,
        projects: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true },
        },
      },
    })

    if (!client) {
      // Not ours — skip without mutating state.
      return { messagesProcessed: 0, requestsDrafted: 0 }
    }

    const messages = await prisma.whatsAppMessage.findMany({
      where: { clientId, direction: 'INCOMING', processedAt: null, contact: { userId } },
      orderBy: { timestamp: 'asc' },
      take: MAX_MESSAGES_PER_CLIENT,
      include: { contact: { select: { id: true, name: true } } },
    })

    if (messages.length === 0) {
      return { messagesProcessed: 0, requestsDrafted: 0 }
    }

    const existingOpen = await prisma.request.findMany({
      where: { clientId, status: { in: ['PENDING_REVIEW', 'OPEN', 'IN_PROGRESS'] } },
      select: { title: true },
    })

    const validContactIds = new Set(
      messages.map((m) => m.contact?.id).filter((id): id is string => !!id)
    )
    const validProjectIds = new Set(client.projects.map((p) => p.id))

    let object: z.infer<typeof ExtractionResult>
    try {
      const result = await generateObject({
        model: gateway('anthropic/claude-sonnet-4.6'),
        schema: ExtractionResult,
        system: EXTRACTION_SYSTEM_PROMPT,
        prompt: this.buildPrompt(client, messages, existingOpen),
      })
      object = result.object
    } catch (err) {
      // Don't mark processed on failure — retried next run.
      console.error(`extract-requests: LLM error for client ${clientId}:`, err)
      return { messagesProcessed: 0, requestsDrafted: 0 }
    }

    const validMessageIds = new Set(messages.map((m) => m.id))

    const drafts: DraftRequestInput[] = []
    for (const item of object.requests) {
      if (item.confidence < MIN_CONFIDENCE) continue
      if (!validContactIds.has(item.contactId)) continue
      // A hallucinated message id would violate the foreign key and throw out of
      // this loop, leaving the whole batch unprocessed and retried on every run.
      // A *valid* id from another chat would silently file the ticket against
      // someone else's conversation.
      if (!validMessageIds.has(item.sourceMessageId)) continue

      // Dedup: skip if a request already exists for this source message. Scoped
      // to the owner, or another tenant's ticket on the same message would
      // suppress a legitimate draft here.
      const already = await prisma.request.findFirst({
        where: { sourceMessageId: item.sourceMessageId, userId },
        select: { id: true },
      })
      if (already) continue

      drafts.push({
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
        clientId,
        contactId: item.contactId,
        projectId: validProjectIds.has(item.projectId ?? '') ? item.projectId ?? undefined : undefined,
        sourceMessageId: item.sourceMessageId,
        aiConfidence: item.confidence,
        aiNote: `חולץ אוטומטית משיחת וואטסאפ`,
      })
    }

    if (drafts.length > 0) {
      await RequestsService.createDrafts(userId, drafts)
    }

    // Stamp processed only after drafts are written (crash-safe).
    await this.markProcessed(messages.map((m) => m.id))

    return { messagesProcessed: messages.length, requestsDrafted: drafts.length }
  }

  private static async markProcessed(ids: string[]) {
    if (ids.length === 0) return
    await prisma.whatsAppMessage.updateMany({
      where: { id: { in: ids } },
      data: { processedAt: new Date() },
    })
  }

  private static buildPrompt(
    client: { id: string; name: string; projects: { id: string; name: string }[] },
    messages: Array<{
      id: string
      content: string
      transcript: string | null
      timestamp: Date
      phoneNumber: string
      contact: { id: string; name: string } | null
    }>,
    existingOpen: { title: string }[]
  ): string {
    const contactLines = Array.from(
      new Map(
        messages
          .filter((m) => m.contact)
          .map((m) => [m.contact!.id, `  - contactId=${m.contact!.id} שם=${m.contact!.name}`])
      ).values()
    )

    return [
      `עסק: ${client.name} (clientId=${client.id})`,
      `אנשי קשר אפשריים:`,
      ...(contactLines.length ? contactLines : ['  (אין)']),
      `פרויקטים פעילים:`,
      ...(client.projects.length
        ? client.projects.map((p) => `  - projectId=${p.id} שם=${p.name}`)
        : ['  (אין)']),
      ``,
      `בקשות פתוחות שכבר קיימות (אל תיצור שוב משהו שכבר מופיע כאן):`,
      ...(existingOpen.length ? existingOpen.map((r) => `  - ${r.title}`) : ['  (אין)']),
      ``,
      `הודעות נכנסות (סדר כרונולוגי):`,
      ...messages.map(
        (m) =>
          // The transcript is what a voice note or screenshot actually said;
          // `content` for those is just a media marker. Without it the batch
          // pass was blind to every request a client spoke instead of typed.
          `[msgId=${m.id}] [${m.timestamp.toISOString()}] [contactId=${m.contact?.id ?? '?'} ${m.contact?.name ?? m.phoneNumber}]: ${m.content}${m.transcript ? `\n  [תמלול]: ${m.transcript}` : ''}`
      ),
    ].join('\n')
  }
}
