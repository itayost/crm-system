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
  Inbox,
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

const REQUEST_TYPE_LABELS: Record<string, string> = {
  REQUEST: 'בקשה',
  BUG: 'תקלה',
  IMPROVEMENT: 'שיפור',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'ממתין לאישור',
  OPEN: 'פתוח',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופל',
  DISMISSED: 'נדחה',
}

const REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
}

interface ClientRequest {
  id: string
  title: string
  type: string
  status: string
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  COMPLETED: 'הושלם',
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-700',
}

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
  price?: number | string | null
  deadline?: string | null
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
      <div className="text-center py-12 text-gray-500">
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
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
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
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">כתובת:</span>
                <span className="text-sm font-medium">{client.address}</span>
              </div>
            )}
            {client.taxId && (
              <div>
                <span className="text-sm text-gray-600">ח.פ / ע.מ: </span>
                <span className="text-sm font-medium">{client.taxId}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">נוצר בתאריך: </span>
              <span className="text-sm font-medium">
                {formatDate(client.createdAt)}
              </span>
            </div>
          </div>
          {client.notes && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600 mb-1">הערות:</p>
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
              <code className="flex-1 truncate rounded bg-gray-100 px-3 py-2 text-sm" dir="ltr">
                {formUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                העתק
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
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
            <p className="text-sm text-gray-500 text-center py-6">
              אין אנשי קשר עדיין
            </p>
          ) : (
            <div className="space-y-3">
              {client.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
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
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{contact.name}</span>
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        ראשי
                      </Badge>
                    )}
                    {contact.role && (
                      <span className="text-xs text-gray-500">{contact.role}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500" dir="ltr">
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
            <p className="text-sm text-gray-500 text-center py-6">
              אין פרויקטים עדיין
            </p>
          ) : (
            <div className="space-y-3">
              {client.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
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
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{project.name}</span>
                    <Badge
                      className={PROJECT_STATUS_COLORS[project.status] ?? ''}
                      variant="secondary"
                    >
                      {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {project.price != null && (
                      <span>{formatCurrency(project.price)}</span>
                    )}
                    {project.deadline && <span>{formatDate(project.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-400" />
            פניות
          </CardTitle>
          <Button size="sm" onClick={() => setShowRequestForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            בקשה חדשה ללקוח זה
          </Button>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">אין פניות עדיין</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{request.title}</span>
                    <span className="text-xs text-gray-500">
                      {REQUEST_TYPE_LABELS[request.type] ?? request.type}
                    </span>
                  </div>
                  <Badge
                    className={REQUEST_STATUS_COLORS[request.status] ?? ''}
                    variant="secondary"
                  >
                    {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation timeline (wired in Phase 3) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            ציר זמן שיחות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 text-center py-6">
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
