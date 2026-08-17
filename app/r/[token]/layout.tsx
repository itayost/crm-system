import type { Metadata } from 'next'

import { PortalHeader, PortalFooter } from '@/components/portal/portal-shell'
import { whatsappLink } from '@/lib/portal/whatsapp-link'

/**
 * Belt to the X-Robots-Tag header set for /r/:path* in next.config.ts.
 *
 * Two mechanisms because they fail differently: a header can be stripped by a
 * proxy or a CDN rule, and a meta tag is invisible to anything that only reads
 * headers. The URL is the credential here, so neither is worth relying on
 * alone.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="he" className="flex min-h-dvh flex-col bg-surface-app">
      <PortalHeader />

      {/* pb-24 leaves room for the sticky decision bar on a request page, so
          the last card is never trapped underneath it. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 sm:px-6">{children}</main>

      <PortalFooter whatsapp={whatsappLink()} />
    </div>
  )
}
