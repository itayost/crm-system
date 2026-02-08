'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ActivityTimeline } from '@/components/activity/activity-timeline'
import { EmptyState } from '@/components/ui/empty-state'
import { TaskForm } from '@/components/forms/task-form'
import { ProjectForm } from '@/components/forms/project-form'
import {
  Play,
  Edit,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  ListTodo,
  User,
  Pencil,
  X,
} from 'lucide-react'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const stageLabels: Record<string, string> = {
  PLANNING: 'תכנון',
  DEVELOPMENT: 'פיתוח',
  TESTING: 'בדיקות',
  REVIEW: 'אישור',
  DELIVERY: 'מסירה',
  MAINTENANCE: 'תחזוקה',
}

const stageColors: Record<string, string> = {
  PLANNING: 'bg-gray-100 text-gray-800',
  DEVELOPMENT: 'bg-blue-100 text-blue-800',
  TESTING: 'bg-orange-100 text-orange-800',
  REVIEW: 'bg-purple-100 text-purple-800',
  DELIVERY: 'bg-green-100 text-green-800',
  MAINTENANCE: 'bg-cyan-100 text-cyan-800',
}

const priorityLabels: Record<string, string> = {
  LOW: 'נמוך',
  MEDIUM: 'בינוני',
  HIGH: 'גבוה',
  URGENT: 'דחוף',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
}

const typeLabels: Record<string, string> = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר תדמית',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
}

const taskStatusLabels: Record<string, string> = {
  TODO: 'לביצוע',
  IN_PROGRESS: 'בתהליך',
  WAITING_APPROVAL: 'ממתין לאישור',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'ממתין',
  PAID: 'שולם',
  OVERDUE: 'באיחור',
  CANCELLED: 'בוטל',
}

interface SubTask {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  actualHours: number | null
  subTasks: SubTask[]
  createdAt: string
}

interface TimeEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  description: string | null
  user: { id: string; name: string; email: string }
}

interface Payment {
  id: string
  amount: number
  status: string
  type: string
  dueDate: string
  paidAt: string | null
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  stage: string
  priority: string
  startDate: string | null
  deadline: string | null
  completedAt: string | null
  estimatedHours: number | null
  actualHours: number | null
  budget: number | null
  client: { id: string; name: string; company: string | null; type: string }
  tasks: Task[]
  timeEntries: TimeEntry[]
  payments: Payment[]
  _count: { tasks: number; payments: number; timeEntries: number; milestones: number }
  createdAt: string
}

