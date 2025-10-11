'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TaskForm } from '@/components/forms/task-form'
import { TimerWidget } from '@/components/timer/timer-widget'
import api from '@/lib/api/client'
import { Play, MoreHorizontal, Plus, Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  priorityScore?: number
  dueDate?: string
  completedAt?: string
  createdAt?: string
  totalMinutes: number
  project?: {
    id: string
    name: string
    type: string
  }
  client?: {
    id: string
    name: string
    company?: string
  }
}

const statusLabels = {
  TODO: 'לביצוע',
  IN_PROGRESS: 'בביצוע',
  WAITING_APPROVAL: 'ממתין לאישור',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל'
}

const statusColors = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800'
}

const priorityLabels = {
  LOW: 'נמוכה',
  MEDIUM: 'בינונית', 
  HIGH: 'גבוהה',
  URGENT: 'דחוף'
}

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: '',
    priority: '',
    projectId: '',
    overdue: false,
    dueToday: false,
    dueThisWeek: false
  })
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created' | 'score'>('score')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tasksRes, projectsRes, clientsRes] = await Promise.all([
        api.get('/tasks', { params: filter }),
        api.get('/projects?status=IN_PROGRESS'),
        api.get('/clients?status=ACTIVE')
      ])
      
      setTasks(tasksRes.data)
      setProjects(projectsRes.data)
      setClients(clientsRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDataCallback = useCallback(fetchData, [filter])

  useEffect(() => {
    fetchDataCallback()
  }, [fetchDataCallback])

  const handleSubmit = async (taskData: unknown) => {
    try {
      if (selectedTask) {
        await api.put(`/tasks/${selectedTask.id}`, taskData)
      } else {
        await api.post('/tasks', taskData)
      }
      
      setShowForm(false)
      setSelectedTask(null)
      fetchData()
    } catch (error) {
      console.error('Error saving task:', error)
    }
  }

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status })
      fetchData()
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const handleStartTimer = async (task: Task) => {
    try {
      await api.post('/time/start', {
        taskId: task.id,
        projectId: task.project?.id
      })
      fetchData()
    } catch (error) {
      console.error('Error starting timer:', error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  const getPriorityScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800'
    if (score >= 70) return 'bg-red-100 text-red-800'
    if (score >= 40) return 'bg-orange-100 text-orange-800'
    if (score >= 20) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return (b.priorityScore || 0) - (a.priorityScore || 0)
      case 'priority':
        const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      case 'deadline':
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      case 'created':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      default:
        return 0
    }
  })

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (days < 0) return 'איחור'
    if (days === 0) return 'היום'
    if (days === 1) return 'מחר'
    return `${days} ימים`
  }

  const getTasksByStatus = () => {
    return tasks.reduce((acc: Record<string, typeof tasks>, task) => {
      if (!acc[task.status]) acc[task.status] = []
      acc[task.status].push(task)
      return acc
    }, {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">טוען משימות...</div>
      </div>
    )
  }

  const tasksByStatus = getTasksByStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול משימות</h1>
          <p className="text-gray-600 mt-1">{tasks.length} משימות סה״כ</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'deadline' | 'created' | 'score')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="score">מיין לפי עדיפות</option>
            <option value="priority">מיין לפי חשיבות</option>
            <option value="deadline">מיין לפי דדליין</option>
            <option value="created">מיין לפי תאריך יצירה</option>
          </select>
          
          <Button 
            variant="outline"
            onClick={() => setFilter({...filter, overdue: !filter.overdue})}
            className={filter.overdue ? 'bg-red-50 border-red-200' : ''}
          >
            <AlertCircle className="w-4 h-4 ml-2" />
            משימות באיחור
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setFilter({...filter, dueToday: !filter.dueToday})}
            className={filter.dueToday ? 'bg-orange-50 border-orange-200' : ''}
          >
            <Calendar className="w-4 h-4 ml-2" />
            דד״ליין היום
          </Button>
          
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            משימה חדשה
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">בביצוע</p>
                <p className="text-xl font-bold">{tasksByStatus['IN_PROGRESS']?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">הושלם</p>
                <p className="text-xl font-bold">{tasksByStatus['COMPLETED']?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">דחוף</p>
                <p className="text-xl font-bold">
                  {tasks.filter(t => t.priority === 'URGENT' && t.status !== 'COMPLETED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">השבוע</p>
                <p className="text-xl font-bold">
                  {tasks.filter(t => {
                    if (!t.dueDate) return false
                    const due = new Date(t.dueDate)
                    const weekFromNow = new Date()
                    weekFromNow.setDate(weekFromNow.getDate() + 7)
                    return due <= weekFromNow && t.status !== 'COMPLETED'
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedTask ? 'עריכת משימה' : 'משימה חדשה'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              task={selectedTask ? {
                id: selectedTask.id,
                name: selectedTask.title,
                description: selectedTask.description,
                priority: selectedTask.priority,
                status: selectedTask.status,
                projectId: selectedTask.project?.id,
                dueDate: selectedTask.dueDate
              } : undefined}
              projects={projects}
              clients={clients}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false)
                setSelectedTask(null)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedTasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setSelectedTask(task)
                      setShowForm(true)
                    }}>
                      ערוך
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStartTimer(task)}>
                      התחל טיימר
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange(task.id, 'COMPLETED')}
                      className="text-green-600"
                    >
                      סמן כהושלם
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={statusColors[task.status]}>
                  {statusLabels[task.status]}
                </Badge>
                <Badge className={priorityColors[task.priority]}>
                  {priorityLabels[task.priority]}
                </Badge>
                {task.priorityScore && (
                  <Badge className={getPriorityScoreColor(task.priorityScore)}>
                    {task.priorityScore}/100
                  </Badge>
                )}
              </div>

              {task.project && (
                <p className="text-sm text-blue-600 mb-2">
                  {task.project.name}
                </p>
              )}

              {task.client && (
                <p className="text-sm text-gray-600 mb-2">
                  {task.client.name}
                  {task.client.company && ` - ${task.client.company}`}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{formatTime(task.totalMinutes)}</span>
                </div>
                
                {task.dueDate && (
                  <div className={`text-sm ${
                    new Date(task.dueDate) < new Date() 
                      ? 'text-red-600 font-medium' 
                      : 'text-gray-600'
                  }`}>
                    {formatDueDate(task.dueDate)}
                  </div>
                )}
              </div>

              {task.status !== 'COMPLETED' && (
                <div className="mt-3 pt-3 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleStartTimer(task)}
                  >
                    <Play className="w-4 h-4 ml-2" />
                    התחל עבודה
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <CheckCircle2 className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              אין משימות
            </h3>
            <p className="text-gray-600 mb-4">
              התחל על ידי יצירת המשימה הראשונה שלך
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 ml-2" />
              צור משימה חדשה
            </Button>
          </CardContent>
        </Card>
      )}

      <TimerWidget />
    </div>
  )
}