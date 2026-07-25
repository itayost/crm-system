import { MediaUnderstandingService, mediaKind, type MediaKind } from './media-understanding.service'
import {
  StorageService,
  SUPPORT_MEDIA_MAX_BYTES,
  baseMimeType,
  validateSupportMedia,
} from './storage.service'
import { WahaService } from './waha.service'

/**
 * Download -> validate -> store -> understand, for media a client sends the
 * support agent. Never throws: every failure degrades into a result the agent
 * can talk about, because the client is waiting on the other end.
 */

export interface IncomingMedia {
  url: string
  mimeType: string
  filename?: string | null
}

export interface ProcessedMedia {
  /** Storage path of the stored original, null when it could not be stored. */
  path: string | null
  mimeType: string
  transcript: string | null
  transcribed: boolean
  /** What the agent reads in place of a typed message. */
  agentText: string
  /** Hebrew reason to tell the client, when something went wrong. */
  failure: string | null
}

const KIND_LABELS: Record<MediaKind, string> = {
  audio: 'הודעה קולית',
  video: 'סרטון',
  image: 'תמונה',
  other: 'קובץ',
}

const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export async function processIncomingMedia({
  clientId,
  media,
  caption,
}: {
  clientId: string
  media: IncomingMedia
  caption?: string
}): Promise<ProcessedMedia> {
  const kind = mediaKind(media.mimeType)
  const label = KIND_LABELS[kind]

  let bytes: Buffer
  let contentType: string
  try {
    const downloaded = await WahaService.downloadMedia(media.url, {
      maxBytes: SUPPORT_MEDIA_MAX_BYTES,
    })
    bytes = downloaded.bytes
    // What the server actually served wins over what the payload claimed, so the
    // allowlist is never checked against a self-declared type.
    contentType = downloaded.contentType === 'application/octet-stream'
      ? media.mimeType
      : downloaded.contentType
  } catch (error) {
    console.error('Media download failed:', error)
    return failed(kind, media.mimeType, caption, `לא הצלחנו להוריד את ה${label}`)
  }

  const validation = validateSupportMedia({ size: bytes.length, mimeType: contentType })
  if (!validation.ok) {
    return failed(kind, contentType, caption, `${validation.error} (${label})`)
  }

  let path: string | null = null
  try {
    path = await StorageService.uploadBytes({
      clientId,
      bytes,
      contentType: baseMimeType(contentType),
      name: fileName(media.filename, contentType, kind),
    })
  } catch (error) {
    // Keep going: an unstored file still deserves a transcript and an answer.
    console.error('Media upload failed:', error)
  }

  const understood = await MediaUnderstandingService.describe({ bytes, mimeType: contentType })

  if (!understood.ok || !understood.transcript) {
    return {
      ...failed(kind, contentType, caption, `לא הצלחנו להבין את ה${label}`),
      path,
    }
  }

  return {
    path,
    mimeType: contentType,
    transcript: understood.transcript,
    transcribed: true,
    agentText: [
      `[${label} מהלקוח, תומללה אוטומטית]: ${understood.transcript}`,
      caption ? `[הלקוח גם כתב]: ${caption}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    failure: null,
  }
}

function failed(
  kind: MediaKind,
  mimeType: string,
  caption: string | undefined,
  reason: string
): ProcessedMedia {
  const label = KIND_LABELS[kind]

  return {
    path: null,
    mimeType,
    transcript: null,
    transcribed: false,
    agentText: [
      `[הלקוח שלח ${label} ש${reason}. בקש ממנו לכתוב את הבקשה בטקסט, ואל תמציא מה היה שם.]`,
      caption ? `[הלקוח גם כתב]: ${caption}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    failure: reason,
  }
}

function fileName(original: string | null | undefined, mimeType: string, kind: MediaKind): string {
  if (original) return original

  const extension = EXTENSIONS[baseMimeType(mimeType)] ?? 'bin'
  return `${kind}.${extension}`
}
