import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../providers/session-provider'

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
    <html lang="he" dir="rtl">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}