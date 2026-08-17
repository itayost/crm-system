'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Check, Send, Inbox, ListTodo, X } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskForm } from '@/components/forms/task-form'
import {
  PageHeader,
  SearchField,
  SegmentControl,
  DataTable,
  EmptyState,
  TableSkeleton,
  type Column,
  type Segment,
} from '@/components/patterns'
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

const CATEGORY_OPTIONS = Object.entries(TASK_CATEGORY_LABELS).map(([value, text]) => ({
  value,
  label: text,
}))

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  category?: string
  dueDate?: string | null
  projectId?: string | null
  project?: { id: string; name: string } | null
  request?: { id: string; title: string } | null
}

type View = 'today' | 'open' | 'done' | 'all'

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS']

function isDueByToday(iso?: string | null) {
  if (!iso) return false
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return new Date(iso) <= end
}

function isOverdue(iso: string | null | undefined, status: string) {
  if (!iso || status === 'COMPLETED' || status === 'CANCELLED') return false
  return new Date(iso) < new Date()
}

/**
 * "מה על השולחן שלי היום."
 *
 * This page carried three different filter idioms stacked on top of each other
 * - a hand-rolled underline tab strip for category, a Select for status and a
 * Switch for standalone - about 140px of chrome in three visual languages,
 * doing one job. Now: one segment row (which pile am I working from) plus
 * facets (narrowing inside it). "ללא פרויקט" is a value of the project facet
 * rather than a third control of its own.
 */
