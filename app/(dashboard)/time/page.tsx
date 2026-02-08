// app/(dashboard)/time/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Play,
  Pause,
  Square,
  Plus,
  Edit,
  Trash2
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'react-hot-toast'
import api from '@/lib/api/client'

export default function TimePage() {
  const { activeTimer, startTimer, stopTimer } = useAppStore()
  const [timeEntries, setTimeEntries] = useState<Array<{
    id: string
    projectId?: string
    project?: { name?: string }
    taskId?: string
    task?: { title?: string }
    startTime: string
    endTime?: string
    duration: number
    description?: string
  }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [timerDescription, setTimerDescription] = useState('')
  const [manualEntry, setManualEntry] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    description: '',
  })
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [stopDescription, setStopDescription] = useState('')
  const [editingEntry, setEditingEntry] = useState<{
    id: string
    description: string
    projectId: string
  } | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [stats, setStats] = useState({
    todayMinutes: 0,
    weekMinutes: 0,
    projectBreakdown: [] as Array<{ projectId: string; projectName: string; minutes: number; percentage: number }>,
    weeklyBreakdown: [] as Array<{ day: number; minutes: number; percentage: number }>
  })
  
  const fetchTimeEntries = useCallback(async () => {
    try {
      const response = await api.get('/time')
      setTimeEntries(response.data)
    } catch {
      console.error('Error fetching time entries')
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const response = await api.get('/projects')
      setProjects(response.data)
    } catch {
      console.error('Error fetching projects')
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.get('/tasks')
      setTasks(response.data)
    } catch {
      console.error('Error fetching tasks')
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/time/stats?period=week')
      setStats(response.data)
    } catch {
      console.error('Error fetching stats')
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchTimeEntries(),
        fetchProjects(),
        fetchTasks(),
        fetchStats()
      ])
    } catch {
      toast.error('שגיאה בטעינת נתונים')
    } finally {
      setLoading(false)
    }
  }, [fetchTimeEntries, fetchProjects, fetchTasks, fetchStats])

  const fetchActiveTimer = useCallback(async () => {
    try {
      const response = await api.get('/time/active')
      if (response.data) {
        // Sync with Zustand store
        startTimer(response.data.projectId, response.data.taskId)
      }
    } catch {
      // No active timer or error - that's okay
      console.log('No active timer found')
    }
  }, [startTimer])

  useEffect(() => {
    fetchData()
    fetchActiveTimer()
  }, [fetchData, fetchActiveTimer])
  
  const handleStartTimer = async () => {
    if (!selectedProject) {
      toast.error('בחר פרויקט')
      return
    }

    try {
      await api.post('/time/start', {
        projectId: selectedProject,
        taskId: selectedTask || undefined,
        description: timerDescription || undefined
      })

      const project = projects.find(p => p.id === selectedProject)
      startTimer(selectedProject, selectedTask)
      toast.success(`טיימר הופעל עבור ${project?.name || 'הפרויקט'}`)
      fetchTimeEntries()
    } catch {
      toast.error('שגיאה בהפעלת טיימר')
    }
  }

  const handleStopTimer = async (description?: string) => {
    try {
      await api.post('/time/stop', { description })
      stopTimer()
      setShowStopDialog(false)
      setStopDescription('')
      toast.success('טיימר נעצר והזמן נשמר')
      await Promise.all([fetchTimeEntries(), fetchStats()])
    } catch {
      toast.error('שגיאה בעצירת טיימר')
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק רישום זמן זה?')) return
    try {
      await api.delete(`/time/${entryId}`)
      setTimeEntries(prev => prev.filter(e => e.id !== entryId))
      toast.success('רישום זמן נמחק')
      fetchStats()
    } catch {
      toast.error('שגיאה במחיקת רישום זמן')
    }
  }

  const handleUpdateEntry = async () => {
    if (!editingEntry) return
    try {
      await api.put(`/time/${editingEntry.id}`, { description: editDescription })
      setTimeEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, description: editDescription } : e))
      setEditingEntry(null)
      toast.success('רישום זמן עודכן')
    } catch {
      toast.error('שגיאה בעדכון רישום זמן')
    }
  }
  
  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!manualEntry.projectId || !manualEntry.startTime || !manualEntry.endTime) {
      toast.error('נא למלא את כל השדות הנדרשים')
      return
    }

    try {
      const startTime = new Date(`${manualEntry.date}T${manualEntry.startTime}`)
      const endTime = new Date(`${manualEntry.date}T${manualEntry.endTime}`)

      if (endTime <= startTime) {
        toast.error('שעת סיום חייבת להיות אחרי שעת התחלה')
        return
      }

      await api.post('/time', {
        projectId: manualEntry.projectId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: manualEntry.description
      })

      setShowManualEntry(false)
      toast.success('רישום זמן נוסף בהצלחה')

      // Reset form
      setManualEntry({
        projectId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        description: '',
      })

      // Refresh data
      await Promise.all([fetchTimeEntries(), fetchStats()])
    } catch {
      toast.error('שגיאה בהוספת רישום זמן')
    }
  }
  
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }
  
  // Calculate stats from timeEntries for display
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.startTime).toDateString()
    return entryDate === new Date().toDateString()
  })

  const todayMinutes = stats.todayMinutes || todayEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const weekMinutes = stats.weekMinutes || timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  
  // Get active timer duration if exists
  const getActiveTimerDuration = () => {
    if (!activeTimer) return '00:00:00'

    const start = new Date(activeTimer.startTime).getTime()
    const now = Date.now()
    const seconds = Math.floor((now - start) / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">מעקב זמנים</h1>
          <p className="text-gray-600 mt-1">ניהול וניתוח זמני עבודה</p>
        </div>
        <Button onClick={() => setShowManualEntry(!showManualEntry)}>
          <Plus className="w-4 h-4 ml-2" />
          הוספה ידנית
        </Button>
      </div>
      
      {/* Active Timer or Start Timer */}
      {activeTimer ? (
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-2">טיימר פעיל</p>
                <h2 className="text-2xl font-bold mb-1">
                  {projects.find(p => p.id === activeTimer.projectId)?.name || 'פרויקט'}
                </h2>
                {activeTimer.taskId && (
                  <p className="text-sm opacity-75">
                    משימה: {tasks.find(t => t.id === activeTimer.taskId)?.title || 'ללא משימה'}
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold font-mono">{getActiveTimerDuration()}</p>
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowStopDialog(true)}
                    className="bg-white text-blue-600 hover:bg-gray-100"
                  >
                    <Square className="w-4 h-4 ml-2" />
                    עצור וסיים
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-white/20 text-white hover:bg-white/30"
                    disabled
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>התחל טיימר חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר פרויקט" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedTask} onValueChange={setSelectedTask}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר משימה (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                placeholder="תיאור (אופציונלי)"
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
              />
              
              <Button onClick={handleStartTimer} className="w-full">
                <Play className="w-4 h-4 ml-2" />
                התחל טיימר
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Manual Entry Form */}
      {showManualEntry && (
        <Card>
          <CardHeader>
            <CardTitle>הוספת זמן ידנית</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualEntry} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>פרויקט</Label>
                <Select 
                  value={manualEntry.projectId} 
                  onValueChange={(value) => setManualEntry({...manualEntry, projectId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר פרויקט" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>תאריך</Label>
                <Input 
                  type="date" 
                  value={manualEntry.date}
                  onChange={(e) => setManualEntry({...manualEntry, date: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>שעת התחלה</Label>
                <Input 
                  type="time" 
                  value={manualEntry.startTime}
                  onChange={(e) => setManualEntry({...manualEntry, startTime: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>שעת סיום</Label>
                <Input 
                  type="time" 
                  value={manualEntry.endTime}
                  onChange={(e) => setManualEntry({...manualEntry, endTime: e.target.value})}
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Label>תיאור</Label>
                <Input 
                  placeholder="תיאור העבודה..."
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({...manualEntry, description: e.target.value})}
                />
              </div>
              
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowManualEntry(false)}>
                  ביטול
                </Button>
                <Button type="submit">
                  שמור
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">סיכום היום</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">
                  {formatDuration(todayMinutes)}
                </p>
                <p className="text-sm text-gray-600 mt-1">שעות עבודה</p>
              </div>
              
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">יעד יומי</span>
                  <span className="font-bold">8:00</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((todayMinutes / 480) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round((todayMinutes / 480) * 100)}% השלמה
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">השבוע</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-purple-600">
                  {formatDuration(weekMinutes)}
                </p>
                <p className="text-sm text-gray-600 mt-1">שעות השבוע</p>
              </div>
              
              <div className="space-y-2">
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((dayName, index) => {
                  const dayData = stats.weeklyBreakdown?.[index] || { minutes: 0, percentage: 0 }
                  const maxMinutes = Math.max(...(stats.weeklyBreakdown?.map(d => d.minutes) || [1]))
                  const widthPercent = maxMinutes > 0 ? (dayData.minutes / maxMinutes) * 100 : 0

                  return (
                    <div key={dayName} className="flex items-center gap-2">
                      <span className="text-xs w-12">{dayName}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-purple-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-left">
                        {dayData.minutes > 0 ? formatDuration(dayData.minutes) : '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">חלוקה לפי פרויקטים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.projectBreakdown && stats.projectBreakdown.length > 0 ? (
                stats.projectBreakdown.map((item, index) => {
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500']
                  const color = colors[index % colors.length]
                  const hours = (item.minutes / 60).toFixed(1)

                  return (
                    <div key={item.projectId}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{item.projectName}</span>
                        <span className="text-sm font-bold">{Math.round(item.percentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`${color} h-3 rounded-full transition-all duration-500`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{hours} שעות</p>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">אין נתונים להצגה</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית זמנים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 text-sm font-medium text-gray-600">תאריך</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">פרויקט</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">משימה</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">תיאור</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">התחלה</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">סיום</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">משך</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 text-sm">
                      {new Date(entry.startTime).toLocaleDateString('he-IL')}
                    </td>
                    <td className="py-3 text-sm">
                      <Badge variant="outline">{entry.project?.name || '-'}</Badge>
                    </td>
                    <td className="py-3 text-sm">{entry.task?.title || '-'}</td>
                    <td className="py-3 text-sm">{entry.description || '-'}</td>
                    <td className="py-3 text-sm">
                      {new Date(entry.startTime).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 text-sm">
                      {entry.endTime ? new Date(entry.endTime).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : (
                        <Badge variant="destructive">פעיל</Badge>
                      )}
                    </td>
                    <td className="py-3 text-sm font-medium">
                      {entry.duration ? formatDuration(entry.duration) : '-'}
                    </td>
                    <td className="py-3 text-sm">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingEntry({ id: entry.id, description: entry.description || '', projectId: entry.projectId || '' })
                          setEditDescription(entry.description || '')
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(entry.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stop Timer Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עצירת טיימר</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>תיאור העבודה</Label>
              <Textarea
                value={stopDescription}
                onChange={(e) => setStopDescription(e.target.value)}
                placeholder="מה עשית? (אופציונלי)"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => handleStopTimer()}>
                עצור בלי תיאור
              </Button>
              <Button onClick={() => handleStopTimer(stopDescription)}>
                עצור ושמור
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת רישום זמן</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="תיאור העבודה..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingEntry(null)}>
                ביטול
              </Button>
              <Button onClick={handleUpdateEntry}>
                שמור
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}