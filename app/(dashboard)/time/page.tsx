// app/(dashboard)/time/page.tsx
'use client'

import { useState, useEffect } from 'react'
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
import { 
  Play, 
  Pause, 
  Square, 
   
  
  Plus,
  Edit,
  Trash2,
  
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'react-hot-toast'
// import api from '@/lib/api/client'

export default function TimePage() {
  const { activeTimer, startTimer, stopTimer } = useAppStore()
  const [timeEntries, setTimeEntries] = useState<Array<{
    id: string
    projectId?: string
    project?: { name?: string }
    taskId?: string
    task?: { name?: string }
    startTime: string
    endTime?: string
    duration: number
    description?: string
  }>>([])
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [manualEntry, setManualEntry] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    description: '',
  })
  
  // Mock data
  const projects = [
    { id: '1', name: 'אפליקציה - סטארטאפ Y' },
    { id: '2', name: 'אתר תדמית - חברת Z' },
    { id: '3', name: 'דף נחיתה - חברת X' },
  ]
  
  const tasks = [
    { id: '1', name: 'עיצוב' },
    { id: '2', name: 'פיתוח Frontend' },
    { id: '3', name: 'פיתוח Backend' },
    { id: '4', name: 'תיקוני באגים' },
    { id: '5', name: 'פגישה עם לקוח' },
  ]
  
  useEffect(() => {
    fetchTimeEntries()
  }, [])
  
  const fetchTimeEntries = async () => {
    // Mock time entries
    const mockEntries = [
      {
        id: '1',
        project: { name: 'דף נחיתה - חברת X' },
        task: 'עיצוב',
        startTime: '2024-12-15T10:35:00',
        endTime: null,
        duration: null,
        description: 'עיצוב וקידוד הדף הראשי',
        isActive: true,
      },
      {
        id: '2',
        project: { name: 'אפליקציה - סטארטאפ Y' },
        task: 'פיתוח Backend',
        startTime: '2024-12-15T08:00:00',
        endTime: '2024-12-15T10:30:00',
        duration: 150,
        description: 'פיתוח API לתשלומים',
      },
      {
        id: '3',
        project: { name: 'ייעוץ CRM' },
        task: 'פגישה',
        startTime: '2024-12-14T14:00:00',
        endTime: '2024-12-14T14:45:00',
        duration: 45,
        description: 'שיחת ייעוץ טלפונית',
      },
    ]
    
    setTimeEntries(mockEntries)
  }
  
  const handleStartTimer = () => {
    if (!selectedProject) {
      toast.error('בחר פרויקט')
      return
    }
    
    const project = projects.find(p => p.id === selectedProject)
    if (project) {
      startTimer(selectedProject, selectedTask)
      toast.success(`טיימר הופעל עבור ${project.name}`)
    }
  }
  
  const handleStopTimer = () => {
    stopTimer()
    toast.success('טיימר נעצר והזמן נשמר')
    fetchTimeEntries()
  }
  
  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Calculate duration
    const start = new Date(`${manualEntry.date}T${manualEntry.startTime}`)
    const end = new Date(`${manualEntry.date}T${manualEntry.endTime}`)
    const duration = Math.floor((end.getTime() - start.getTime()) / 60000)
    
    const newEntry = {
      id: Date.now().toString(),
      project: projects.find(p => p.id === manualEntry.projectId),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration,
      description: manualEntry.description,
    }
    
    setTimeEntries([newEntry, ...timeEntries])
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
  }
  
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }
  
  // Calculate stats
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.startTime).toDateString()
    return entryDate === new Date().toDateString()
  })
  
  const todayMinutes = todayEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const weekMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  
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
                <h2 className="text-2xl font-bold mb-1">פרויקט דמו</h2>
                <p className="text-sm opacity-75">משימה: פיתוח</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold font-mono">{getActiveTimerDuration()}</p>
                <div className="flex gap-3 mt-4">
                  <Button 
                    variant="secondary"
                    onClick={handleStopTimer}
                    className="bg-white text-blue-600 hover:bg-gray-100"
                  >
                    <Square className="w-4 h-4 ml-2" />
                    עצור וסיים
                  </Button>
                  <Button 
                    variant="secondary"
                    className="bg-white/20 text-white hover:bg-white/30"
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
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input placeholder="תיאור (אופציונלי)" />
              
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
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">משימות שהושלמו</span>
                  <span className="font-bold">3</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">פרויקטים פעילים</span>
                  <span className="font-bold">2</span>
                </div>
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
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'].map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="text-xs w-12">{day}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className="bg-purple-500 h-4 rounded-full"
                        style={{ width: `${Math.random() * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
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
              {projects.map((project, index) => {
                const percentage = [45, 30, 25][index]
                const hours = [12.5, 8.3, 6.9][index]
                const color = ['bg-blue-500', 'bg-green-500', 'bg-orange-500'][index]
                
                return (
                  <div key={project.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{project.name}</span>
                      <span className="text-sm font-bold">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`${color} h-3 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{hours} שעות</p>
                  </div>
                )
              })}
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
                      <Badge variant="outline">{entry.project.name}</Badge>
                    </td>
                    <td className="py-3 text-sm">{entry.task || '-'}</td>
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
                        <Button size="sm" variant="ghost">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
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
    </div>
  )
}