// app/(dashboard)/projects/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Plus, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle,
  DollarSign,
  MoreVertical,
  Play,
  Edit,
  Trash,
  ChevronRight
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { ProjectForm } from '@/components/forms/project-form'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const stageColumns = [
  { id: 'PLANNING', name: 'תכנון ואפיון', color: 'bg-gray-700' },
  { id: 'DEVELOPMENT', name: 'פיתוח', color: 'bg-blue-600' },
  { id: 'TESTING', name: 'בדיקות ותיקונים', color: 'bg-orange-600' },
  { id: 'REVIEW', name: 'ממתין לאישור', color: 'bg-purple-600' },
  { id: 'DELIVERY', name: 'מסירה ותשלום', color: 'bg-green-600' },
]

const priorityColors = {
  URGENT: 'border-red-500',
  HIGH: 'border-orange-500',
  MEDIUM: 'border-blue-500',
  LOW: 'border-green-500',
}

const priorityLabels = {
  URGENT: 'דחוף',
  HIGH: 'גבוה',
  MEDIUM: 'בינוני',
  LOW: 'נמוך',
}

const projectTypeColors = {
  LANDING_PAGE: 'bg-green-100 text-green-800',
  WEBSITE: 'bg-blue-100 text-blue-800',
  ECOMMERCE: 'bg-purple-100 text-purple-800',
  WEB_APP: 'bg-indigo-100 text-indigo-800',
  MOBILE_APP: 'bg-pink-100 text-pink-800',
  MANAGEMENT_SYSTEM: 'bg-yellow-100 text-yellow-800',
  CONSULTATION: 'bg-gray-100 text-gray-800',
}

const projectTypeLabels = {
  LANDING_PAGE: 'דף נחיתה',
  WEBSITE: 'אתר תדמית',
  ECOMMERCE: 'חנות אונליין',
  WEB_APP: 'אפליקציית ווב',
  MOBILE_APP: 'אפליקציה',
  MANAGEMENT_SYSTEM: 'מערכת ניהול',
  CONSULTATION: 'ייעוץ',
}

