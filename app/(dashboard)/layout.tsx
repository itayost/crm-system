import { Toaster } from 'react-hot-toast'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { BadgesProvider } from '@/components/layout/badges-provider'
import { TOAST_OPTIONS } from '@/lib/design/toast'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BadgesProvider>
      <div className="flex h-dvh bg-surface-app">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header />

          {/*
            `pb-16` on mobile clears the bottom bar; the gutter is a token, not
            a hand-picked p-6 that was the same on a 27" monitor and a phone.
            `max-w` keeps a wide screen from stretching a seven-column table
            into 2000px of unreadable ribbon.
          */}
          <main className="flex-1 overflow-y-auto p-3 pb-16 md:p-gutter md:pb-gutter">
            <div className="mx-auto w-full max-w-[100rem]">{children}</div>
          </main>
        </div>

        <MobileNav />
      </div>

      {/*
        `top-center` on both layouts. This was `top-left` here and `top-center`
        on the auth layout - and in an RTL app "left" is the trailing edge,
        which is the corner your eye leaves last.
      */}
      <Toaster position="top-center" reverseOrder={false} toastOptions={TOAST_OPTIONS} />
    </BadgesProvider>
  )
}
