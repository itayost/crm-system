'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowRight,
  Edit,
  Trash2,
  Building2,
  Star,
  Plus,
  Briefcase,
  User,
  MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ClientForm } from '@/components/forms/client-form'
import { ContactForm } from '@/components/forms/contact-form'
import { RequestForm } from '@/components/forms/request-form'
import { RequestListCard, type RequestListItem } from '@/components/requests/request-list-card'
import { tone, PROJECT_STATUS_TONES } from '@/lib/design/tones'
import { label, PROJECT_STATUS_LABELS } from '@/lib/design/labels'
import { projectTotal } from '@/lib/utils/project-money'
import type { PhaseSummary } from '@/lib/types/project'

type ClientRequest = RequestListItem

interface ClientContact {
  id: string
  name: string
  phone: string
  email?: string | null
  role?: string | null
  isPrimary: boolean
  status: string
}

interface ClientProject {
  id: string
  name: string
  status: string
  deadline?: string | null
  advanceAmount?: number | string | null
  advancePaidAt?: string | null
  phases: PhaseSummary[]
  _count?: { tasks: number }
}

interface ClientDetail {
  id: string
  name: string
  isVip: boolean
  isInternal: boolean
  address?: string | null
  taxId?: string | null
  notes?: string | null
  createdAt: string
  formToken: string | null
  contacts: ClientContact[]
  projects: ClientProject[]
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tokenBusy, setTokenBusy] = useState(false)

  const formUrl = client?.formToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${client.formToken}`
    : null

  const handleGenerateToken = async () => {
    if (!client) return
    // Resetting an existing token invalidates any link already shared with the client.
    if (
      client.formToken &&
      !window.confirm('איפוס הקישור ינתק את הקישור הקיים שכבר נשלח ללקוח. להמשיך?')
    ) {
      return
    }
    setTokenBusy(true)
    try {
      const { data } = await api.post(`/clients/${client.id}/form-token`)
      setClient({ ...client, formToken: data.formToken })
      toast.success('הקישור נוצר')
    } catch {
      toast.error('שגיאה ביצירת הקישור')
    } finally {
      setTokenBusy(false)
    }
  }

  const handleCopyLink = async () => {
    if (!formUrl) return
    try {
      await navigator.clipboard.writeText(formUrl)
      toast.success('הקישור הועתק')
    } catch {
      toast.error('שגיאה בהעתקת הקישור')
    }
  }

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get(`/requests?clientId=${id}`)
      setRequests(response.data)
    } catch {
      setRequests([])
    }
  }, [id])

  const fetchClient = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(`/clients/${id}`)
      setClient(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרטי לקוח')
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchClient()
    fetchRequests()
  }, [fetchClient, fetchRequests])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/clients/${id}`)
      toast.success('לקוח נמחק בהצלחה')
      router.push('/clients')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה במחיקת לקוח')
    } finally {
      setDeleting(false)
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

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount == null) return '-'
    return `${Number(amount).toLocaleString()} ₪`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12 text-content-subtle">
        <p>לקוח לא נמצא</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/clients')}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-content-strong">{client.name}</h1>
            {client.isVip && (
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            )}
            {client.isInternal && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                פנימי
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="w-4 h-4 ml-2" />
                מחיקה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת לקוח</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את {client.name}? פעולה זו אינה
                  ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>מחק</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Business details */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי עסק</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.address && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-content-faint" />
                <span className="text-sm text-content-muted">כתובת:</span>
                <span className="text-sm font-medium">{client.address}</span>
              </div>
            )}
            {client.taxId && (
              <div>
                <span className="text-sm text-content-muted">ח.פ / ע.מ: </span>
                <span className="text-sm font-medium">{client.taxId}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-content-muted">נוצר בתאריך: </span>
              <span className="text-sm font-medium">
                {formatDate(client.createdAt)}
              </span>
            </div>
          </div>
          {client.notes && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-content-muted mb-1">הערות:</p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form token link */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>טופס פניות</CardTitle>
          <Button size="sm" onClick={handleGenerateToken} disabled={tokenBusy}>
            {client.formToken ? 'אפס קישור' : 'צור קישור'}
          </Button>
        </CardHeader>
        <CardContent>
          {formUrl ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface-muted px-3 py-2 text-sm" dir="ltr">
                {formUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                העתק
              </Button>
            </div>
          ) : (
            <p className="text-sm text-content-subtle">
              צור קישור פרטי שהלקוח יכול להשתמש בו כדי לדווח על תקלות ובקשות.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Contacts (people) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>אנשי קשר</CardTitle>
          <Button size="sm" onClick={() => setShowContactForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף איש קשר
          </Button>
        </CardHeader>
        <CardContent>
          {client.contacts.length === 0 ? (
            <p className="text-sm text-content-subtle text-center py-6">
              אין אנשי קשר עדיין
            </p>
          ) : (
            <div className="space-y-3">
              {client.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      router.push(`/contacts/${contact.id}`)
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-content-faint" />
                    <span className="text-sm font-medium">{contact.name}</span>
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        ראשי
                      </Badge>
                    )}
                    {contact.role && (
                      <span className="text-xs text-content-subtle">{contact.role}</span>
                    )}
                  </div>
                  <span className="text-sm text-content-subtle" dir="ltr">
                    {contact.phone}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>פרויקטים</CardTitle>
          <Button
            size="sm"
            onClick={() => router.push(`/projects?new=true&clientId=${client.id}`)}
          >
            <Plus className="w-4 h-4 ml-2" />
            פרויקט חדש
          </Button>
        </CardHeader>
        <CardContent>
          {client.projects.length === 0 ? (
            <p className="text-sm text-content-subtle text-center py-6">
              אין פרויקטים עדיין
            </p>
          ) : (
            <div className="space-y-3">
              {client.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      router.push(`/projects/${project.id}`)
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-content-faint" />
                    <span className="text-sm font-medium">{project.name}</span>
                    <Badge
                      className={tone(PROJECT_STATUS_TONES, project.status)}
                      variant="secondary"
                    >
                      {label(PROJECT_STATUS_LABELS, project.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-content-subtle">
                    <span>{formatCurrency(projectTotal(project.advanceAmount, project.phases))}</span>
                    {project.deadline && <span>{formatDate(project.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestListCard
        requests={requests}
        action={
          <Button size="sm" onClick={() => setShowRequestForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            פניה חדשה ללקוח זה
          </Button>
        }
      />

      {/* Conversation timeline (wired in Phase 3) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-content-faint" />
            ציר זמן שיחות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-content-faint text-center py-6">
            סיכום שיחות וואטסאפ של כל אנשי הקשר יתווסף בקרוב
          </p>
        </CardContent>
      </Card>

      {/* Edit client */}
      <ClientForm
        client={client}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={fetchClient}
      />

      {/* Add contact to this client */}
      <ContactForm
        defaultClientId={client.id}
        open={showContactForm}
        onOpenChange={setShowContactForm}
        onSuccess={fetchClient}
      />

      {/* Add request for this client */}
      <RequestForm
        defaultClientId={client.id}
        open={showRequestForm}
        onOpenChange={setShowRequestForm}
        onSuccess={fetchRequests}
      />
    </div>
  )
}
