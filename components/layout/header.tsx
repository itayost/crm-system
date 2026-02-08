'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Search, Sun, LogOut, Settings, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { NotificationBell } from '@/components/notifications/notification-bell'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import api from '@/lib/api/client'
import { SearchResult } from '@/lib/services/dashboard.service'

export function Header() {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const { data: session } = useSession()

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Search functionality
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        // Load recent searches/suggestions
        try {
          const response = await api.get('/dashboard/search')
          setSearchResults(response.data.results || [])
        } catch {
          setSearchResults([])
        }
        return
      }

      setSearchLoading(true)
      try {
        const response = await api.get(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`)
        setSearchResults(response.data.results || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }

    const debounceTimer = setTimeout(performSearch, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  // Format Hebrew day
  const hebrewDay = format(currentTime, 'EEEE', { locale: he })
  const formattedDate = format(currentTime, 'dd/MM/yyyy')
  const formattedTime = format(currentTime, 'HH:mm')

  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 17) return 'צהריים טובים'
    if (hour < 21) return 'ערב טוב'
    return 'לילה טוב'
  }

  // Get user display info
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

  const getSearchResultIcon = (type: string) => {
    switch (type) {
      case 'lead': return '👤'
      case 'client': return '🏢'
      case 'project': return '📋'
      case 'payment': return '💰'
      default: return '📄'
    }
  }

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left Section - Greeting and Date */}
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {getGreeting()}, {getUserDisplayName()}! ☀️
            </h2>
            <p className="text-sm text-gray-500">
              {hebrewDay}, {formattedDate} • {formattedTime}
            </p>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-xl mx-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="search"
              placeholder="חיפוש מהיר... (Ctrl+K)"
              className="pr-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            />
            {searchOpen && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border p-2 max-h-96 overflow-y-auto">
                {searchLoading ? (
                  <div className="px-2 py-4 text-center text-gray-500">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto"></div>
                    <p className="text-xs mt-2">מחפש...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 px-2 py-1">
                      {searchQuery.trim() ? 'תוצאות חיפוש' : 'חיפושים אחרונים'}
                    </p>
                    <div className="space-y-1">
                      {searchResults.length === 0 ? (
                        <p className="text-sm text-gray-400 px-2 py-2 text-center">
                          {searchQuery.trim() ? 'לא נמצאו תוצאות' : 'אין חיפושים אחרונים'}
                        </p>
                      ) : (
                        searchResults.map((result) => (
                          <Link
                            key={result.id}
                            href={result.href}
                            className="flex items-center gap-3 w-full text-right px-2 py-2 hover:bg-gray-50 rounded text-sm transition-colors"
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                          >
                            <span className="text-lg">{getSearchResultIcon(result.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{result.title}</p>
                              {result.subtitle && (
                                <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                              )}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Help */}
          <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)}>
            <HelpCircle className="w-5 h-5" />
          </Button>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={() => {
            import('react-hot-toast').then(({ toast }) => toast('מצב כהה - בקרוב', { icon: '🌙' }))
          }}>
            <Sun className="w-5 h-5" />
          </Button>

          {/* User Menu */}
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
                  <p className="text-xs text-gray-500">{session?.user?.email || 'משתמש@example.com'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <User className="ml-2 h-4 w-4" />
                פרופיל
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="ml-2 h-4 w-4" />
                הגדרות
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
              <span>חיפוש מהיר</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+K</kbd>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>סגור חלון</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Escape</kbd>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>דשבורד</span>
              <span className="text-gray-500">עמוד הבית</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>לידים</span>
              <span className="text-gray-500">/leads</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span>לקוחות</span>
              <span className="text-gray-500">/clients</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>פרויקטים</span>
              <span className="text-gray-500">/projects</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}