export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('open')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [capturing, setCapturing] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCategory, setQuickCategory] = useState('CLIENT_WORK')
  const [quickSubmitting, setQuickSubmitting] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const response = await api.get(`/tasks?${params.toString()}`)
      setTasks(response.data)
    } catch {
      toast.error('שגיאה בטעינת משימות')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTasks()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchTasks, search])

  // A request's detail page links here as /tasks?openTask=<id>.
  const openedFromQuery = useRef(false)
  useEffect(() => {
    if (loading || openedFromQuery.current) return
    const openTaskId = new URLSearchParams(window.location.search).get('openTask')
    if (!openTaskId) return
    openedFromQuery.current = true
    const task = tasks.find((t) => t.id === openTaskId)
    if (task) {
      setEditingTask(task)
      setShowForm(true)
    }
    router.replace('/tasks')
  }, [loading, tasks, router])

  const handleToggleComplete = async (task: Task) => {
    setTogglingId(task.id)
    try {
      const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED'
      await api.put(`/tasks/${task.id}`, { status: newStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    } catch {
      toast.error('שגיאה בעדכון משימה')
    } finally {
      setTogglingId(null)
    }
  }

  const handleQuickCapture = async () => {
    const trimmed = quickTitle.trim()
    if (!trimmed) return
    const lines = trimmed.split('\n')
    const title = lines[0].trim()
    const description = lines.slice(1).join('\n').trim() || undefined
    if (!title) return

    setQuickSubmitting(true)
    try {
      await api.post('/tasks', { title, description, category: quickCategory, priority: 'MEDIUM' })
      setQuickTitle('')
      setCapturing(false)
      toast.success('משימה נוצרה בהצלחה')
      fetchTasks()
    } catch {
      toast.error('שגיאה ביצירת משימה')
    } finally {
      setQuickSubmitting(false)
    }
  }

  const buckets = useMemo(() => {
    const open = tasks.filter((t) => OPEN_STATUSES.includes(t.status))
    return {
      today: open.filter((t) => isDueByToday(t.dueDate)),
      open,
      done: tasks.filter((t) => t.status === 'COMPLETED'),
      all: tasks,
    }
  }, [tasks])

  const segments: Segment[] = [
    { value: 'today', label: 'היום', count: buckets.today.length },
    { value: 'open', label: 'פתוחות', count: buckets.open.length },
    { value: 'done', label: 'הושלמו', count: buckets.done.length },
    { value: 'all', label: 'הכל', count: buckets.all.length },
  ]

  const projects = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tasks) if (t.project) seen.set(t.project.id, t.project.name)
    return [...seen.entries()]
  }, [tasks])

  const rows = useMemo(() => {
    let list = buckets[view]
    if (categoryFilter !== 'ALL') list = list.filter((t) => t.category === categoryFilter)
    if (projectFilter === 'NONE') list = list.filter((t) => !t.projectId)
    else if (projectFilter !== 'ALL') list = list.filter((t) => t.projectId === projectFilter)

    const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
    return [...list].sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      if (ad !== bd) return ad - bd
      return order.indexOf(a.priority) - order.indexOf(b.priority)
    })
  }, [buckets, view, categoryFilter, projectFilter])

  const columns: Column<Task>[] = [
    {
      key: 'done',
      header: '',
      width: '2.5rem',
      cell: (task) => (
        <button
          type="button"
          role="checkbox"
          aria-checked={task.status === 'COMPLETED'}
          disabled={togglingId === task.id}
          onClick={(e) => {
            e.stopPropagation()
            handleToggleComplete(task)
          }}
          aria-label={task.status === 'COMPLETED' ? 'סמן כלא הושלם' : 'סמן כהושלם'}
          className={`grid size-4 place-items-center rounded-sm border transition-colors duration-fast ${
            task.status === 'COMPLETED'
              ? 'border-tone-success-solid bg-tone-success-solid text-white'
              : 'border-border-strong hover:border-tone-success-mark'
          }`}
        >
          {task.status === 'COMPLETED' && <Check className="size-2.5" />}
        </button>
      ),
    },
    {
      key: 'title',
      header: 'כותרת',
      mobile: 'primary',
      cell: (task) => (
        <span className="flex flex-col gap-0.5">
          <span className={task.status === 'COMPLETED' ? 'text-content-faint line-through' : ''}>
            {task.title}
          </span>
          {task.request && (
            <Link
              href={`/requests/${task.request.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex w-max items-center gap-1 text-ui-2xs text-link hover:underline"
            >
              <Inbox className="size-3" />
              נוצרה מפניה: {task.request.title}
            </Link>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      mobile: 'trailing',
      cell: (task) => (
        <StatusPill tone={toneOf(TASK_STATUS_TONES, task.status)} dot>
          {label(TASK_STATUS_LABELS, task.status)}
        </StatusPill>
      ),
    },
    {
      key: 'priority',
      header: 'עדיפות',
      width: '6rem',
      cell: (task) => (
        <StatusPill
          tone={toneOf(PRIORITY_TONES, task.priority)}
          emphasis={emphasisOf(PRIORITY_EMPHASIS, task.priority)}
        >
          {label(PRIORITY_LABELS, task.priority)}
        </StatusPill>
      ),
    },
    {
      key: 'due',
      header: 'תאריך יעד',
      align: 'numeric',
      width: '7rem',
      mobile: 'meta',
      cell: (task) => (
        <bdi
          className={
            isOverdue(task.dueDate, task.status)
              ? 'font-semibold text-tone-danger-foreground'
              : undefined
          }
        >
          {formatDate(task.dueDate)}
        </bdi>
      ),
    },
    {
      key: 'category',
      header: 'קטגוריה',
      width: '7rem',
      cell: (task) =>
        task.category ? (
          <StatusPill tone={toneOf(TASK_CATEGORY_TONES, task.category)} emphasis="quiet" dot>
            {label(TASK_CATEGORY_LABELS, task.category)}
          </StatusPill>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'project',
      header: 'פרויקט',
      mobile: 'meta',
      cell: (task) => task.project?.name ?? '-',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="משימות"
        count={loading ? undefined : `${rows.length} מתוך ${tasks.length}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setCapturing((c) => !c)}>
              <Send className="size-4" />
              לכידה מהירה
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingTask(undefined)
                setShowForm(true)
              }}
            >
              <Plus className="size-4" />
              משימה חדשה
            </Button>
          </>
        }
      />

      {/* Summoned, not permanent. It used to occupy ~70px above the filters
          whether or not anyone was capturing anything. */}
      {capturing && (
        <div className="flex items-start gap-2 rounded-lg border bg-card p-2">
          <Textarea
            autoFocus
            rows={2}
            placeholder="שורה ראשונה = כותרת, שאר השורות = תיאור..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleQuickCapture()
              }
              if (e.key === 'Escape') setCapturing(false)
            }}
            disabled={quickSubmitting}
            className="flex-1 resize-none text-ui-sm"
          />
          <Select value={quickCategory} onValueChange={setQuickCategory}>
            <SelectTrigger className="h-control w-36 text-ui-sm" aria-label="קטגוריה ללכידה">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleQuickCapture}
            disabled={quickSubmitting || !quickTitle.trim()}
            aria-label="צור משימה"
          >
            <Send className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCapturing(false)} aria-label="סגירה">
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SegmentControl segments={segments} value={view} onChange={(v) => setView(v as View)} />
        <SearchField value={search} onChange={setSearch} placeholder="חיפוש משימה..." />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-control w-32 text-ui-sm" aria-label="קטגוריה">
            <SelectValue placeholder="קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הקטגוריות</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-control w-36 text-ui-sm" aria-label="פרויקט">
            <SelectValue placeholder="פרויקט" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הפרויקטים</SelectItem>
            <SelectItem value="NONE">ללא פרויקט</SelectItem>
            {projects.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        view === 'today' ? (
          <EmptyState
            kind="calm"
            title="אין משימות להיום"
            description="שום דבר לא בוער. אפשר לדחוף פרויקט קדימה."
          />
        ) : search ? (
          <EmptyState
            kind="filtered"
            title="לא נמצאו תוצאות"
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                נקה חיפוש
              </Button>
            }
          />
        ) : (
          <EmptyState
            kind="new"
            icon={ListTodo}
            title="אין משימות בתצוגה הזו"
            action={
              <Button size="sm" onClick={() => setCapturing(true)}>
                <Send className="size-4" />
                לכידה מהירה
              </Button>
            }
          />
        )
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(t) => t.id}
          // No href yet: /tasks/[id] is the last piece of this phase. Until it
          // exists the row opens the editor, which is the one remaining
          // inconsistency with every other list in the app.
          onRowClick={(task) => {
            setEditingTask(task)
            setShowForm(true)
          }}
        />
      )}

      <TaskForm
        task={editingTask}
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchTasks}
      />
    </div>
  )
}
