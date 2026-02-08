'use client'

import { useRouter } from 'next/navigation'
import {
  Plus,
  ArrowLeftRight,
  CheckCircle,
  Trash2,
  Star,
  CreditCard,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

interface Activity {
  id: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  createdAt: Date | string
}

interface ActivityTimelineProps {
  activities: Activity[]
  emptyMessage?: string
  clickable?: boolean
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LEAD_CREATED: { label: 'ליד חדש נוצר', icon: Plus, color: 'text-green-600 bg-green-100' },
  LEAD_STATUS_CHANGED: { label: 'סטטוס ליד שונה', icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-100' },
  LEAD_CONVERTED: { label: 'ליד הומר ללקוח', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  LEAD_DELETED: { label: 'ליד נמחק', icon: Trash2, color: 'text-red-600 bg-red-100' },
  CLIENT_CREATED: { label: 'לקוח חדש נוצר', icon: Plus, color: 'text-green-600 bg-green-100' },
  CLIENT_STATUS_CHANGED: { label: 'סטטוס לקוח שונה', icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-100' },
  CLIENT_TYPE_CHANGED: { label: 'סוג לקוח שונה', icon: Star, color: 'text-yellow-600 bg-yellow-100' },
  CLIENT_DELETED: { label: 'לקוח נמחק', icon: Trash2, color: 'text-red-600 bg-red-100' },
  PROJECT_CREATED: { label: 'פרויקט חדש נוצר', icon: Plus, color: 'text-green-600 bg-green-100' },
  PROJECT_STAGE_CHANGED: { label: 'שלב פרויקט שונה', icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-100' },
  PROJECT_PRIORITY_CHANGED: { label: 'עדיפות פרויקט שונתה', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
  PROJECT_DELETED: { label: 'פרויקט נמחק', icon: Trash2, color: 'text-red-600 bg-red-100' },
  TASK_CREATED: { label: 'משימה חדשה נוצרה', icon: Plus, color: 'text-green-600 bg-green-100' },
  TASK_STATUS_CHANGED: { label: 'סטטוס משימה שונה', icon: ArrowLeftRight, color: 'text-blue-600 bg-blue-100' },
  TASK_DELETED: { label: 'משימה נמחקה', icon: Trash2, color: 'text-red-600 bg-red-100' },
  PAYMENT_CREATED: { label: 'תשלום חדש נוצר', icon: CreditCard, color: 'text-green-600 bg-green-100' },
  PAYMENT_STATUS_CHANGED: { label: 'סטטוס תשלום שונה', icon: CreditCard, color: 'text-blue-600 bg-blue-100' },
  PAYMENT_DELETED: { label: 'תשלום נמחק', icon: Trash2, color: 'text-red-600 bg-red-100' },
  RECURRING_PAYMENT_CREATED: { label: 'תשלום חוזר נוצר', icon: Clock, color: 'text-purple-600 bg-purple-100' },
}

const DEFAULT_CONFIG = { label: 'פעולה', icon: FileText, color: 'text-gray-600 bg-gray-100' }

const ENTITY_ROUTES: Record<string, string> = {
  Lead: 'leads',
  Client: 'clients',
  Project: 'projects',
  Task: 'tasks',
  Payment: 'payments',
  RecurringPayment: 'payments',
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
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

function getEntityName(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null
  const name = metadata.leadName || metadata.clientName || metadata.projectName || metadata.taskTitle
  return name ? String(name) : null
}

function getMetadataDetail(action: string, metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null
  if (action.includes('STATUS_CHANGED') || action.includes('STAGE_CHANGED') || action.includes('PRIORITY_CHANGED') || action.includes('TYPE_CHANGED')) {
    const from = metadata.from as string
    const to = metadata.to as string
    if (from && to) return `${from} → ${to}`
  }
  return null
}

export function ActivityTimeline({ activities, emptyMessage = 'אין פעילויות להצגה', clickable = false }: ActivityTimelineProps) {
  const router = useRouter()

  if (activities.length === 0) {
    return <EmptyState icon={Clock} title={emptyMessage} />
  }

  const handleClick = (activity: Activity) => {
    if (!clickable || !activity.entityType || !activity.entityId) return
    const route = ENTITY_ROUTES[activity.entityType]
    if (route) {
      router.push(`/${route}/${activity.entityId}`)
    }
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const config = ACTION_CONFIG[activity.action] || DEFAULT_CONFIG
        const Icon = config.icon
        const detail = getMetadataDetail(activity.action, activity.metadata)
        const isClickable = clickable && activity.entityType && ENTITY_ROUTES[activity.entityType]

        return (
          <div
            key={activity.id}
            className={`flex items-start gap-3 ${isClickable ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-1.5 -m-1.5 transition-colors' : ''}`}
            onClick={() => handleClick(activity)}
          >
            <div className={`p-1.5 rounded-full shrink-0 ${config.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{config.label}</p>
              {detail && (
                <p className="text-xs text-gray-500">{detail}</p>
              )}
              {clickable && getEntityName(activity.metadata) && (
                <p className="text-xs text-gray-500">{getEntityName(activity.metadata)}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
