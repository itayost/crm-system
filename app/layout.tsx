import type { Metadata, Viewport } from 'next'
import { Assistant, Frank_Ruhl_Libre, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../providers/session-provider'

/**
 * Two faces, one job each.
 *
 * Assistant is Hebrew-first and holds up at 13px, which is the body size a
 * dense console needs. Heebo (the previous face) came in through a CSS
 * `@import` at the top of globals.css - render-blocking, unable to start until
 * the stylesheet itself had downloaded, with no `size-adjust` fallback metrics
 * and therefore guaranteed CLS. It also requested seven weights; a grep found
 * 300, 800 and 900 used exactly zero times.
 *
 * The mono is scoped deliberately: money, dates, counts, phone numbers and
 * tokens. Numbers are the one LTR thing in an RTL page, and tabular figures are
 * what make a column of them actually line up.
 */
const ui = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

/**
 * The third face exists for one surface: the client portal.
 *
 * Frank Ruhl Libre is the Hebrew editorial serif - the face of Hebrew books and
 * newspapers - and it is what makes /r/[token] read as correspondence rather
 * than as software. It carries the one-sentence answer, page titles and quoted
 * prices, and nothing else.
 *
 * `preload: false` because the console never renders it. The variable is
 * declared on <html> so the portal can pick it up, but declaring it is not the
 * same as putting a <link rel="preload"> in front of every dashboard page for a
 * face those pages will never paint.
 */
const display = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'CRM System - מערכת ניהול עסק',
  description: 'מערכת ניהול לקוחות ופרויקטים לפרילנסר',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${ui.variable} ${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
