'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ActivityTimeline } from '@/components/activity/activity-timeline'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientForm } from '@/components/forms/client-form'
import {
  Phone,
  Mail,
  MessageSquare,
  Building,
  Star,
  Edit,
  FolderOpen,
  CreditCard,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
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

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'ממתין',
  PAID: 'שולם',
  OVERDUE: 'באיחור',
  CANCELLED: 'בוטל',
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

interface Project {
  id: string
  name: string
  type: string
  stage: string
  status: string
  priority: string
  budget: number | null
  deadline: string | null
  createdAt: string
  timeEntries?: Array<{
    id: string
    startTime: string
    endTime: string | null
    duration: number | null
    description: string | null
    projectId: string
  }>
  _count?: { tasks: number }
}

interface Payment {
  id: string
  amount: number
  status: string
  type: string
  dueDate: string
  paidAt: string | null
  invoiceNumber: string | null
  notes: string | null
}

interface Client {
  id: string
  name: string
  email: string
  phone: string
  company: string | null
  address: string | null
  taxId: string | null
  type: 'REGULAR' | 'VIP'
  status: 'ACTIVE' | 'INACTIVE'
  totalRevenue: number
  notes: string | null
  createdAt: string
  updatedAt: string
  projects: Project[]
  payments: Payment[]
  recurringPayments: Array<{
    id: string
    name: string
    amount: number
    frequency: string
    nextDueDate: string
    isActive: boolean
  }>
  _count: { projects: number; payments: number }
}

interface Activity {
  id: string
  action: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, activitiesRes] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/activities?entityType=Client&entityId=${clientId}`),
      ])
      setClient(clientRes.data)
      setActivities(activitiesRes.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי לקוח')
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }, [clientId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateClient = async (data: unknown) => {
    try {
      const response = await api.put(`/clients/${clientId}`, data)
      setClient(prev => prev ? { ...prev, ...response.data } : null)
      setShowEditForm(false)
      toast.success('לקוח עודכן בהצלחה')
      const activitiesRes = await api.get(`/activities?entityType=Client&entityId=${clientId}`)
      setActivities(activitiesRes.data)
    } catch {
      toast.error('שגיאה בעדכון לקוח')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  if (!client) return null

  // Calculate stats
  const allTimeEntries = client.projects.flatMap(p => p.timeEntries || [])
  const totalHours = allTimeEntries.reduce((sum, t) => sum + (t.duration || 0), 0) / 60
  const paidRevenue = client.payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'דשבורד', href: '/' },
          { label: 'לקוחות', href: '/clients' },
          { label: client.name },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">{client.name}</h1>
            {client.type === 'VIP' && (
              <Badge className="bg-yellow-100 text-yellow-800">
                <Star className="h-3 w-3 ml-1 fill-yellow-500" />
                VIP
              </Badge>
            )}
            <Badge className={client.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {client.status === 'ACTIVE' ? 'פעיל' : 'לא פעיל'}
            </Badge>
          </div>
          {client.company && (
            <p className="text-gray-600 flex items-center gap-1">
              <Building className="h-4 w-4" />
              {client.company}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = `tel:${client.phone}`}>
            <Phone className="h-4 w-4 ml-1" />
            התקשר
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = `mailto:${client.email}`}>
            <Mail className="h-4 w-4 ml-1" />
            אימייל
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`, '_blank')}>
            <MessageSquare className="h-4 w-4 ml-1" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
            <Edit className="h-4 w-4 ml-1" />
            ערוך
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">פרויקטים</p>
                <p className="text-2xl font-bold">{client._count.projects}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">הכנסות</p>
                <p className="text-2xl font-bold">₪{paidRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">שעות עבודה</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">לקוח מאז</p>
                <p className="text-2xl font-bold">{new Date(client.createdAt).toLocaleDateString('he-IL')}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="projects" dir="rtl">
        <TabsList>
          <TabsTrigger value="projects">
            פרויקטים ({client.projects.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            תשלומים ({client.payments.length})
          </TabsTrigger>
          <TabsTrigger value="time">
            זמנים ({allTimeEntries.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            פעילות ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="info">
            מידע
          </TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <Card>
            <CardContent className="p-0">
              {client.projects.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={FolderOpen} title="אין פרויקטים" description="לא נמצאו פרויקטים עבור לקוח זה" />
                </div>
              ) : (
                <div className="divide-y">
                  {client.projects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="block hover:bg-gray-50 transition-colors">
                      <div className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-800">{project.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={stageColors[project.stage]}>
                              {stageLabels[project.stage] || project.stage}
                            </Badge>
                            {project._count && (
                              <span className="text-xs text-gray-500">{project._count.tasks} משימות</span>
                            )}
                          </div>
                        </div>
                        <div className="text-left space-y-1">
                          {project.budget && (
                            <p className="text-sm font-medium">₪{Number(project.budget).toLocaleString()}</p>
                          )}
                          {project.deadline && (
                            <p className="text-xs text-gray-500">{new Date(project.deadline).toLocaleDateString('he-IL')}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {client.payments.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={CreditCard} title="אין תשלומים" description="לא נמצאו תשלומים עבור לקוח זה" />
                </div>
              ) : (
                <div className="divide-y">
                  {client.payments.map((payment) => (
                    <div key={payment.id} className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">₪{Number(payment.amount).toLocaleString()}</p>
                          <Badge className={paymentStatusColors[payment.status]}>
                            {paymentStatusLabels[payment.status] || payment.status}
                          </Badge>
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-gray-500">{payment.notes}</p>
                        )}
                      </div>
                      <div className="text-left space-y-1">
                        <p className="text-sm text-gray-600">
                          {new Date(payment.dueDate).toLocaleDateString('he-IL')}
                        </p>
                        {payment.invoiceNumber && (
                          <p className="text-xs text-gray-500">חשבונית: {payment.invoiceNumber}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time">
          <Card>
            <CardContent className="p-0">
              {allTimeEntries.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Clock} title="אין רשומות זמן" description="לא נמצאו רשומות זמן עבור לקוח זה" />
                </div>
              ) : (
                <div className="divide-y">
                  {allTimeEntries.map((entry) => {
                    const project = client.projects.find(p => p.id === entry.projectId)
                    return (
                      <div key={entry.id} className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-800">{project?.name || '—'}</p>
                          {entry.description && (
                            <p className="text-xs text-gray-500">{entry.description}</p>
                          )}
                        </div>
                        <div className="text-left space-y-1">
                          <p className="text-sm font-medium">
                            {entry.duration ? `${(entry.duration / 60).toFixed(1)} שעות` : 'פעיל'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.startTime).toLocaleDateString('he-IL')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">היסטוריית פעילות</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} emptyMessage="אין פעילויות עבור לקוח זה" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">פרטי לקוח</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
                <Edit className="h-4 w-4 ml-1" />
                ערוך
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={Phone} label="טלפון" value={client.phone} />
                <InfoRow icon={Mail} label="אימייל" value={client.email} />
                <InfoRow icon={Building} label="חברה" value={client.company || '—'} />
                <InfoRow icon={MapPin} label="כתובת" value={client.address || '—'} />
                <InfoRow icon={FileText} label="ח.פ / ע.מ" value={client.taxId || '—'} />
                <InfoRow icon={Star} label="סוג לקוח" value={client.type === 'VIP' ? 'VIP' : 'רגיל'} />
                <InfoRow icon={Calendar} label="נוצר בתאריך" value={new Date(client.createdAt).toLocaleDateString('he-IL')} />
                <InfoRow icon={DollarSign} label="הכנסות כוללות" value={`₪${Number(client.totalRevenue).toLocaleString()}`} />
              </div>
              {client.notes && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-500 mb-1">הערות</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Client Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>עריכת לקוח</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleUpdateClient}
            onCancel={() => setShowEditForm(false)}
            initialData={{
              name: client.name,
              email: client.email,
              phone: client.phone,
              company: client.company || '',
              address: client.address || '',
              taxId: client.taxId || '',
              type: client.type,
              notes: client.notes || '',
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  )
}
