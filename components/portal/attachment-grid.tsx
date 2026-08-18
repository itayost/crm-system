'use client'

import { useState } from 'react'

import { openAttachment } from '@/app/r/[token]/actions'
import type { ClientAttachmentView } from '@/lib/services/client-view'

/**
 * The files a client attached, told apart for the first time.
 *
 * This rendered "קובץ 1", "קובץ 2", "קובץ 3" - buttons for files the client
 * uploaded themselves, with no way to know which was the screenshot and which
 * was the PDF. The name and kind come from the DTO now, derived server-side from
 * the last path segment.
 *
 * Still addressed by index, which is the part that must not change: the DTO
 * deliberately never carries a storage path, the server resolves the index
 * against that request's own array, and the bucket is shared with WhatsApp
 * support media - so an index is the difference between a bounds check and a
 * caller naming a path of their own.
 *
 * The URL opens in a new tab rather than replacing the page: the portal token is
 * in the current URL, and Referrer-Policy: no-referrer on /r/ is what stops it
 * riding along to Supabase.
 */
export function AttachmentGrid({
  token,
  requestId,
  attachments,
}: {
  token: string
  requestId: string
  attachments: ClientAttachmentView[]
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (attachments.length === 0) return null

  const open = async (index: number) => {
    setBusy(index)
    setError(null)
    // Opened before the await so the browser attributes the tab to the click
    // and does not treat it as a popup.
    const tab = window.open('', '_blank')
    try {
      const result = await openAttachment(token, requestId, index)
      if ('error' in result) {
        tab?.close()
        setError(result.error)
        return
      }
      if (tab) tab.location.href = result.url
      else window.location.href = result.url
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((file) => (
        <button
          key={file.index}
          type="button"
          disabled={busy === file.index}
          onClick={() => open(file.index)}
          className="flex items-center gap-3 rounded-md border bg-card p-2.5 text-start transition-colors duration-fast hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-surface-subtle font-mono text-[0.625rem] font-bold text-content-muted">
            {file.kind ?? '···'}
          </span>
          <span className="min-w-0 flex-1 truncate text-portal-xs font-medium text-content-body">
            {/* A Hebrew filename survives upload as underscores, so the DTO
                reports no name at all and the index is the honest fallback. */}
            {file.name ?? `קובץ ${file.index + 1}`}
          </span>
          <span className="shrink-0 text-portal-2xs text-content-faint">
            {busy === file.index ? 'פותח…' : 'פתיחה'}
          </span>
        </button>
      ))}
      {error && (
        <p role="status" aria-live="polite" className="text-portal-xs text-tone-danger-foreground">
          {error}
        </p>
      )}
    </div>
  )
}