export default function ProjectsPage() {
  const [showForm, setShowForm] = useState(false)
  const [projects, setProjects] = useState<Array<{
    id: string
    name: string
    client?: { name?: string }
    type: string
    stage: string
    priority: string
    progress: number
    budget?: number
    deadline?: string
    estimatedHours?: number
    actualHours?: number
  }>>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchProjects()
  }, [])
  
  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects')
      setProjects(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרויקטים')
      // Fallback mock data for testing
      /* const mockProjects = [
        {
          id: '1',
          name: 'אפליקציית הזמנות',
          client: { name: 'סטארטאפ Y' },
          type: 'WEB_APP',
          stage: 'DEVELOPMENT',
          priority: 'HIGH',
          progress: 65,
          budget: 45000,
          deadline: '2024-12-30',
          estimatedHours: 120,
          actualHours: 78,
        },
        {
          id: '2',
          name: 'אתר תדמית חברה',
          client: { name: 'חברת Z' },
          type: 'WEBSITE',
          stage: 'DEVELOPMENT',
          priority: 'MEDIUM',
          progress: 40,
          budget: 12000,
          deadline: '2024-01-15',
          estimatedHours: 40,
          actualHours: 16,
        },
        {
          id: '3',
          name: 'דף נחיתה למבצע',
          client: { name: 'חברת X' },
          type: 'LANDING_PAGE',
          stage: 'TESTING',
          priority: 'URGENT',
          progress: 85,
          budget: 3500,
          deadline: '2024-12-16',
          estimatedHours: 10,
          actualHours: 8.5,
        },
        {
          id: '4',
          name: 'חנות אונליין',
          client: { name: 'בוטיק שרה' },
          type: 'ECOMMERCE',
          stage: 'PLANNING',
          priority: 'MEDIUM',
          progress: 10,
          budget: 18000,
          deadline: '2024-02-01',
          estimatedHours: 60,
          actualHours: 0,
        },
        {
          id: '5',
          name: 'ייעוץ CRM',
          client: { name: 'משרד רו"ח' },
          type: 'CONSULTATION',
          stage: 'DELIVERY',
          priority: 'LOW',
          progress: 100,
          budget: 2500,
          deadline: '2024-12-10',
          estimatedHours: 5,
          actualHours: 5,
        },
      ]
      // Use mock data only if no API is available
      // setProjects(mockProjects) */
    } finally {
      setLoading(false)
    }
  }
  
  const handleCreateProject = async (data: unknown) => {
    try {
      const response = await api.post('/projects', data)
      setProjects([response.data, ...projects])
      setShowForm(false)
      toast.success('פרויקט נוצר בהצלחה!')
    } catch {
      toast.error('שגיאה ביצירת פרויקט')
    }
  }
  
  const handleUpdateStage = async (projectId: string, newStage: string) => {
    try {
      const response = await api.put(`/projects/${projectId}`, { stage: newStage })
      setProjects(projects.map(p => 
        p.id === projectId ? response.data : p
      ))
      toast.success('שלב הפרויקט עודכן')
    } catch {
      toast.error('שגיאה בעדכון שלב הפרויקט')
    }
  }
  
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק פרויקט זה?')) return
    
    try {
      await api.delete(`/projects/${projectId}`)
      setProjects(projects.filter(p => p.id !== projectId))
      toast.success('פרויקט נמחק בהצלחה')
    } catch {
      toast.error('שגיאה במחיקת פרויקט')
    }
  }
  
  const handleStartTimer = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      toast.success(`טיימר הופעל עבור ${project.name}`)
      // This will connect to the timer widget through the store
    }
  }
  
  // Group projects by stage
  const projectsByStage = projects.reduce((acc: Record<string, typeof projects>, project) => {
    if (!acc[project.stage]) acc[project.stage] = []
    acc[project.stage].push(project)
    return acc
  }, {})
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }
  
  // Calculate stats
  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.stage === 'DEVELOPMENT').length,
    urgent: projects.filter(p => p.priority === 'URGENT').length,
    totalValue: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
    totalHours: projects.reduce((sum, p) => sum + (p.actualHours || 0), 0),
  }
  
  return (
    <div className="space-y-6">
      {/* Page Header with Stats */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ניהול פרויקטים</h1>
          <div className="flex gap-6 mt-2">
            <span className="text-sm text-gray-600">
              <span className="font-bold text-gray-800">{stats.total}</span> פרויקטים
            </span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-blue-600">{stats.inProgress}</span> בפיתוח
            </span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-red-600">{stats.urgent}</span> דחופים
            </span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-green-600">₪{stats.totalValue.toLocaleString()}</span> ערך כולל
            </span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-purple-600">{stats.totalHours.toFixed(1)}</span> שעות
            </span>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 ml-2" />
          פרויקט חדש
        </Button>
      </div>
      
      {/* Project Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>יצירת פרויקט חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm 
              onSubmit={handleCreateProject}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stageColumns.map((column) => (
          <div key={column.id} className="min-w-[320px] flex-1">
            <div className={`${column.color} text-white rounded-t-lg p-3`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  {column.name}
                </h3>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {projectsByStage[column.id]?.length || 0}
                </Badge>
              </div>
            </div>
            
            <div className="bg-gray-50 min-h-[500px] p-3 space-y-3 rounded-b-lg">
              {projectsByStage[column.id]?.map((project) => (
                <Card 
                  key={project.id} 
                  className={`cursor-pointer hover:shadow-md transition-shadow border-r-4 ${priorityColors[project.priority as keyof typeof priorityColors]}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{project.name}</h4>
                          <p className="text-xs text-gray-600 mt-1">{project.client?.name || 'ללא לקוח'}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {/* Change Stage */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <ChevronRight className="ml-2 h-4 w-4" />
                                שנה שלב
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {stageColumns
                                  .filter(stage => stage.id !== project.stage)
                                  .map(stage => (
                                    <DropdownMenuItem
                                      key={stage.id}
                                      onClick={() => handleUpdateStage(project.id, stage.id)}
                                    >
                                      {stage.name}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            <DropdownMenuItem onClick={() => handleStartTimer(project.id)}>
                              <Play className="ml-2 h-4 w-4" />
                              הפעל טיימר
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem>
                              <Edit className="ml-2 h-4 w-4" />
                              ערוך פרויקט
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => handleDeleteProject(project.id)}
                              className="text-red-600"
                            >
                              <Trash className="ml-2 h-4 w-4" />
                              מחק פרויקט
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {/* Type and Priority */}
                      <div className="flex gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${projectTypeColors[project.type as keyof typeof projectTypeColors]}`}
                        >
                          {projectTypeLabels[project.type as keyof typeof projectTypeLabels]}
                        </Badge>
                        {project.priority === 'URGENT' && (
                          <Badge variant="destructive" className="text-xs">
                            {priorityLabels[project.priority as keyof typeof priorityLabels]}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">התקדמות</span>
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>
                      
                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="w-3 h-3" />
                          <span>{project.deadline ? new Date(project.deadline).toLocaleDateString('he-IL') : 'לא נקבע'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <DollarSign className="w-3 h-3" />
                          <span>₪{(project.budget || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{project.actualHours || 0}/{project.estimatedHours}h</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <User className="w-3 h-3" />
                          <span>משה</span>
                        </div>
                      </div>
                      
                      {/* Warnings */}
                      {project.priority === 'URGENT' && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          <AlertCircle className="w-3 h-3" />
                          <span>דדליין קרוב!</span>
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleStartTimer(project.id)}
                        >
                          <Play className="w-3 h-3 ml-1" />
                          טיימר
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          צפה
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {(!projectsByStage[column.id] || projectsByStage[column.id].length === 0) && (
                <div className="text-center text-gray-400 text-sm py-8">
                  אין פרויקטים בשלב זה
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}