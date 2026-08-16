import type { Metadata } from 'next'

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
    <main dir="rtl" lang="he" className="mx-auto max-w-2xl p-4 sm:p-6">
      {children}
    </main>
  )
}
