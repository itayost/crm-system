'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  UserPlus,
  Clock,
  CreditCard,
  CheckSquare,
  Briefcase,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import api from '@/lib/api/client'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  isRead: boolean
  entityType: string | null
  entityId: string | null
  scheduledFor: string | null
  createdAt: string
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LEAD_NEW: UserPlus,
  DEADLINE_APPROACHING: Clock,
  PAYMENT_DUE: CreditCard,
  PAYMENT_OVERDUE: AlertCircle,
  TASK_ASSIGNED: CheckSquare,
  PROJECT_UPDATE: Briefcase,
  SYSTEM: Bell,
}

const TYPE_COLORS: Record<string, string> = {
  LEAD_NEW: 'text-green-600',
  DEADLINE_APPROACHING: 'text-orange-600',
  PAYMENT_DUE: 'text-blue-600',
  PAYMENT_OVERDUE: 'text-red-600',
  TASK_ASSIGNED: 'text-purple-600',
  PROJECT_UPDATE: 'text-blue-600',
  SYSTEM: 'text-gray-600',
}

function getNotificationUrl(notification: Notification): string | null {
  if (!notification.entityType || !notification.entityId) return null

  switch (notification.entityType) {
    case 'Lead': return `/leads/${notification.entityId}`
    case 'Client': return `/clients/${notification.entityId}`
    case 'Project': return `/projects/${notification.entityId}`
    case 'Task': return `/tasks`
    case 'Payment': return `/payments`
    case 'RecurringPayment': return `/payments`
    default: return null
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return 'עכשיו'
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`
  if (diffHours < 24) return `לפני ${diffHours} שעות`
  if (diffDays === 1) return 'אתמול'
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`
  return d.toLocaleDateString('he-IL')
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications')
      setNotifications(response.data.notifications)
      setUnreadCount(response.data.unreadCount)
    } catch {
      // Silently fail — polling will retry
    }
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refetch when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    // Optimistic mark as read
    if (!notification.isRead) {
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))

      try {
        await api.put(`/notifications/${notification.id}`)
      } catch {
        // Revert on failure
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? notification : n)
        )
        setUnreadCount(prev => prev + 1)
      }
    }

    const url = getNotificationUrl(notification)
    if (url) {
      setIsOpen(false)
      router.push(url)
    }
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id)
    if (unreadIds.length === 0) return

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)

    try {
      await api.put('/notifications', { ids: unreadIds })
    } catch {
      // Revert on failure
      fetchNotifications()
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="font-semibold">התראות</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs"
              >
                סמן הכל כנקרא
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              אין התראות חדשות
            </p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {notifications.slice(0, 10).map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell
                const color = TYPE_COLORS[notification.type] || 'text-gray-600'
                const url = getNotificationUrl(notification)

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 p-2 rounded-lg text-sm transition-colors',
                      url ? 'cursor-pointer hover:bg-gray-50' : '',
                      !notification.isRead && 'bg-blue-50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={cn('mt-0.5 shrink-0', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-medium text-gray-900 truncate',
                        !notification.isRead && 'font-bold'
                      )}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-gray-500 truncate">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
