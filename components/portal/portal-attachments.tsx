'use client'

import { useState } from 'react'
import { Paperclip } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { openAttachment } from '@/app/r/[token]/actions'

/**
 * The files a client attached, openable by them for the first time.
 *
 * Addressed by index, because the DTO deliberately never carries a storage
 * path - the server resolves the index against that request's own array and
 * mints a short-lived signed URL.
 *
 * The URL opens in a new tab rather than replacing the page: the portal token
 * is in the current URL, and Referrer-Policy: no-referrer on /r/ is what stops
 * it riding along to Supabase.
 */
export function PortalAttachments({
  token,
  requestId,
  count,
}: {
  token: string
  requestId: string
  count: number
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (count === 0) return null

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
    <section>
      <h2 className="mb-2 font-semibold text-content-strong">קבצים שצירפת</h2>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, i) => (
          <Button key={i} variant="outline" size="sm" disabled={busy === i} onClick={() => open(i)}>
            <Paperclip className="h-3.5 w-3.5" />
            <span>
              {busy === i ? 'פותח...' : `קובץ ${i + 1}`}
            </span>
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-tone-danger-foreground">{error}</p>}
    </section>
  )
}
