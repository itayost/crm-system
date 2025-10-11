'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Target, 
  Users, 
  Briefcase, 
  Clock, 
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react'
import api from '@/lib/api/client'
import { DashboardData } from '@/lib/services/dashboard.service'
import { toast } from 'react-hot-toast'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/dashboard/data')
        setData(response.data)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        toast.error('שגיאה בטעינת נתוני הדשבורד')
        // Fallback to empty data structure
        setData({
          stats: {
            activeProjects: 0,
            totalClients: 0,
            pendingPayments: 0,
            weeklyHours: 0,
            newLeads: 0,
            monthlyRevenue: 0,
          },
          recentProjects: [],
          todayTasks: [],
          upcomingPayments: [],
          smartRecommendations: []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>טוען נתוני דשבורד...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">שגיאה בטעינת הנתונים</h3>
          <p className="text-gray-600 mb-4">לא ניתן לטעון את נתוני הדשבורד</p>
          <Button onClick={() => window.location.reload()}>
            נסה שוב
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">לוח בקרה</h1>
        <p className="text-gray-600 mt-1">סקירה כללית של העסק שלך</p>
      </div>

      {/* Smart Recommendations Card */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            🎯 המשימות החשובות ביותר להיום
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.smartRecommendations.length > 0 ? (
            <div className="space-y-3">
              {data.smartRecommendations.slice(0, 3).map((rec, index) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-white/20 backdrop-blur rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        className={`text-xs ${
                          rec.urgencyLevel === 'critical' ? 'bg-red-500' :
                          rec.urgencyLevel === 'high' ? 'bg-orange-500' :
                          rec.urgencyLevel === 'medium' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}
                      >
                        {rec.priorityScore}/100
                      </Badge>
                      <span className="text-xs opacity-75">
                        {rec.type === 'task' ? 'משימה' : 'פרויקט'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm mb-1">{rec.title}</h4>
                    <p className="text-xs opacity-75">{rec.reason}</p>
                    {rec.deadline && (
                      <p className="text-xs opacity-60 mt-1">דדליין: {rec.deadline}</p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                    onClick={() => {
                      const href = rec.type === 'task' ? `/tasks?id=${rec.id}` : `/projects?id=${rec.id}`
                      window.location.href = href
                    }}
                  >
                    {index === 0 ? 'התחל עכשיו' : 'צפה'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg font-semibold mb-2">🎉 אין משימות דחופות!</p>
              <p className="text-sm opacity-75">כל המשימות שלך מעודכנות. זמן מצוין להתחיל פרויקט חדש!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-8 h-8 text-blue-600" />
              {data.stats.activeProjects > 0 && (
                <Badge variant="secondary">{data.stats.activeProjects}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold">{data.stats.activeProjects}</p>
            <p className="text-sm text-gray-600">פרויקטים פעילים</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{data.stats.totalClients}</p>
            <p className="text-sm text-gray-600">לקוחות</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-orange-600" />
              {data.stats.newLeads > 0 && (
                <Badge variant="destructive">{data.stats.newLeads}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold">{data.stats.newLeads}</p>
            <p className="text-sm text-gray-600">לידים חדשים</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{data.stats.weeklyHours}h</p>
            <p className="text-sm text-gray-600">שעות השבוע</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-yellow-600" />
              {data.stats.pendingPayments > 0 && (
                <Badge variant="secondary">{data.stats.pendingPayments}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold">₪{data.stats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-600">הכנסות החודש</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-2xl font-bold">{data.stats.pendingPayments}</p>
            <p className="text-sm text-gray-600">תשלומים ממתינים</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>משימות להיום</span>
              <Button variant="ghost" size="sm">
                ראה הכל
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.todayTasks.map((task) => (
                <div 
                  key={task.id}
                  className={`
                    p-4 rounded-lg border-r-4 
                    ${task.priority === 'HIGH' ? 'bg-red-50 border-red-500' : ''}
                    ${task.priority === 'MEDIUM' ? 'bg-orange-50 border-orange-500' : ''}
                    ${task.priority === 'LOW' ? 'bg-green-50 border-green-500' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {task.deadline || task.time || task.estimated}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      התחל
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>פרויקטים פעילים</span>
              <Button variant="ghost" size="sm">
                ראה הכל
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentProjects.map((project) => (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{project.name}</p>
                    {project.status === 'URGENT' && (
                      <Badge variant="destructive">דחוף</Badge>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        project.status === 'URGENT' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    {project.progress}% הושלם
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>תשלומים קרובים</span>
              <Button variant="ghost" size="sm">
                ראה הכל
                <ArrowRight className="w-4 h-4 mr-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.upcomingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{payment.client}</p>
                    <p className="text-sm text-gray-600">{payment.dueDate}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">₪{payment.amount.toLocaleString()}</p>
                    {payment.status === 'overdue' && (
                      <Badge variant="destructive" className="mt-1">באיחור</Badge>
                    )}
                    {payment.status === 'pending' && (
                      <Badge variant="secondary" className="mt-1">ממתין</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>פעולות מהירות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start">
                <Target className="w-4 h-4 ml-2" />
                הוסף ליד
              </Button>
              <Button variant="outline" className="justify-start">
                <Briefcase className="w-4 h-4 ml-2" />
                פרויקט חדש
              </Button>
              <Button variant="outline" className="justify-start">
                <Clock className="w-4 h-4 ml-2" />
                התחל טיימר
              </Button>
              <Button variant="outline" className="justify-start">
                <DollarSign className="w-4 h-4 ml-2" />
                הוסף תשלום
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}