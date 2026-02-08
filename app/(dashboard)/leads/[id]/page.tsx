'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ActivityTimeline } from '@/components/activity/activity-timeline'
import { LeadForm } from '@/components/forms/lead-form'
import { ReminderDialog } from '@/components/notifications/reminder-dialog'
import {
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  Edit,
  Building,
  Calendar,
  Tag,
  DollarSign,
  FileText,
  ArrowRight,
  Clock,
} from 'lucide-react'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  CONTACTED: 'bg-orange-100 text-orange-800',
  QUOTED: 'bg-yellow-100 text-yellow-800',
  NEGOTIATING: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  NEW: 'חדש',
  CONTACTED: 'יצרתי קשר',
  QUOTED: 'הצעת מחיר',
  NEGOTIATING: 'משא ומתן',
  CONVERTED: 'הומר ללקוח',
  LOST: 'אבוד',
}

const sourceLabels: Record<string, string> = {
  WEBSITE: 'אתר',
  PHONE: 'טלפון',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'הפניה',
  OTHER: 'אחר',
}

const STATUS_ORDER = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'CONVERTED']

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  source: string
  status: string
  projectType: string | null
  estimatedBudget: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  convertedToClientId: string | null
  convertedAt: string | null
  client?: { id: string; name: string } | null
}

interface Activity {
  id: string
  action: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showReminder, setShowReminder] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [leadRes, activitiesRes] = await Promise.all([
        api.get(`/leads/${leadId}`),
        api.get(`/activities?entityType=Lead&entityId=${leadId}`),
      ])
      setLead(leadRes.data)
      setActivities(activitiesRes.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי ליד')
      router.push('/leads')
    } finally {
      setLoading(false)
    }
  }, [leadId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateLead = async (data: unknown) => {
    try {
      const response = await api.put(`/leads/${leadId}`, data)
      setLead(response.data)
      setShowEditForm(false)
      toast.success('ליד עודכן בהצלחה')
      // Refresh activities after update
      const activitiesRes = await api.get(`/activities?entityType=Lead&entityId=${leadId}`)
      setActivities(activitiesRes.data)
    } catch {
      toast.error('שגיאה בעדכון ליד')
    }
  }

  const handleConvert = async () => {
    if (!confirm('האם אתה בטוח שברצונך להמיר ליד זה ללקוח?')) return
    try {
      const response = await api.post(`/leads/${leadId}/convert`)
      toast.success('הליד הומר ללקוח בהצלחה!')
      router.push(`/clients/${response.data.client.id}`)
    } catch {
      toast.error('שגיאה בהמרת הליד ללקוח')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  if (!lead) return null

  const currentStatusIndex = STATUS_ORDER.indexOf(lead.status)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'דשבורד', href: '/' },
          { label: 'לידים', href: '/leads' },
          { label: lead.name },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">{lead.name}</h1>
            <Badge className={statusColors[lead.status]}>
              {statusLabels[lead.status] || lead.status}
            </Badge>
          </div>
          {lead.company && (
            <p className="text-gray-600 flex items-center gap-1">
              <Building className="h-4 w-4" />
              {lead.company}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `tel:${lead.phone}`}
          >
            <Phone className="h-4 w-4 ml-1" />
            התקשר
          </Button>
          {lead.email && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `mailto:${lead.email}`}
            >
              <Mail className="h-4 w-4 ml-1" />
              אימייל
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank')}
          >
            <MessageSquare className="h-4 w-4 ml-1" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditForm(true)}
          >
            <Edit className="h-4 w-4 ml-1" />
            ערוך
          </Button>
          {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReminder(true)}
            >
              <Clock className="h-4 w-4 ml-1" />
              תזכורת
            </Button>
          )}
          {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
            <Button size="sm" onClick={handleConvert}>
              <UserPlus className="h-4 w-4 ml-1" />
              המר ללקוח
            </Button>
          )}
        </div>
      </div>

      {/* Converted Notice */}
      {lead.status === 'CONVERTED' && lead.client && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              <span className="text-green-800">
                ליד זה הומר ללקוח <strong>{lead.client.name}</strong>
                {lead.convertedAt && (
                  <> בתאריך {new Date(lead.convertedAt).toLocaleDateString('he-IL')}</>
                )}
              </span>
            </div>
            <Link href={`/clients/${lead.client.id}`}>
              <Button variant="outline" size="sm">
                <ArrowRight className="h-4 w-4 ml-1" />
                עבור ללקוח
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Main Content: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead Info (2/3) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פרטי ליד</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={Phone} label="טלפון" value={lead.phone} />
                <InfoRow icon={Mail} label="אימייל" value={lead.email || '—'} />
                <InfoRow icon={Building} label="חברה" value={lead.company || '—'} />
                <InfoRow icon={Tag} label="מקור" value={sourceLabels[lead.source] || lead.source} />
                <InfoRow icon={FileText} label="סוג פרויקט" value={lead.projectType || '—'} />
                <InfoRow
                  icon={DollarSign}
                  label="תקציב משוער"
                  value={lead.estimatedBudget ? `₪${Number(lead.estimatedBudget).toLocaleString()}` : '—'}
                />
                <InfoRow
                  icon={Calendar}
                  label="נוצר בתאריך"
                  value={new Date(lead.createdAt).toLocaleDateString('he-IL')}
                />
              </div>
              {lead.notes && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-500 mb-1">הערות</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Status Pipeline (1/3) */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">מצב ליד</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {STATUS_ORDER.map((status, index) => {
                  const isActive = status === lead.status
                  const isPassed = index < currentStatusIndex
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 ${
                          isActive
                            ? 'bg-blue-600 ring-4 ring-blue-100'
                            : isPassed
                            ? 'bg-green-500'
                            : 'bg-gray-200'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          isActive
                            ? 'font-bold text-blue-600'
                            : isPassed
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {statusLabels[status]}
                      </span>
                    </div>
                  )
                })}
                {lead.status === 'LOST' && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0 bg-red-500 ring-4 ring-red-100" />
                    <span className="text-sm font-bold text-red-600">אבוד</span>
                  </div>
                )}
              </div>
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
          <ActivityTimeline activities={activities} emptyMessage="אין פעילויות עבור ליד זה" />
        </CardContent>
      </Card>

      {/* Edit Lead Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>עריכת ליד</DialogTitle>
          </DialogHeader>
          <LeadForm
            onSubmit={handleUpdateLead}
            onCancel={() => setShowEditForm(false)}
            initialData={{
              name: lead.name,
              email: lead.email || '',
              phone: lead.phone,
              company: lead.company || '',
              source: lead.source,
              projectType: lead.projectType || '',
              estimatedBudget: lead.estimatedBudget?.toString() || '',
              notes: lead.notes || '',
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <ReminderDialog
        open={showReminder}
        onOpenChange={setShowReminder}
        entityType="Lead"
        entityId={lead.id}
        entityName={lead.name}
      />
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
