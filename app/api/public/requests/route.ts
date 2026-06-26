import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { publicRequestSchema } from '@/lib/validations/public-request'
import { StorageService, validateAttachment } from '@/lib/services/storage.service'
import { PublicRequestsService, SubmitResult } from '@/lib/services/public-requests.service'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

const TYPE_LABELS: Record<string, string> = {
  BUG: 'תקלה',
  REQUEST: 'בקשה',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    // Honeypot: a bot fills hidden fields. Accept and drop silently.
    if (form.get('website')) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const data = publicRequestSchema.parse({
      token: form.get('token') ?? '',
      type: form.get('type') || undefined,
      title: form.get('title') ?? '',
      description: form.get('description') ?? '',
      projectId: form.get('projectId') || undefined,
      reporterName: form.get('reporterName') || undefined,
      reporterPhone: form.get('reporterPhone') || undefined,
      reporterEmail: form.get('reporterEmail') || undefined,
    })

    // Resolve the owning client before any side effects so an invalid token
    // never leaves an orphaned upload behind, and the file lands under the
    // real client id (not a placeholder).
    const client = await PublicRequestsService.resolveClientByToken(data.token)
    if (!client) {
      return NextResponse.json({ success: false, error: 'הקישור אינו תקין' }, { status: 404 })
    }

    // Optional single attachment.
    const attachments: string[] = []
    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      const check = validateAttachment(file)
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 })
      }
      try {
        const path = await StorageService.uploadAttachment({ clientId: client.id, file })
        attachments.push(path)
      } catch (err) {
        // Never lose the ticket over a failed upload.
        console.error('Attachment upload failed:', err)
      }
    }

    const result = await PublicRequestsService.submit(client, { ...data, attachments })

    notifyOwner(result, data.type).catch((err) =>
      console.error('Failed to notify owner of new request:', err)
    )

    return NextResponse.json({ success: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    console.error('Public request submission error:', error)
    return NextResponse.json({ success: false, error: 'שגיאה בשליחת הטופס' }, { status: 500 })
  }
}

async function notifyOwner(result: SubmitResult, type?: string) {
  const ownerChatId = await WhatsAppAgentService.getOwnerChatId()
  if (!ownerChatId) {
    console.log('No owner chatId set — skipping new request notification')
    return
  }

  const lines = [
    '🔔 *פנייה חדשה מטופס!*',
    '',
    `*עסק:* ${result.clientName}`,
    `*סוג:* ${TYPE_LABELS[type ?? 'REQUEST'] ?? 'בקשה'}`,
  ]
  if (result.reporterName) lines.push(`*מאת:* ${result.reporterName}`)
  if (result.attachmentCount > 0) lines.push('*צורף קובץ:* כן')
  lines.push('', 'ממתין לאישור בלוח הבקשות.')

  await WahaService.sendMessage({ chatId: ownerChatId, text: lines.join('\n') })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
