import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'request-attachments'
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export function validateAttachment(file: { size: number; type: string }) {
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false as const, error: 'סוג קובץ לא נתמך' }
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false as const, error: 'הקובץ גדול מדי (מקסימום 5MB)' }
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
    const path = `${clientId}/${crypto.randomUUID()}/${sanitizeName(file.name)}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error } = await getClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false })

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
