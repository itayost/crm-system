'use client'

import { useEffect } from 'react'

import { portalButton, PortalButton } from '@/components/portal/portal-button'

/**
 * Something threw below the layout.
 *
 * The client cannot act on a stack trace and must never be shown one, so this
 * says the two useful things instead: try again, and here is a human. `reset()`
 * genuinely helps here - most failures on this surface are a transient database
 * hiccup on a `force-dynamic` page, and a retry fixes them.
 *
 * The WhatsApp number is deliberately *not* threaded in: this is a client
 * component, and `whatsappLink()` reads OWNER_PHONE server-side precisely to
 * keep the number out of the client bundle. `error.tsx` cannot take props from
 * the layout, so the way back to a human here is the footer, which is rendered
 * by the layout and survives this boundary.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[portal]', error)
  }, [error])

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-portal-title font-medium text-content-strong">
        משהו השתבש
      </h1>
      <p className="max-w-sm text-portal-base text-content-muted">
        לא הצלחנו לטעון את העמוד. אפשר לנסות שוב, ואם זה נמשך - כתבו לנו ונטפל בזה.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <PortalButton onClick={reset}>נסו שוב</PortalButton>
        <a href="." className={portalButton('ghost')}>
          חזרה לעמוד הראשי
        </a>
      </div>
    </div>
  )
}
