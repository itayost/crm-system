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

const STATUS_LABELS: Record<string, string> = {
  NEW: 'חדש',
  CONTACTED: 'נוצר קשר',
  QUOTED: 'הוצעה הצעה',
  NEGOTIATING: 'במשא ומתן',
  CLIENT: 'לקוח',
  INACTIVE: 'לא פעיל',
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUOTED: 'bg-purple-100 text-purple-800',
  NEGOTIATING: 'bg-orange-100 text-orange-800',
  CLIENT: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'טיוטה',
  IN_PROGRESS: 'בתהליך',
  ON_HOLD: 'מושהה',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT_WORK: 'עבודת לקוח',
  MARKETING: 'שיווק',
  LEAD_FOLLOWUP: 'מעקב לידים',
  ADMIN: 'מנהלה',
}

const CATEGORY_COLORS: Record<string, string> = {
  CLIENT_WORK: 'bg-blue-100 text-blue-700',
  MARKETING: 'bg-purple-100 text-purple-700',
  LEAD_FOLLOWUP: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-gray-100 text-gray-700',
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
  contact: {
    id: string
    name: string
  }
  _count: {
    tasks: number
  }
}

interface DashboardData {
  revenue: number
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
  recentContacts: unknown[]
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

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ₪`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="text-center py-12 text-gray-500">
        <p>שגיאה בטעינת הנתונים</p>
      </div>
    )
  }

  const kpiCards = [
    {
      title: 'הכנסות',
      value: formatCurrency(data.revenue),
      description: `${data.projects.completed} פרויקטים שהושלמו`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'פרויקטים פעילים',
      value: String(data.projects.active),
      description: `${data.projects.completed} הושלמו`,
      icon: Briefcase,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'לידים בצנרת',
      value: String(data.contacts.leads),
      description: `${data.contacts.clients} לקוחות`,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
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
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {kpi.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-xs text-gray-400 mt-1">
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
            <CardTitle className="text-lg">משימות ממתינות</CardTitle>
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
              <p className="text-sm text-gray-500 text-center py-4">
                אין משימות ממתינות
              </p>
            ) : (
              <div className="space-y-3">
                {data.pendingTasks.map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
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
                          <span className="text-xs text-gray-500">
                            {task.project?.name ?? 'ללא פרויקט'}
                          </span>
                          {task.category && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                CATEGORY_COLORS[task.category] ?? ''
                              }`}
                            >
                              {CATEGORY_LABELS[task.category] ?? task.category}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
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
                          'bg-gray-100 text-gray-600'
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
            <CardTitle className="text-lg">פרויקטים פעילים</CardTitle>
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
              <p className="text-sm text-gray-500 text-center py-4">
                אין פרויקטים פעילים
              </p>
            ) : (
              <div className="space-y-3">
                {data.activeProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
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
                          className={
                            PROJECT_STATUS_COLORS[project.status] ?? ''
                          }
                          variant="secondary"
                        >
                          {PROJECT_STATUS_LABELS[project.status] ??
                            project.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {project.contact.name} | {project._count.tasks} משימות
                      </p>
                    </div>
                    {project.deadline && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
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
