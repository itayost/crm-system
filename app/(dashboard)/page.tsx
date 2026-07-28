'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  DollarSign,
  Briefcase,
  Users,
  CheckSquare,
  Plus,
  ArrowLeft,
  Calendar,
  Inbox,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { tone, TASK_CATEGORY_TONES, PROJECT_STATUS_TONES } from '@/lib/design/tones'
import { label, PROJECT_STATUS_LABELS } from '@/lib/design/labels'
import { formatCurrency } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT_WORK: 'עבודת לקוח',
  MARKETING: 'שיווק',
  LEAD_FOLLOWUP: 'מעקב לידים',
  ADMIN: 'מנהלה',
}

interface PendingTask {
  id: string
  title: string
  status: string
  priority: string
  category?: string
  dueDate: string | null
  project: { id: string; name: string } | null
}

interface ActiveProject {
  id: string
  name: string
  status: string
  type: string
  deadline?: string | null
  client: {
    id: string
    name: string
  } | null
  _count: {
    tasks: number
  }
}

interface DashboardData {
  revenue: number
  /** Approved but unpaid - work signed off that has not been settled. */
  outstanding: number
  contacts: {
    leads: number
    clients: number
  }
  projects: {
    active: number
    completed: number
  }
  tasks: {
    pending: number
    overdue: number
  }
  requests: {
    pendingReview: number
    open: number
  }
  activeProjects: ActiveProject[]
  pendingTasks: PendingTask[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard')
        setData(response.data)
      } catch {
        toast.error('שגיאה בטעינת נתוני דשבורד')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-content-subtle">
        <p>שגיאה בטעינת הנתונים</p>
      </div>
    )
  }

  const kpiCards = [
    {
      title: 'הכנסות',
      value: formatCurrency(data.revenue),
      // Revenue is money received; when something is signed off but unpaid,
      // that is the more actionable number to put under it.
      description:
        data.outstanding > 0
          ? `${data.outstanding.toLocaleString()} ₪ ממתין לתשלום`
          : `${data.projects.completed} פרויקטים שהושלמו`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: undefined as string | undefined,
    },
    {
      title: 'פרויקטים פעילים',
      value: String(data.projects.active),
      description: `${data.projects.completed} הושלמו`,
      icon: Briefcase,
      color: 'text-link',
      bgColor: 'bg-blue-50',
      href: '/projects',
    },
    {
      title: 'לידים בצנרת',
      value: String(data.contacts.leads),
      description: `${data.contacts.clients} לקוחות`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/contacts',
    },
    {
      title: 'משימות ממתינות',
      value: String(data.tasks.pending),
      description: data.tasks.overdue > 0
        ? `${data.tasks.overdue} באיחור`
        : 'אין משימות באיחור',
      icon: CheckSquare,
      color: data.tasks.overdue > 0 ? 'text-red-600' : 'text-orange-600',
      bgColor: data.tasks.overdue > 0 ? 'bg-red-50' : 'bg-orange-50',
      href: '/tasks',
    },
    {
      title: 'פניות לקוחות',
      value: String(data.requests.open),
      description: data.requests.pendingReview > 0
        ? `${data.requests.pendingReview} ממתינות לאישור`
        : 'אין פניות לאישור',
      icon: Inbox,
      color: data.requests.pendingReview > 0 ? 'text-red-600' : 'text-amber-600',
      bgColor: data.requests.pendingReview > 0 ? 'bg-red-50' : 'bg-amber-50',
      href: '/requests',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-content-strong">דשבורד</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push('/contacts')}>
            <Plus className="w-4 h-4 ml-2" />
            איש קשר חדש
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/projects?new=true')}
          >
            <Plus className="w-4 h-4 ml-2" />
            פרויקט חדש
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/tasks')}
          >
            <Plus className="w-4 h-4 ml-2" />
            משימה חדשה
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card
              key={kpi.title}
              className={
                kpi.href
                  ? 'cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500'
                  : ''
              }
              role={kpi.href ? 'link' : undefined}
              tabIndex={kpi.href ? 0 : undefined}
              onClick={() => kpi.href && router.push(kpi.href)}
              onKeyDown={(e) => {
                if (!kpi.href) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(kpi.href)
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-content-subtle">
                      {kpi.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-xs text-content-faint mt-1">
                      {kpi.description}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-lg ${kpi.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">המשימות הקרובות</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/tasks')}
            >
              הצג הכל
              <ArrowLeft className="w-4 h-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.pendingTasks.length === 0 ? (
              <p className="text-sm text-content-subtle text-center py-4">
                אין משימות ממתינות
              </p>
            ) : (
              <div className="space-y-3">
                {data.pendingTasks.map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-subtle cursor-pointer transition-colors"
                      onClick={() => router.push('/tasks')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          router.push('/tasks')
                        }
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-content-subtle">
                            {task.project?.name ?? 'ללא פרויקט'}
                          </span>
                          {task.category && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                tone(TASK_CATEGORY_TONES, task.category)
                              }`}
                            >
                              {CATEGORY_LABELS[task.category] ?? task.category}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-content-subtle'}`}>
                              | {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          task.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-surface-muted text-content-muted'
                        }
                        variant="secondary"
                      >
                        {task.priority === 'URGENT' ? 'דחוף' :
                         task.priority === 'HIGH' ? 'גבוה' :
                         task.priority === 'MEDIUM' ? 'בינוני' : 'נמוך'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">הפרויקטים בעבודה</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/projects')}
            >
              הצג הכל
              <ArrowLeft className="w-4 h-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.activeProjects.length === 0 ? (
              <p className="text-sm text-content-subtle text-center py-4">
                אין פרויקטים פעילים
              </p>
            ) : (
              <div className="space-y-3">
                {data.activeProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-subtle cursor-pointer transition-colors"
                    onClick={() => router.push(`/projects/${project.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        router.push(`/projects/${project.id}`)
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{project.name}</p>
                        <Badge
                          className={tone(PROJECT_STATUS_TONES, project.status)}
                          variant="secondary"
                        >
                          {label(PROJECT_STATUS_LABELS, project.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-content-subtle mt-1">
                        {project.client?.name ?? '-'} | {project._count.tasks} משימות
                      </p>
                    </div>
                    {project.deadline && (
                      <div className="flex items-center gap-1 text-xs text-content-subtle">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(project.deadline)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
