'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Edit,
  Trash2,
  Building2,
  Star,
  Plus,
  Briefcase,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
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
import { ClientProfileCard } from '@/components/clients/profile-card'
import { ClientSummaryBand } from '@/components/clients/client-summary-band'
import { ClientMoneyCard } from '@/components/clients/client-money-card'
import { ClientMessagesCard } from '@/components/clients/client-messages-card'
import { AwaitingClientCard } from '@/components/requests/awaiting-client-card'
import { DecisionsCard } from '@/components/requests/decisions-card'
import { RequestPipeline } from '@/components/requests/request-pipeline'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'
import type { RequestRecord } from '@/lib/types/request'
import { toneOf, PROJECT_STATUS_TONES } from '@/lib/design/tones'
import { label, PROJECT_STATUS_LABELS } from '@/lib/design/labels'
import { projectTotal } from '@/lib/utils/project-money'
import { formatCurrency, formatDate } from '@/lib/utils'
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
  profileHe?: string | null
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
  const [metrics, setMetrics] = useState<RequestMetrics | null>(null)
  const [awaiting, setAwaiting] = useState<RequestRecord[]>([])
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

  const fetchMetrics = useCallback(async () => {
    try {
      // Same service the dashboard reads, scoped to this client - so "6 need
      // pricing" here means exactly what it means there.
      const response = await api.get(`/requests/metrics?clientId=${id}`)
      setMetrics(response.data)
    } catch {
      setMetrics(null)
    }
  }, [id])

  const fetchAwaiting = useCallback(async () => {
    try {
      const response = await api.get(`/requests?clientId=${id}&awaitingClient=true`)
      setAwaiting(response.data)
    } catch {
      setAwaiting([])
    }
  }, [id])

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
    fetchMetrics()
    fetchAwaiting()
  }, [fetchClient, fetchRequests, fetchMetrics, fetchAwaiting])

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
              <Star role="img" aria-label="VIP" className="w-5 h-5 text-marker-vip fill-marker-vip" />
            )}
            {client.isInternal && (
              <StatusPill tone="info" emphasis="quiet" dot>
                פנימי
              </StatusPill>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Edit className="w-4 h-4" />
            עריכה
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="w-4 h-4" />
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

      <ClientSummaryBand
        projects={client.projects}
        openRequests={
          metrics ? metrics.pipeline.pendingReview + metrics.pipeline.open + metrics.pipeline.inProgress : null
        }
        formUrl={formUrl}
        onRegenerate={handleGenerateToken}
        regenerating={tokenBusy}
      />

      {/* What needs a decision, before anything descriptive. Both cards render
          their own quiet state, and the pipeline only earns its space once the
          client has enough requests for a shape to exist. */}
      {metrics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DecisionsCard metrics={metrics} />
          {metrics.pipeline.open + metrics.pipeline.resolved >= 5 && (
            <RequestPipeline metrics={metrics} />
          )}
        </div>
      )}

      <AwaitingClientCard awaiting={awaiting} />

      <ClientMoneyCard projects={client.projects} />

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

      {/* Contacts (people) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>אנשי קשר</CardTitle>
          <Button size="sm" onClick={() => setShowContactForm(true)}>
            <Plus className="w-4 h-4" />
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
                      <StatusPill tone="success" emphasis="quiet" dot>
                        ראשי
                      </StatusPill>
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
            <Plus className="w-4 h-4" />
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
                    <StatusPill tone={toneOf(PROJECT_STATUS_TONES, project.status)} dot>
                      {label(PROJECT_STATUS_LABELS, project.status)}
                    </StatusPill>
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

      <ClientProfileCard clientId={client.id} profileHe={client.profileHe ?? null} onSaved={fetchClient} />

      <RequestListCard
        requests={requests}
        action={
          <Button size="sm" onClick={() => setShowRequestForm(true)}>
            <Plus className="w-4 h-4" />
            פניה חדשה ללקוח זה
          </Button>
        }
      />

      <ClientMessagesCard clientId={id} />

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