interface Activity {
  id: string
  action: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null)
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('')
  const [editingSubTask, setEditingSubTask] = useState<{ id: string; title: string } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [projectRes, activitiesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/activities?entityType=Project&entityId=${projectId}`),
      ])
      setProject(projectRes.data)
      setActivities(activitiesRes.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי פרויקט')
      router.push('/projects')
    } finally {
      setLoading(false)
    }
  }, [projectId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateProject = async (data: unknown) => {
    try {
      await api.put(`/projects/${projectId}`, data)
      setShowEditForm(false)
      toast.success('פרויקט עודכן בהצלחה')
      fetchData()
    } catch {
      toast.error('שגיאה בעדכון פרויקט')
    }
  }

  const handleCreateTask = async (data: unknown) => {
    try {
      await api.post('/tasks', { ...(data as Record<string, unknown>), projectId })
      setShowCreateTask(false)
      toast.success('משימה נוצרה בהצלחה')
      fetchData()
    } catch {
      toast.error('שגיאה ביצירת משימה')
    }
  }

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED'
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus })
      fetchData()
    } catch {
      toast.error('שגיאה בעדכון משימה')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      toast.success('משימה נמחקה')
      fetchData()
    } catch {
      toast.error('שגיאה במחיקת משימה')
    }
  }

  const handleCreateSubTask = async (parentTaskId: string) => {
    if (!newSubTaskTitle.trim()) return
    try {
      await api.post('/tasks', {
        title: newSubTaskTitle.trim(),
        projectId,
        parentTaskId,
        priority: 'MEDIUM',
      })
      setNewSubTaskTitle('')
      setAddingSubTaskFor(null)
      toast.success('תת-משימה נוצרה')
      fetchData()
    } catch {
      toast.error('שגיאה ביצירת תת-משימה')
    }
  }

  const handleUpdateSubTask = async (subTaskId: string, title: string) => {
    try {
      await api.put(`/tasks/${subTaskId}`, { title })
      setEditingSubTask(null)
      fetchData()
    } catch {
      toast.error('שגיאה בעדכון תת-משימה')
    }
  }

  const handleStartTimer = async () => {
    try {
      await api.post('/time/start', { projectId })
      toast.success('טיימר הופעל')
    } catch {
      toast.error('שגיאה בהפעלת טיימר')
    }
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  if (!project) return null

  // Calculate metrics
  const allTasks = project.tasks
  const allSubTasks = allTasks.flatMap(t => t.subTasks)
  const totalTaskCount = allTasks.length + allSubTasks.length
  const completedTaskCount = allTasks.filter(t => t.status === 'COMPLETED').length +
    allSubTasks.filter(t => t.status === 'COMPLETED').length
  const taskProgress = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0

  const totalHours = project.timeEntries.reduce((sum, t) => sum + (t.duration || 0), 0) / 60
  const budget = project.budget ? Number(project.budget) : 0
  const paidAmount = project.payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const daysRemaining = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'דשבורד', href: '/' },
          { label: 'פרויקטים', href: '/projects' },
          { label: project.name },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
            <Badge className={stageColors[project.stage]}>
              {stageLabels[project.stage] || project.stage}
            </Badge>
            <Badge className={priorityColors[project.priority]}>
              {priorityLabels[project.priority] || project.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4" />
            <Link href={`/clients/${project.client.id}`} className="hover:underline">
              {project.client.name}
            </Link>
            {project.client.company && (
              <span className="text-gray-400">• {project.client.company}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleStartTimer}>
            <Play className="h-4 w-4 ml-1" />
            טיימר
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
            <Edit className="h-4 w-4 ml-1" />
            ערוך
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-2">התקדמות משימות</p>
            <div className="flex items-center gap-2">
              <Progress value={taskProgress} className="h-2 flex-1" />
              <span className="text-sm font-bold">{taskProgress}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{completedTaskCount}/{totalTaskCount} משימות</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">תקציב</p>
            <p className="text-xl font-bold">₪{budget.toLocaleString()}</p>
            <p className="text-xs text-gray-500">₪{paidAmount.toLocaleString()} שולם</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">שעות</p>
            <p className="text-xl font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">מתוך {project.estimatedHours || '?'}h מוערך</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">דדליין</p>
            <p className="text-xl font-bold">
              {project.deadline ? new Date(project.deadline).toLocaleDateString('he-IL') : 'לא נקבע'}
            </p>
            {daysRemaining !== null && (
              <p className={`text-xs ${daysRemaining < 0 ? 'text-red-600' : daysRemaining < 7 ? 'text-orange-600' : 'text-gray-500'}`}>
                {daysRemaining < 0 ? `${Math.abs(daysRemaining)} ימים באיחור` : `${daysRemaining} ימים נותרו`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tasks (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">משימות</CardTitle>
              <Button size="sm" onClick={() => setShowCreateTask(true)}>
                <Plus className="h-4 w-4 ml-1" />
                משימה חדשה
              </Button>
            </CardHeader>
            <CardContent>
              {allTasks.length === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  title="אין משימות"
                  description="הוסף משימה ראשונה לפרויקט"
                  action={{ label: 'הוסף משימה', onClick: () => setShowCreateTask(true) }}
                />
              ) : (
                <div className="space-y-2">
                  {allTasks.map((task) => (
                    <div key={task.id} className="border rounded-lg">
                      {/* Parent Task */}
                      <div className="p-3 flex items-center gap-3">
                        <button onClick={() => handleToggleTaskStatus(task.id, task.status)}>
                          {task.status === 'COMPLETED' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-300 hover:text-gray-500" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                              {priorityLabels[task.priority]}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {taskStatusLabels[task.status]}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-gray-500">
                                {new Date(task.dueDate).toLocaleDateString('he-IL')}
                              </span>
                            )}
                            {task.subTasks.length > 0 && (
                              <span className="text-xs text-gray-500">
                                {task.subTasks.filter(s => s.status === 'COMPLETED').length}/{task.subTasks.length} תת-משימות
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {task.subTasks.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toggleExpand(task.id)}
                            >
                              {expandedTasks.has(task.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronLeft className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setAddingSubTaskFor(task.id)
                              if (!expandedTasks.has(task.id)) toggleExpand(task.id)
                            }}
                          >
                            <Plus className="h-4 w-4 text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {/* Sub-tasks */}
                      {(expandedTasks.has(task.id) || (task.subTasks.length === 0 && addingSubTaskFor === task.id)) && (
                        <div className="border-t bg-gray-50 px-3 py-2 space-y-1">
                          {task.subTasks.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 py-1 pr-6 group">
                              <button onClick={() => handleToggleTaskStatus(sub.id, sub.status)}>
                                {sub.status === 'COMPLETED' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Circle className="h-4 w-4 text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                              {editingSubTask?.id === sub.id ? (
                                <div className="flex-1 flex items-center gap-1">
                                  <Input
                                    value={editingSubTask.title}
                                    onChange={(e) => setEditingSubTask({ ...editingSubTask, title: e.target.value })}
                                    className="h-7 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateSubTask(sub.id, editingSubTask.title)
                                      if (e.key === 'Escape') setEditingSubTask(null)
                                    }}
                                    autoFocus
                                  />
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleUpdateSubTask(sub.id, editingSubTask.title)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingSubTask(null)}>
                                    <X className="h-3.5 w-3.5 text-gray-400" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className={`flex-1 text-sm ${sub.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>
                                    {sub.title}
                                  </span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => setEditingSubTask({ id: sub.id, title: sub.title })}>
                                    <Pencil className="h-3 w-3 text-gray-400" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteTask(sub.id)}>
                                    <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))}
                          {/* Add sub-task input */}
                          {addingSubTaskFor === task.id && (
                            <div className="flex items-center gap-2 py-1 pr-6">
                              <Plus className="h-4 w-4 text-gray-400" />
                              <Input
                                value={newSubTaskTitle}
                                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                                placeholder="הוסף תת-משימה..."
                                className="h-7 text-sm flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateSubTask(task.id)
                                  if (e.key === 'Escape') { setAddingSubTaskFor(null); setNewSubTaskTitle('') }
                                }}
                                autoFocus
                              />
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCreateSubTask(task.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setAddingSubTaskFor(null); setNewSubTaskTitle('') }}>
                                <X className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פרטי פרויקט</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">סוג</span>
                <span className="font-medium">{typeLabels[project.type] || project.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">שלב</span>
                <Badge className={stageColors[project.stage]}>{stageLabels[project.stage]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">עדיפות</span>
                <Badge className={priorityColors[project.priority]}>{priorityLabels[project.priority]}</Badge>
              </div>
              {project.startDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">תאריך התחלה</span>
                  <span>{new Date(project.startDate).toLocaleDateString('he-IL')}</span>
                </div>
              )}
              {project.deadline && (
                <div className="flex justify-between">
                  <span className="text-gray-500">דדליין</span>
                  <span>{new Date(project.deadline).toLocaleDateString('he-IL')}</span>
                </div>
              )}
              {project.description && (
                <div className="pt-2 border-t">
                  <p className="text-gray-500 mb-1">תיאור</p>
                  <p className="text-gray-800 whitespace-pre-wrap">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Time Entries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                זמנים אחרונים
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.timeEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">אין רשומות זמן</p>
              ) : (
                <div className="space-y-3">
                  {project.timeEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-800">{entry.description || 'ללא תיאור'}</p>
                        <p className="text-xs text-gray-500">{new Date(entry.startTime).toLocaleDateString('he-IL')}</p>
                      </div>
                      <span className="font-medium shrink-0">
                        {entry.duration ? `${(entry.duration / 60).toFixed(1)}h` : 'פעיל'}
                      </span>
                    </div>
                  ))}
                  {project.timeEntries.length > 5 && (
                    <Link href="/time" className="text-sm text-blue-600 hover:underline block text-center">
                      צפה בהכל ({project.timeEntries.length})
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                תשלומים
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.payments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">אין תשלומים</p>
              ) : (
                <div className="space-y-3">
                  {project.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {paymentStatusLabels[payment.status] || payment.status}
                        </Badge>
                      </div>
                      <span className="font-medium">₪{Number(payment.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">היסטוריית פעילות</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} emptyMessage="אין פעילויות עבור פרויקט זה" />
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>עריכת פרויקט</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSubmit={handleUpdateProject}
            onCancel={() => setShowEditForm(false)}
            initialData={{
              name: project.name,
              description: project.description || '',
              type: project.type,
              clientId: project.client.id,
              budget: project.budget?.toString() || '',
              estimatedHours: project.estimatedHours?.toString() || '',
              deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
              priority: project.priority,
              startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>משימה חדשה</DialogTitle>
          </DialogHeader>
          <TaskForm
            onSubmit={handleCreateTask}
            onCancel={() => setShowCreateTask(false)}
            projects={[{ id: project.id, name: project.name, type: project.type }]}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
