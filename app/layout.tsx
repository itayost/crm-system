import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../providers/session-provider'
import './phase-4b-sabotage-marker' // intentional: triggers vercel build failure

export const metadata: Metadata = {
  title: 'CRM System - מערכת ניהול עסק',
  description: 'מערכת ניהול לקוחות ופרויקטים לפרילנסר',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}