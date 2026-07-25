'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowRight,
  Edit,
  Trash2,
  Plus,
  Calendar,
  User,
  CheckSquare,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ProjectForm } from '@/components/forms/project-form'
import { TaskForm } from '@/components/forms/task-form'
import { tone, PRIORITY_TONES, PROJECT_STATUS_TONES, TASK_STATUS_TONES } from '@/lib/design/tones'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  COMPLETED: 'הושלם',
}

const TYPE_LABELS: Record<string, string> = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוך',
  MEDIUM: 'בינוני',
  HIGH: 'גבוה',
  URGENT: 'דחוף',
}

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'לביצוע',
  IN_PROGRESS: 'בתהליך',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'חודשי',
  YEARLY: 'שנתי',
}


interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
}

interface ProjectDetail {
  id: string
  name: string
  description?: string | null
  type: string
  status: string
  priority: string
  startDate?: string | null
  deadline?: string | null
  completedAt?: string | null
  price?: number | string | null
  retention?: number | string | null
  retentionFrequency?: string | null
  clientId: string
  client: { id: string; name: string } | null
  primaryContactId?: string | null
  primaryContact?: { id: string; name: string } | null
  tasks: Task[]
  createdAt: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const fetchProject = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(`/projects/${id}`)
      setProject(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי פרויקט')
      router.push('/projects')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/projects/${id}`)
      toast.success('פרויקט נמחק בהצלחה')
      router.push('/projects')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה במחיקת פרויקט')
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await api.put(`/projects/${id}`, { status: newStatus })
      toast.success('סטטוס עודכן בהצלחה')
      fetchProject()
    } catch {
      toast.error('שגיאה בעדכון סטטוס')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount == null) return '-'
    return `${Number(amount).toLocaleString()} ₪`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12 text-content-subtle">
        <p>פרויקט לא נמצא</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/projects')}
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-content-strong">
              {project.name}
            </h1>
            <Badge
              className={tone(PROJECT_STATUS_TONES, project.status)}
              variant="secondary"
            >
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
            <Badge
              className={tone(PRIORITY_TONES, project.priority)}
              variant="secondary"
            >
              {PRIORITY_LABELS[project.priority] ?? project.priority}
            </Badge>
          </div>
          <p className="text-sm text-content-subtle mt-1">
            {TYPE_LABELS[project.type] ?? project.type}
          </p>
        </div>

        <div className="flex gap-2">
          {project.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('COMPLETED')}
            >
              <CheckSquare className="w-4 h-4 ml-2" />
              סמן כהושלם
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={updatingStatus}
              onClick={() => handleStatusChange('ACTIVE')}
            >
              הפעל מחדש
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="w-4 h-4 ml-2" />
                מחיקה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת פרויקט</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את הפרויקט &quot;{project.name}
                  &quot;? פעולה זו אינה ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  מחק
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי הפרויקט</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Client (business) */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">לקוח:</span>
                {project.client ? (
                  <button
                    className="text-sm font-medium text-link hover:underline"
                    onClick={() => router.push(`/clients/${project.client!.id}`)}
                  >
                    {project.client.name}
                  </button>
                ) : (
                  <span className="text-sm font-medium">-</span>
                )}
                {project.primaryContact && (
                  <span className="text-xs text-content-subtle">
                    · {project.primaryContact.name}
                  </span>
                )}
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">תאריך התחלה:</span>
                <span className="text-sm font-medium">
                  {formatDate(project.startDate)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">דדליין:</span>
                <span className="text-sm font-medium">
                  {formatDate(project.deadline)}
                </span>
              </div>
              {project.completedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-content-faint" />
                  <span className="text-sm text-content-muted">הושלם:</span>
                  <span className="text-sm font-medium">
                    {formatDate(project.completedAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Price */}
              <div>
                <span className="text-sm text-content-muted">מחיר: </span>
                <span className="text-sm font-bold text-green-700">
                  {formatCurrency(project.price)}
                </span>
              </div>

              {/* Retention */}
              {project.retention != null && Number(project.retention) > 0 && (
                <div>
                  <span className="text-sm text-content-muted">ריטיינר: </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(project.retention)}{' '}
                    {project.retentionFrequency
                      ? `(${FREQUENCY_LABELS[project.retentionFrequency] ?? project.retentionFrequency})`
                      : ''}
                  </span>
                </div>
              )}

              {/* Created */}
              <div>
                <span className="text-sm text-content-muted">נוצר: </span>
                <span className="text-sm font-medium">
                  {formatDate(project.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {project.description && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-content-muted mb-1">תיאור:</p>
              <p className="text-sm whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>משימות</CardTitle>
          <Button size="sm" onClick={() => setShowTaskForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            משימה חדשה
          </Button>
        </CardHeader>
        <CardContent>
          {project.tasks.length === 0 ? (
            <p className="text-sm text-content-subtle text-center py-6">
              אין משימות עדיין
            </p>
          ) : (
            <div className="space-y-3">
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                  onClick={() => router.push(`/tasks`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      router.push(`/tasks`)
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare
                      className={`w-4 h-4 ${
                        task.status === 'COMPLETED'
                          ? 'text-green-500'
                          : 'text-content-faint'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        task.status === 'COMPLETED'
                          ? 'line-through text-content-faint'
                          : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    <Badge
                      className={tone(TASK_STATUS_TONES, task.status)}
                      variant="secondary"
                    >
                      {TASK_STATUS_LABELS[task.status] ?? task.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-content-subtle">
                    <Badge
                      className={tone(PRIORITY_TONES, task.priority)}
                      variant="secondary"
                    >
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span>{formatDate(task.dueDate)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Form Dialog */}
      <ProjectForm
        project={project}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={fetchProject}
      />

      {/* Task Form Dialog */}
      <TaskForm
        defaultProjectId={project.id}
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSuccess={fetchProject}
      />
    </div>
  )
}
