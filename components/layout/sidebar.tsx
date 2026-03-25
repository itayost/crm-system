'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Plus,
  CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'

const navigation = [
  {
    name: 'דשבורד',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'אנשי קשר',
    href: '/contacts',
    icon: Users,
  },
  {
    name: 'פרויקטים',
    href: '/projects',
    icon: Briefcase,
  },
  {
    name: 'משימות',
    href: '/tasks',
    icon: CheckSquare,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

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
            <p className="text-xs text-gray-500">גרסה 2.0</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b">
        <Button className="w-full" size="lg" onClick={() => router.push('/projects?new=true')}>
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
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

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
            </Link>
          )
        })}
      </nav>

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
