import { Toaster } from 'react-hot-toast'

import { TOAST_OPTIONS } from '@/lib/design/toast'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {children}
      {/* The login page raises toasts (wrong password, unexpected error). Without
          a Toaster mounted here they render nowhere, so a failed login looks like
          nothing happened at all. */}
      <Toaster position="top-center" toastOptions={TOAST_OPTIONS} />
    </div>
  )
}
