'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  DollarSign,
  BarChart,
  Target,
  Settings,
  Plus,
  Bell,
  CheckSquare,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app-store'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import api from '@/lib/api/client'
import { SidebarBadges } from '@/lib/services/dashboard.service'

const getNavigation = (badges: SidebarBadges | null) => [
  { 
    name: 'דשבורד', 
    href: '/', 
    icon: LayoutDashboard,
    badge: null 
  },
  { 
    name: 'לידים', 
    href: '/leads', 
    icon: Target,
    badge: badges?.leads?.hot && badges.leads.hot > 0 ? { count: badges.leads.hot, variant: 'destructive' as const } : null
  },
  { 
    name: 'לקוחות', 
    href: '/clients', 
    icon: Users,
    badge: null 
  },
  {
    name: 'פרויקטים',
    href: '/projects',
    icon: Briefcase,
    badge: badges?.projects?.active && badges.projects.active > 0 ? { count: badges.projects.active, variant: 'default' as const } : null
  },
  {
    name: 'משימות',
    href: '/tasks',
    icon: CheckSquare,
    badge: badges?.tasks?.urgent && badges.tasks.urgent > 0 ? { count: badges.tasks.urgent, variant: 'destructive' as const } : null
  },
  {
    name: 'זמנים',
    href: '/time',
    icon: Clock,
    badge: null
  },
  { 
    name: 'תשלומים', 
    href: '/payments', 
    icon: DollarSign,
    badge: badges?.payments?.overdue && badges.payments.overdue > 0 ? { count: badges.payments.overdue, variant: 'destructive' as const } :
           badges?.payments?.pending && badges.payments.pending > 0 ? { count: badges.payments.pending, variant: 'secondary' as const } : null
  },
  { 
    name: 'דוחות', 
    href: '/reports', 
    icon: BarChart,
    badge: null 
  },
]

const bottomNavigation = [
  {
    name: 'Morning',
    href: '/morning',
    icon: FileText,
    badge: null
  },
  {
    name: 'הגדרות',
    href: '/settings',
    icon: Settings,
    badge: null
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { notifications } = useAppStore()
  const unreadCount = notifications.filter(n => !n.read).length
  const [badges, setBadges] = useState<SidebarBadges | null>(null)

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await api.get('/dashboard/badges')
        setBadges(response.data)
      } catch (error) {
        console.error('Failed to fetch sidebar badges:', error)
        setBadges(null)
      }
    }

    if (session) {
      fetchBadges()
      // Refresh badges every 30 seconds
      const interval = setInterval(fetchBadges, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  const navigation = getNavigation(badges)

  return (
    <div className="w-64 bg-white shadow-lg h-screen sticky top-0 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">CRM</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">מערכת ניהול</h1>
            <p className="text-xs text-gray-500">גרסה 1.0</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b">
        <Button className="w-full" size="lg">
          <Plus className="w-4 h-4 ml-2" />
          פרויקט חדש
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            ראשי
          </p>
        </div>
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-150',
                'hover:bg-gray-50',
                isActive ? 
                  'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 
                  'text-gray-700 hover:text-gray-900'
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-blue-600" : "text-gray-400"
              )} />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <Badge 
                  variant={item.badge.variant}
                  className="mr-auto"
                >
                  {item.badge.count}
                </Badge>
              )}
            </Link>
          )
        })}

        {/* Bottom Navigation */}
        <div className="mt-8 pt-4 border-t">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              מערכת
            </p>
          </div>
          {bottomNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all duration-150',
                  'hover:bg-gray-50',
                  isActive ? 
                    'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 
                    'text-gray-700 hover:text-gray-900'
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-blue-600" : "text-gray-400"
                )} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Notifications Summary */}
      {unreadCount > 0 && (
        <div className="p-4 border-t bg-yellow-50">
          <Link 
            href="/dashboard/notifications"
            className="flex items-center justify-between text-sm hover:text-blue-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-600" />
              <span className="text-gray-700">התראות חדשות</span>
            </div>
            <Badge variant="destructive">{unreadCount}</Badge>
          </Link>
        </div>
      )}

      {/* User Section */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium">
              {session?.user?.name ? 
                session.user.name.split(' ').length >= 2 ?
                  session.user.name.split(' ')[0][0] + session.user.name.split(' ')[1][0] :
                  session.user.name.substring(0, 2)
                : 'M'
              }
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {session?.user?.name || 'משתמש'}
            </p>
            <p className="text-xs text-gray-500">עוסק פטור</p>
          </div>
        </div>
      </div>
    </div>
  )
}