import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Toaster } from 'react-hot-toast'
import { TOAST_OPTIONS } from '@/lib/design/toast'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-subtle" dir="rtl">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />
          
          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6 bg-surface-subtle">
            {children}
          </main>
        </div>
      </div>
      
      {/* Toast Notifications */}
      <Toaster position="top-left" reverseOrder={false} toastOptions={TOAST_OPTIONS} />
    </div>
  )
}