'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowRight,
  Edit,
  Trash2,
  Check,
  X,
  User,
  Calendar,
  FolderOpen,
  CheckSquare,
  Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { RequestForm } from '@/components/forms/request-form'
import { IntakeDetails } from '@/components/requests/intake-details'
import { IntakeEditForm } from '@/components/requests/intake-edit-form'
import { AttachmentLinks } from '@/components/requests/attachment-links'
import { SourceBadge, AiBadge } from '@/components/requests/request-badges'
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_TONES,
  TASK_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/design/labels'
import type { RequestRecord, RequestStatus } from '@/lib/types/request'

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [request, setRequest] = useState<RequestRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingIntake, setEditingIntake] = useState(false)
  const [acting, setActing] = useState(false)

  const fetchRequest = useCallback(async () => {
    try {
      const response = await api.get(`/requests/${id}`)
      setRequest(response.data)
    } catch {
      toast.error('שגיאה בטעינת הפניה')
      router.push('/requests')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  const showApiError = (error: unknown, fallback: string) => {
    const axiosError = error as { response?: { data?: { error?: string } } }
    toast.error(axiosError.response?.data?.error ?? fallback)
  }

  // approve/dismiss go through the action route; approve creates the task and
  // messages the client, so the fresh record (with its task) needs a refetch.
  const handleAction = async (action: 'approve' | 'dismiss') => {
    if (acting) return
    setActing(true)
    try {
      await api.post(`/requests/${id}/action`, { action })
      toast.success(action === 'approve' ? 'הפניה אושרה' : 'הפניה נדחתה')
      await fetchRequest()
    } catch (error: unknown) {
      showApiError(error, 'שגיאה בעדכון הפניה')
    } finally {
      setActing(false)
    }
  }

  const handleStatusChange = async (status: RequestStatus) => {
    if (acting) return
    setActing(true)
    try {
      const response = await api.put(`/requests/${id}`, { status })
      setRequest(response.data)
      toast.success('הסטטוס עודכן')
    } catch (error: unknown) {
      showApiError(error, 'שגיאה בעדכון סטטוס')
    } finally {
      setActing(false)
    }
  }

  const handleDelete = async () => {
    setActing(true)
    try {
      await api.delete(`/requests/${id}`)
      toast.success('הפניה נמחקה')
      router.push('/requests')
    } catch (error: unknown) {
      showApiError(error, 'שגיאה במחיקת הפניה')
      setActing(false)
    }
  }

  const openAttachment = async (path: string) => {
    const tab = window.open('', '_blank')
    if (!tab) {
      toast.error('הדפדפן חסם את פתיחת הקובץ. אפשרו חלונות קופצים ונסו שוב')
      return
    }
    try {
      const { data } = await api.get(`/requests/${id}/attachment?path=${encodeURIComponent(path)}`)
      tab.location.href = data.url
    } catch {
      tab.close()
      toast.error('שגיאה בפתיחת הקובץ')
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-12 text-content-subtle">
        <p>פניה לא נמצאה</p>
      </div>
    )
  }

  const isPending = request.status === 'PENDING_REVIEW'
  const hasIntakeContent =
    !!request.intake &&
    Object.values(request.intake).some((value) => value !== null && value !== '')

  const statusActions: Array<{ label: string; status: RequestStatus }> =
    request.status === 'OPEN'
      ? [
          { label: 'התחל טיפול', status: 'IN_PROGRESS' },
          { label: 'סמן כטופל', status: 'RESOLVED' },
        ]
      : request.status === 'IN_PROGRESS'
        ? [
            { label: 'סמן כטופל', status: 'RESOLVED' },
            { label: 'החזר לפתוח', status: 'OPEN' },
          ]
        : request.status === 'RESOLVED' || request.status === 'DISMISSED'
          ? [{ label: 'פתח מחדש', status: 'OPEN' }]
          : []

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/requests')}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-content-strong">{request.title}</h1>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={toneOf(REQUEST_STATUS_TONES, request.status)} dot>
              {label(REQUEST_STATUS_LABELS, request.status)}
            </StatusPill>
            <StatusPill
              tone={toneOf(PRIORITY_TONES, request.priority)}
              emphasis={emphasisOf(PRIORITY_EMPHASIS, request.priority)}
            >
              {label(PRIORITY_LABELS, request.priority)}
            </StatusPill>
            <StatusPill tone={toneOf(REQUEST_TYPE_TONES, request.type)} emphasis="quiet" dot>
              {label(REQUEST_TYPE_LABELS, request.type)}
            </StatusPill>
            <SourceBadge source={request.source} showManual />
            <AiBadge
              isAiGenerated={request.isAiGenerated}
              aiConfidence={request.aiConfidence}
              aiNote={request.aiNote}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={acting}>
                <Trash2 className="w-4 h-4 ml-2" />
                מחיקה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת פניה</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את הפניה &quot;{request.title}&quot;? הקבצים
                  המצורפים יימחקו גם הם. פעולה זו אינה ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>מחק</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isPending ? (
          <>
            <Button size="sm" disabled={acting} onClick={() => handleAction('approve')}>
              <Check className="w-4 h-4 ml-1" />
              אשר
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={acting}
              onClick={() => handleAction('dismiss')}
            >
              <X className="w-4 h-4 ml-1" />
              דחה
            </Button>
            <span className="text-xs text-content-subtle">
              יש לאשר את הפניה לפני שניתן לטפל בה
            </span>
          </>
        ) : (
          statusActions.map((action) => (
            <Button
              key={action.status + action.label}
              size="sm"
              variant="outline"
              disabled={acting}
              onClick={() => handleStatusChange(action.status)}
            >
              {action.label}
            </Button>
          ))
        )}
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>פרטים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-content-faint" />
              <span className="text-sm text-content-muted">לקוח:</span>
              {request.client ? (
                <button
                  className="text-sm font-medium text-link hover:underline"
                  onClick={() => router.push(`/clients/${request.client!.id}`)}
                >
                  {request.client.name}
                </button>
              ) : (
                <span className="text-sm font-medium">-</span>
              )}
              {request.contact && (
                <span className="text-xs text-content-subtle">· {request.contact.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-content-faint" />
              <span className="text-sm text-content-muted">פרויקט:</span>
              {request.project ? (
                <button
                  className="text-sm font-medium text-link hover:underline"
                  onClick={() => router.push(`/projects/${request.project!.id}`)}
                >
                  {request.project.name}
                </button>
              ) : (
                <span className="text-sm font-medium">-</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-content-faint" />
              <span className="text-sm text-content-muted">נוצרה:</span>
              <span className="text-sm font-medium">{formatDate(request.createdAt)}</span>
            </div>
            {request.resolvedAt && (
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">טופלה:</span>
                <span className="text-sm font-medium">{formatDate(request.resolvedAt)}</span>
              </div>
            )}
          </div>
          {request.aiNote && (
            <p className="text-xs text-content-subtle mt-4 whitespace-pre-wrap">
              הערת הסוכן: {request.aiNote}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {request.description && (
        <Card>
          <CardHeader>
            <CardTitle>תיאור</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{request.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Intake */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>פרטי הפניה</CardTitle>
          {!editingIntake && (
            <Button variant="outline" size="sm" onClick={() => setEditingIntake(true)}>
              <Pencil className="w-4 h-4 ml-2" />
              עריכה
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingIntake ? (
            <IntakeEditForm
              requestId={request.id}
              intake={request.intake}
              onSaved={(updated) => {
                setRequest(updated)
                setEditingIntake(false)
              }}
              onCancel={() => setEditingIntake(false)}
            />
          ) : hasIntakeContent ? (
            <IntakeDetails intake={request.intake} />
          ) : (
            <p className="text-sm text-content-subtle">
              אין פרטי טופס עדיין - לחץ עריכה כדי להוסיף
            </p>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {request.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>קבצים מצורפים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <AttachmentLinks attachments={request.attachments} onOpen={openAttachment} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked task */}
      {(request.task || !isPending) && (
        <Card>
          <CardHeader>
            <CardTitle>משימה מקושרת</CardTitle>
          </CardHeader>
          <CardContent>
            {request.task ? (
              <div className="flex items-center gap-3">
                <StatusPill tone={toneOf(TASK_STATUS_TONES, request.task.status)} dot>
                  {label(TASK_STATUS_LABELS, request.task.status)}
                </StatusPill>
                <span className="text-sm font-medium">{request.task.title}</span>
                <button
                  className="text-sm text-link hover:underline"
                  onClick={() => router.push(`/tasks?openTask=${request.task!.id}`)}
                >
                  פתח משימה
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-content-subtle">אין משימה לפניה זו</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting}
                  onClick={() => handleAction('approve')}
                >
                  צור משימה
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RequestForm
        request={request}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={fetchRequest}
      />
    </div>
  )
}
