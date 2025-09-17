'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import api from '@/lib/api/client'
import { 
  DollarSign, 
  Clock, 
   
  Briefcase, 
  Target,
  ArrowUpRight
} from 'lucide-react'

interface DashboardMetrics {
  totalClients: number
  activeProjects: number
  totalRevenue: number
  monthlyRevenue: number
  pendingPayments: number
  overduePayments: number
  totalTasks: number
  completedTasks: number
  activeTasks: number
  totalHours: number
  weeklyHours: number
  leadConversionRate: number
  totalLeads: number
  convertedLeads: number
}

interface RevenueData {
  month: string
  revenue: number
  payments: number
}

interface TimeData {
  date: string
  hours: number
  projects: number
}

interface ProjectAnalytics {
  id: string
  name: string
  type: string
  client: string
  estimatedHours: number
  actualHours: number
  budget: number
  revenue: number
  profitability: number
  completion: number
  status: string
}

export default function ReportsPage() {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [timeData, setTimeData] = useState<TimeData[]>([])
  const [projectAnalytics, setProjectAnalytics] = useState<ProjectAnalytics[]>([])
  const [leadFunnelData, setLeadFunnelData] = useState([])
  const [clientAnalytics, setClientAnalytics] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30')

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/reports/dashboard')
      setDashboardMetrics(response.data)
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
    }
  }

  const fetchRevenueData = async () => {
    try {
      const response = await api.get('/reports/revenue?months=12')
      setRevenueData(response.data.revenueData)
      setClientAnalytics(response.data.clientAnalytics)
    } catch (error) {
      console.error('Error fetching revenue data:', error)
    }
  }

  const fetchTimeData = useCallback(async () => {
    try {
      const response = await api.get(`/reports/time?days=${timeRange}`)
      setTimeData(response.data)
    } catch (error) {
      console.error('Error fetching time data:', error)
    }
  }, [timeRange])

  const fetchProjectData = async () => {
    try {
      const response = await api.get('/reports/projects')
      setProjectAnalytics(response.data.projectAnalytics)
      setLeadFunnelData(response.data.leadFunnelData)
    } catch (error) {
      console.error('Error fetching project data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    fetchRevenueData()
    fetchProjectData()
  }, [])

  useEffect(() => {
    fetchTimeData()
  }, [fetchTimeData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(value)
  }

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)} שעות`
  }

  if (loading || !dashboardMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">טוען דוחות...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">דוחות וניתוחים</h1>
          <p className="text-gray-600 mt-1">תובנות עסקיות ומדדי ביצועים</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">הכנסות השנה</p>
                <p className="text-xl font-bold">{formatCurrency(dashboardMetrics.totalRevenue)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">החודש: {formatCurrency(dashboardMetrics.monthlyRevenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">פרויקטים פעילים</p>
                <p className="text-xl font-bold">{dashboardMetrics.activeProjects}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-600">סה״כ לקוחות: {dashboardMetrics.totalClients}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">שעות עבודה</p>
                <p className="text-xl font-bold">{formatHours(dashboardMetrics.totalHours)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-600">השבוע: {formatHours(dashboardMetrics.weeklyHours)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">המרת לידים</p>
                <p className="text-xl font-bold">{dashboardMetrics.leadConversionRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-600">{dashboardMetrics.convertedLeads}/{dashboardMetrics.totalLeads} לידים</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">הכנסות</TabsTrigger>
          <TabsTrigger value="time">זמנים</TabsTrigger>
          <TabsTrigger value="projects">פרויקטים</TabsTrigger>
          <TabsTrigger value="clients">לקוחות</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>הכנסות לפי חודשים</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'הכנסות']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="הכנסות"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>תשלומים לפי חודשים</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="payments" fill="#82ca9d" name="מספר תשלומים" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Clients */}
          <Card>
            <CardHeader>
              <CardTitle>הלקוחות המובילים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clientAnalytics.slice(0, 5).map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        {client.company && <p className="text-sm text-gray-600">{client.company}</p>}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{formatCurrency(client.totalRevenue)}</p>
                      <p className="text-sm text-gray-600">{client.projectsCount} פרויקטים</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>מעקב זמנים יומי</CardTitle>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">שבוע</SelectItem>
                  <SelectItem value="30">חודש</SelectItem>
                  <SelectItem value="90">3 חודשים</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'hours' ? formatHours(value) : value,
                      name === 'hours' ? 'שעות' : 'פרויקטים'
                    ]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="hours" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="שעות עבודה"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projects" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="מספר פרויקטים"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ניתוח פרויקטים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {projectAnalytics.slice(0, 5).map((project) => (
                    <div key={project.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{project.name}</h4>
                        <Badge variant={project.status === 'COMPLETED' ? 'secondary' : 'default'}>
                          {project.completion}% הושלם
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{project.client}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">שעות: </span>
                          <span>{project.actualHours}/{project.estimatedHours}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">רווחיות: </span>
                          <span className={project.profitability > 0 ? 'text-green-600' : 'text-red-600'}>
                            {project.profitability.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>משפך המרת לידים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leadFunnelData.map((stage, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {stage.count}
                        </div>
                        <span>{stage.stage}</span>
                      </div>
                      <div className="text-left">
                        <span className="font-bold">{stage.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ניתוח לקוחות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientAnalytics.map((client) => (
                  <Card key={client.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{client.name}</h4>
                        <Badge variant={client.type === 'VIP' ? 'secondary' : 'outline'}>
                          {client.type === 'VIP' ? 'VIP' : 'רגיל'}
                        </Badge>
                      </div>
                      {client.company && (
                        <p className="text-sm text-gray-600 mb-2">{client.company}</p>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">סה״כ הכנסות:</span>
                          <span className="font-medium">{formatCurrency(client.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">פרויקטים:</span>
                          <span>{client.projectsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ממוצע פרויקט:</span>
                          <span>{formatCurrency(client.averageProjectValue)}</span>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-gray-600">פרויקט אחרון:</p>
                          <p className="text-xs truncate">{client.lastProject}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}