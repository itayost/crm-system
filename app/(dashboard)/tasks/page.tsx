'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Search, Check, Send, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskForm } from '@/components/forms/task-form'
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

/** Derived, so a renamed status cannot go stale in the filter but not the table. */
const ALL_OPTION = { value: 'ALL', label: 'הכל' }

const STATUS_FILTER_OPTIONS = [
  ALL_OPTION,
  ...Object.entries(TASK_STATUS_LABELS).map(([value, text]) => ({ value, label: text })),
]

const CATEGORY_FILTER_TABS = [
  ALL_OPTION,
  ...Object.entries(TASK_CATEGORY_LABELS).map(([value, text]) => ({ value, label: text })),
]

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  category?: string
  dueDate?: string | null
  projectId?: string | null
  project?: {
    id: string
    name: string
  } | null
  request?: {
    id: string
    title: string
  } | null
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [standaloneOnly, setStandaloneOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCategory, setQuickCategory] = useState('CLIENT_WORK')
  const [quickSubmitting, setQuickSubmitting] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
      if (standaloneOnly) params.set('standalone', 'true')
      if (search.trim()) params.set('search', search.trim())

      const response = await api.get(`/tasks?${params.toString()}`)
      setTasks(response.data)
    } catch {
      toast.error('שגיאה בטעינת משימות')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, standaloneOnly, search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTasks()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchTasks, search])

  // A request's detail page links here as /tasks?openTask=<id> - open that
  // task's dialog once the list is in, then drop the param from the URL.
  // window.location instead of useSearchParams keeps the page out of the
  // Suspense boundary that hook requires.
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
      // Optimistically update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: newStatus } : t
        )
      )
    } catch {
      toast.error('שגיאה בעדכון משימה')
    } finally {
      setTogglingId(null)
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

  const isOverdue = (dateStr: string | null | undefined, status: string) => {
    if (!dateStr || status === 'COMPLETED' || status === 'CANCELLED')
      return false
    try {
      return new Date(dateStr) < new Date()
    } catch {
      return false
    }
  }

  const handleQuickCapture = async () => {
    const trimmedInput = quickTitle.trim()
    if (!trimmedInput) return

    const lines = trimmedInput.split('\n')
    const title = lines[0].trim()
    const description = lines.slice(1).join('\n').trim() || undefined

    if (!title) return

    setQuickSubmitting(true)
    try {
      await api.post('/tasks', {
        title,
        description,
        category: quickCategory,
        priority: 'MEDIUM',
      })
      setQuickTitle('')
      toast.success('משימה נוצרה בהצלחה')
      fetchTasks()
    } catch {
      toast.error('שגיאה ביצירת משימה')
    } finally {
      setQuickSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">משימות</h1>
          <p className="text-sm text-content-subtle mt-1">ניהול ומעקב משימות</p>
        </div>
        <Button
          onClick={() => {
            setEditingTask(undefined)
            setShowForm(true)
          }}
        >
          <Plus className="w-4 h-4" />
          משימה חדשה
        </Button>
      </div>

      {/* Quick Capture */}
      <div className="bg-white rounded-lg border p-3">
        <div className="flex items-start gap-3">
          <textarea
            placeholder="שורה ראשונה = כותרת, שאר השורות = תיאור..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleQuickCapture()
              }
            }}
            disabled={quickSubmitting}
            rows={2}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
          <Select value={quickCategory} onValueChange={setQuickCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_FILTER_TABS.filter((t) => t.value !== 'ALL').map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleQuickCapture}
            disabled={quickSubmitting || !quickTitle.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 border-b">
        {CATEGORY_FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategoryFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              categoryFilter === tab.value
                ? 'border-link text-link'
                : 'border-transparent text-content-subtle hover:text-content-body hover:border-border-strong'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-faint w-4 h-4" />
          <Input
            type="search"
            placeholder="חיפוש משימה..."
            className="pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="standalone"
            checked={standaloneOnly}
            onCheckedChange={setStandaloneOnly}
          />
          <Label htmlFor="standalone" className="text-sm text-content-muted">
            ללא פרויקט
          </Label>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-content-subtle">
          <p className="text-lg font-medium">אין משימות</p>
          <p className="text-sm mt-1">
            {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || standaloneOnly
              ? 'לא נמצאו תוצאות'
              : 'צור משימה חדשה כדי להתחיל'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-right">כותרת</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">עדיפות</TableHead>
                <TableHead className="text-right">תאריך יעד</TableHead>
                <TableHead className="text-right">קטגוריה</TableHead>
                <TableHead className="text-right">פרויקט</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  data-testid="row"
                  data-row-id={task.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingTask(task)
                    setShowForm(true)
                  }}
                >
                  <TableCell data-col="done" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        task.status === 'COMPLETED'
                          ? 'bg-tone-success-solid border-tone-success-solid text-white'
                          : 'border-border-strong hover:border-tone-success-mark'
                      }`}
                      disabled={togglingId === task.id}
                      onClick={() => handleToggleComplete(task)}
                      aria-label={
                        task.status === 'COMPLETED'
                          ? 'סמן כלא הושלם'
                          : 'סמן כהושלם'
                      }
                    >
                      {task.status === 'COMPLETED' && (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell data-col="title">
                    <div
                      className={`font-medium ${
                        task.status === 'COMPLETED'
                          ? 'line-through text-content-faint'
                          : ''
                      }`}
                    >
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="text-xs text-content-faint mt-0.5 truncate max-w-xs">
                        {task.description.length > 60
                          ? `${task.description.slice(0, 60)}...`
                          : task.description}
                      </p>
                    )}
                    {task.request && (
                      <Link
                        href={`/requests/${task.request.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-link hover:underline mt-0.5"
                      >
                        <Inbox className="w-3 h-3" />
                        נוצרה מפניה: {task.request.title}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell data-col="status">
                    <StatusPill tone={toneOf(TASK_STATUS_TONES, task.status)} dot>
                      {label(TASK_STATUS_LABELS, task.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell data-col="priority">
                    <StatusPill
                      tone={toneOf(PRIORITY_TONES, task.priority)}
                      emphasis={emphasisOf(PRIORITY_EMPHASIS, task.priority)}
                    >
                      {label(PRIORITY_LABELS, task.priority)}
                    </StatusPill>
                  </TableCell>
                  <TableCell data-col="due">
                    <span
                      className={
                        isOverdue(task.dueDate, task.status)
                          ? 'text-tone-danger-mark font-medium'
                          : ''
                      }
                    >
                      {formatDate(task.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell data-col="category">
                    {task.category && (
                      <StatusPill tone={toneOf(TASK_CATEGORY_TONES, task.category)} emphasis="quiet" dot>
                        {label(TASK_CATEGORY_LABELS, task.category)}
                      </StatusPill>
                    )}
                  </TableCell>
                  <TableCell data-col="project" className="text-content-subtle">
                    {task.project?.name ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <TaskForm
        task={editingTask}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) {
            setEditingTask(undefined)
          }
        }}
        onSuccess={fetchTasks}
      />
    </div>
  )
}
