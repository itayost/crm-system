'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Edit, Trash2, Calendar, User, CheckSquare, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
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
import { PhasesCard } from '@/components/projects/phases-card'
import { ProjectTasksCard } from '@/components/projects/project-tasks-card'
import { RequestListCard, type RequestListItem } from '@/components/requests/request-list-card'
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  PROJECT_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
  RETENTION_FREQUENCY_LABELS,
} from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { projectTotal } from '@/lib/utils/project-money'
import type { ProjectRecord } from '@/lib/types/project'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [requests, setRequests] = useState<RequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const fetchProject = useCallback(async () => {
    setLoading(true)
    try {
      // In parallel: the פניות card must not wait on the project request.
      const [projectRes, requestsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/requests?projectId=${id}`),
      ])
      setProject(projectRes.data)
      setRequests(requestsRes.data)
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
            <StatusPill tone={toneOf(PROJECT_STATUS_TONES, project.status)} dot>
              {label(PROJECT_STATUS_LABELS, project.status)}
            </StatusPill>
            <StatusPill
              tone={toneOf(PRIORITY_TONES, project.priority)}
              emphasis={emphasisOf(PRIORITY_EMPHASIS, project.priority)}
            >
              {label(PRIORITY_LABELS, project.priority)}
            </StatusPill>
          </div>
          <p className="text-sm text-content-subtle mt-1">
            {label(PROJECT_TYPE_LABELS, project.type)}
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
              <CheckSquare className="w-4 h-4" />
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
          {/* The agent config page was reachable only by typing its URL:
              nothing linked to it, while it linked back. */}
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${project.id}/agent`}>
              <Activity className="w-4 h-4" />
              ניטור
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="w-4 h-4" />
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
              {/* Total - the advance plus every phase, so it moves as phases
                  are added rather than being a figure typed once. */}
              <div>
                <span className="text-sm text-content-muted">סה&quot;כ: </span>
                <span className="text-sm font-bold text-figure-paid">
                  {formatCurrency(projectTotal(project.advanceAmount, project.phases))}
                </span>
              </div>

              {/* Retention */}
              {project.retention != null && Number(project.retention) > 0 && (
                <div>
                  <span className="text-sm text-content-muted">ריטיינר: </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(project.retention)}{' '}
                    {project.retentionFrequency
                      ? `(${label(RETENTION_FREQUENCY_LABELS, project.retentionFrequency)})`
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

      <PhasesCard
        projectId={project.id}
        phases={project.phases}
        advanceAmount={project.advanceAmount}
        advancePaidAt={project.advancePaidAt}
        onChanged={fetchProject}
      />

      <ProjectTasksCard tasks={project.tasks} onAdd={() => setShowTaskForm(true)} />

      {/* The פניות already linked to this project. No "new" button: RequestForm
          takes a defaultClientId but not a defaultProjectId. */}
      <RequestListCard requests={requests} emptyText="אין פניות לפרויקט זה" />

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
