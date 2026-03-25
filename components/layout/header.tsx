'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Sun, LogOut, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { signOut, useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export function Header() {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const { data: session } = useSession()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const hebrewDay = format(currentTime, 'EEEE', { locale: he })
  const formattedDate = format(currentTime, 'dd/MM/yyyy')
  const formattedTime = format(currentTime, 'HH:mm')

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 17) return 'צהריים טובים'
    if (hour < 21) return 'ערב טוב'
    return 'לילה טוב'
  }

  const getUserDisplayName = () => {
    if (!session?.user?.name) return 'משתמש'
    return session.user.name
  }

  const getUserInitials = () => {
    if (!session?.user?.name) return 'M'
    const names = session.user.name.split(' ')
    if (names.length >= 2) {
      return names[0][0] + names[1][0]
    }
    return session.user.name.substring(0, 2)
  }

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Greeting and Date */}
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {getGreeting()}, {getUserDisplayName()}!
            </h2>
            <p className="text-sm text-gray-500">
              {hebrewDay}, {formattedDate} &bull; {formattedTime}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
            <HelpCircle className="w-5 h-5" />
          </Button>

          <Button variant="ghost" size="icon" disabled>
            <Sun className="w-5 h-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">{getUserInitials()}</span>
                </div>
                <span className="text-sm hidden md:inline">{getUserDisplayName()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{getUserDisplayName()}</p>
                  <p className="text-xs text-gray-500">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/')}>
                <User className="ml-2 h-4 w-4" />
                פרופיל
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-red-600"
              >
                <LogOut className="ml-2 h-4 w-4" />
                התנתק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>קיצורי מקלדת</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1 border-b">
              <span>סגור חלון</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Escape</kbd>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>דשבורד</span>
              <span className="text-gray-500">/</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>אנשי קשר</span>
              <span className="text-gray-500">/contacts</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>פרויקטים</span>
              <span className="text-gray-500">/projects</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>משימות</span>
              <span className="text-gray-500">/tasks</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
