import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'request-attachments'
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

/**
 * How many files one submission may carry.
 *
 * Lives here rather than in the route because a Next.js route segment may only
 * export its handlers and the framework's own config fields - exporting a
 * constant from `route.ts` fails the build. It belongs beside the other two
 * attachment rules anyway, and the form needs the same number to cap its own
 * picker.
 */
export const MAX_ATTACHMENTS = 5

export function validateAttachment(file: { size: number; type: string }) {
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false as const, error: 'סוג קובץ לא נתמך' }
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false as const, error: 'הקובץ גדול מדי (מקסימום 5MB)' }
  }
  return { ok: true as const }
}

/**
 * Media the support agent receives over WhatsApp. Wider and larger than the
 * public form's attachments (voice notes and screen recordings), so it is a
 * separate allowlist rather than a loosening of the form one.
 */
export const SUPPORT_MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const ALLOWED_SUPPORT_MEDIA_MIME = [
  ...ALLOWED_MIME,
  'image/gif',
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/amr',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
]

/** WhatsApp reports codecs on the mime type ("audio/ogg; codecs=opus"). */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase()
}

export function validateSupportMedia(media: { size: number; mimeType: string }) {
  if (!ALLOWED_SUPPORT_MEDIA_MIME.includes(baseMimeType(media.mimeType))) {
    return { ok: false as const, error: 'סוג קובץ לא נתמך' }
  }
  if (media.size > SUPPORT_MEDIA_MAX_BYTES) {
    return { ok: false as const, error: 'הקובץ גדול מדי (מקסימום 25MB)' }
  }
  return { ok: true as const }
}

let cached: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase storage env vars missing')
  }
  cached = createClient(url, key)
  return cached
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export class StorageService {
  static async uploadAttachment({ clientId, file }: { clientId: string; file: File }): Promise<string> {
    return this.uploadBytes({
      clientId,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      name: file.name,
    })
  }

  /** Same bucket and layout as form attachments, for media that never was a File. */
  static async uploadBytes({
    clientId,
    bytes,
    contentType,
    name,
  }: {
    clientId: string
    bytes: Buffer
    contentType: string
    name: string
  }): Promise<string> {
    const path = `${clientId}/${crypto.randomUUID()}/${sanitizeName(name)}`

    const { error } = await getClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }
    return path
  }

  static async getSignedUrl(path: string, expiresIn = 300): Promise<string> {
    const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(path, expiresIn)
    if (error || !data) {
      throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
    }
    return data.signedUrl
  }

  // Best-effort cleanup; a storage failure must not block deleting the record.
  static async removeAttachments(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    try {
      await getClient().storage.from(BUCKET).remove(paths)
    } catch (err) {
      console.error('Failed to remove attachments:', err)
    }
  }
}
