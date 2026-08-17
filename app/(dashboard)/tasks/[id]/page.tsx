'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Edit, Trash2, Inbox, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { TaskForm } from '@/components/forms/task-form'
import { DetailHeader, FactRail, ConfirmDelete, EmptyState, TonePanel, type Fact } from '@/components/patterns'
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  TASK_CATEGORY_TONES,
  TASK_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  PRIORITY_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/design/labels'
import { formatDate } from '@/lib/utils'

interface TaskDetail {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  category?: string | null
  dueDate?: string | null
  createdAt: string
  completedAt?: string | null
  project?: { id: string; name: string; client?: { id: string; name: string } | null } | null
  request?: {
    id: string
    title: string
    description?: string | null
    intake?: Record<string, unknown> | null
    source?: string
  } | null
}

const INTAKE_LABELS: Record<string, string> = {
  whatHappened: 'מה קרה',
  whenStarted: 'מתי התחיל',
  whereInProduct: 'איפה במוצר',
  whoAffected: 'את מי זה משפיע',
  stepsToReproduce: 'איך לשחזר',
  expected: 'מה ציפו שיקרה',
  impact: 'ההשפעה',
}

/**
 * "מה בדיוק צריך לעשות, ומאיפה זה בא."
 *
 * The reason this route exists: every other list in the app navigates on row
 * click, and /tasks alone opened an edit dialog - so a task was the one entity
 * with no address of its own, nothing to link to and nothing to send anyone.
 *
 * What earns the page is the last block. When a task came from a request, it
 * quotes the client's own words rather than linking to them, so you never have
 * to bounce to the request to remember what was actually asked for.
 */
export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchTask = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tasks/${id}`)
      setTask(data)
    } catch {
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  const toggleComplete = async () => {
    if (!task) return
    setBusy(true)
    try {
      const next = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED'
      await api.put(`/tasks/${task.id}`, { status: next })
      toast.success(next === 'COMPLETED' ? 'המשימה הושלמה' : 'המשימה הוחזרה לביצוע')
      fetchTask()
    } catch {
      toast.error('שגיאה בעדכון המשימה')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/tasks/${id}`)
      toast.success('המשימה נמחקה')
      router.push('/tasks')
    } catch {
      toast.error('שגיאה במחיקת המשימה')
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-64" />
        <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
          <Skeleton className="h-48" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <EmptyState
        kind="filtered"
        title="המשימה לא נמצאה"
        description="ייתכן שהיא נמחקה."
        action={
          <Button asChild size="sm">
            <Link href="/tasks">חזרה למשימות</Link>
          </Button>
        }
      />
    )
  }

  const done = task.status === 'COMPLETED'
  const intake = (task.request?.intake ?? null) as Record<string, unknown> | null

  const facts: Fact[] = [
    {
      term: 'סטטוס',
      value: (
        <StatusPill tone={toneOf(TASK_STATUS_TONES, task.status)} dot>
          {label(TASK_STATUS_LABELS, task.status)}
        </StatusPill>
      ),
    },
    {
      term: 'עדיפות',
      value: (
        <StatusPill
          tone={toneOf(PRIORITY_TONES, task.priority)}
          emphasis={emphasisOf(PRIORITY_EMPHASIS, task.priority)}
        >
          {label(PRIORITY_LABELS, task.priority)}
        </StatusPill>
      ),
    },
    {
      term: 'קטגוריה',
      hideWhenEmpty: true,
      value: task.category && (
        <StatusPill tone={toneOf(TASK_CATEGORY_TONES, task.category)} emphasis="quiet" dot>
          {label(TASK_CATEGORY_LABELS, task.category)}
        </StatusPill>
      ),
    },
    {
      term: 'פרויקט',
      hideWhenEmpty: true,
      value: task.project && (
        <span className="flex flex-col gap-0.5">
          <Link href={`/projects/${task.project.id}`} className="text-link hover:underline">
            {task.project.name}
          </Link>
          {task.project.client && (
            <Link
              href={`/clients/${task.project.client.id}`}
              className="text-content-subtle hover:underline"
            >
              {task.project.client.name}
            </Link>
          )}
        </span>
      ),
    },
    {
      term: 'תאריך יעד',
      value: <bdi className="font-mono tabular-nums">{formatDate(task.dueDate)}</bdi>,
    },
    {
      term: 'נוצרה',
      value: (
        <bdi data-volatile className="font-mono tabular-nums">
          {formatDate(task.createdAt)}
        </bdi>
      ),
    },
    {
      term: 'מקור',
      hideWhenEmpty: true,
      value: task.request && (
        <Link href={`/requests/${task.request.id}`} className="text-link hover:underline">
          פנייה של לקוח
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <DetailHeader
        backHref="/tasks"
        breadcrumb="משימות /"
        title={task.title}
        pills={
          done ? (
            <StatusPill tone="success" dot>
              הושלמה
            </StatusPill>
          ) : null
        }
        primaryAction={
          <Button size="sm" disabled={busy} onClick={toggleComplete}>
            {done ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
            {done ? 'החזר לביצוע' : 'סמן כהושלם'}
          </Button>
        }
        menu={
          <>
            <DropdownMenuItem onClick={() => setShowForm(true)}>
              <Edit className="size-4" />
              עריכה
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-tone-danger-foreground"
            >
              <Trash2 className="size-4" />
              מחיקה
            </DropdownMenuItem>
          </>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-ui-sm font-semibold text-content-strong">מה צריך לעשות</h2>
            {task.description ? (
              <p className="whitespace-pre-wrap text-ui-sm text-content-body">{task.description}</p>
            ) : (
              <p className="text-ui-sm text-content-faint">אין תיאור.</p>
            )}
          </section>

          {/* The block that earns this page. */}
          {task.request && (
            <TonePanel tone="info" title="מה הלקוח ביקש">
              <div className="flex flex-col gap-3">
                <Link
                  href={`/requests/${task.request.id}`}
                  className="inline-flex w-max items-center gap-1.5 text-ui-sm font-medium text-link hover:underline"
                >
                  <Inbox className="size-3.5" />
                  {task.request.title}
                </Link>

                {task.request.description && (
                  <blockquote className="border-s-2 border-[hsl(var(--t-mark)/0.4)] ps-3 text-ui-sm text-content-body">
                    <p className="whitespace-pre-wrap">{task.request.description}</p>
                  </blockquote>
                )}

                {intake && Object.keys(intake).length > 0 && (
                  <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {Object.entries(intake)
                      .filter(([, v]) => typeof v === 'string' && v.trim())
                      .map(([key, value]) => (
                        <div key={key} className="flex flex-col">
                          <dt className="text-ui-2xs text-content-subtle">
                            {INTAKE_LABELS[key] ?? key}
                          </dt>
                          <dd className="text-ui-sm text-content-body">{String(value)}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            </TonePanel>
          )}
        </div>

        <FactRail facts={facts} className="lg:sticky lg:top-3" />
      </div>

      <TaskForm
        task={{
          ...task,
          category: task.category ?? undefined,
          projectId: task.project?.id ?? null,
        }}
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchTask}
      />

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        pending={busy}
        title="מחיקת משימה"
        description={`למחוק את "${task.title}"? הפעולה אינה ניתנת לביטול.`}
        onConfirm={remove}
      />
    </div>
  )
}
