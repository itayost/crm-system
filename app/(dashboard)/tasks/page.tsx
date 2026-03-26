'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Search, Check, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

const STATUS_LABELS: Record<string, string> = {
  TODO: 'לביצוע',
  IN_PROGRESS: 'בתהליך',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוך',
  MEDIUM: 'בינוני',
  HIGH: 'גבוה',
  URGENT: 'דחוף',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
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

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'הכל' },
  { value: 'TODO', label: 'לביצוע' },
  { value: 'IN_PROGRESS', label: 'בתהליך' },
  { value: 'COMPLETED', label: 'הושלם' },
  { value: 'CANCELLED', label: 'בוטל' },
]

const CATEGORY_FILTER_TABS = [
  { value: 'ALL', label: 'הכל' },
  { value: 'CLIENT_WORK', label: 'עבודת לקוח' },
  { value: 'MARKETING', label: 'שיווק' },
  { value: 'LEAD_FOLLOWUP', label: 'מעקב לידים' },
  { value: 'ADMIN', label: 'מנהלה' },
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
}

export default function TasksPage() {
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
    const trimmedTitle = quickTitle.trim()
    if (!trimmedTitle) return

    setQuickSubmitting(true)
    try {
      await api.post('/tasks', {
        title: trimmedTitle,
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
          <h1 className="text-2xl font-bold text-gray-900">משימות</h1>
          <p className="text-sm text-gray-500 mt-1">ניהול ומעקב משימות</p>
        </div>
        <Button
          onClick={() => {
            setEditingTask(undefined)
            setShowForm(true)
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          משימה חדשה
        </Button>
      </div>

      {/* Quick Capture */}
      <div className="bg-white rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="משימה חדשה..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleQuickCapture()
              }
            }}
            disabled={quickSubmitting}
            className="flex-1"
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
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
          <Label htmlFor="standalone" className="text-sm text-gray-600">
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
        <div className="text-center py-12 text-gray-500">
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
                  className="cursor-pointer"
                  onClick={() => {
                    setEditingTask(task)
                    setShowForm(true)
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        task.status === 'COMPLETED'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
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
                  <TableCell
                    className={`font-medium ${
                      task.status === 'COMPLETED'
                        ? 'line-through text-gray-400'
                        : ''
                    }`}
                  >
                    {task.title}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[task.status] ?? ''}
                      variant="secondary"
                    >
                      {STATUS_LABELS[task.status] ?? task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={PRIORITY_COLORS[task.priority] ?? ''}
                      variant="secondary"
                    >
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        isOverdue(task.dueDate, task.status)
                          ? 'text-red-600 font-medium'
                          : ''
                      }
                    >
                      {formatDate(task.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.category && (
                      <Badge
                        className={CATEGORY_COLORS[task.category] ?? ''}
                        variant="secondary"
                      >
                        {CATEGORY_LABELS[task.category] ?? task.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">
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
