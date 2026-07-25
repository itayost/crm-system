import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { baseMimeType } from './storage.service'

/**
 * Turns a voice note, screen recording, or screenshot into text the support
 * agent can reason about, through the same AI Gateway as every other model call.
 */

const MODEL = process.env.SUPPORT_MEDIA_MODEL ?? 'google/gemini-2.5-flash'
const MAX_TRANSCRIPT_CHARS = 4000

export type MediaKind = 'audio' | 'video' | 'image' | 'other'

export function mediaKind(mimeType: string): MediaKind {
  const base = baseMimeType(mimeType)
  if (base.startsWith('audio/')) return 'audio'
  if (base.startsWith('video/')) return 'video'
  if (base.startsWith('image/')) return 'image'
  return 'other'
}

const PROMPTS: Record<MediaKind, string> = {
  audio:
    'תמלל את ההודעה הקולית הזו במדויק, בשפה שבה היא נאמרה. אל תוסיף פרשנות, רק את מה שנאמר.',
  video:
    'זו הקלטת מסך או סרטון שלקוח שלח כדי להראות תקלה. תאר בקצרה מה רואים בסרטון ומה השתבש, ותמלל כל דיבור שנשמע בו. ענה בעברית.',
  image:
    'זו תמונה או צילום מסך שלקוח שלח. תאר מה רואים בה, כולל טקסט או הודעות שגיאה שמופיעים. ענה בעברית.',
  other: 'תאר בקצרה את תוכן הקובץ. ענה בעברית.',
}

export interface TranscriptionResult {
  ok: boolean
  transcript: string | null
  kind: MediaKind
}

export class MediaUnderstandingService {
  static async describe({
    bytes,
    mimeType,
  }: {
    bytes: Buffer
    mimeType: string
  }): Promise<TranscriptionResult> {
    const kind = mediaKind(mimeType)

    try {
      const result = await generateText({
        model: gateway(MODEL),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPTS[kind] },
              { type: 'file', data: bytes, mediaType: baseMimeType(mimeType) },
            ],
          },
        ],
      })

      const transcript = result.text?.trim()
      if (!transcript) return { ok: false, transcript: null, kind }

      return { ok: true, transcript: transcript.slice(0, MAX_TRANSCRIPT_CHARS), kind }
    } catch (error) {
      console.error('Media transcription failed:', error)
      return { ok: false, transcript: null, kind }
    }
  }
}
