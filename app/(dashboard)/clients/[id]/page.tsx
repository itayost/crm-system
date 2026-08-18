'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit, Trash2, Plus, Link2, RotateCcw, Check, Star } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientForm } from '@/components/forms/client-form'
import { ContactForm } from '@/components/forms/contact-form'
import { RequestForm } from '@/components/forms/request-form'
import { RequestListCard, type RequestListItem } from '@/components/requests/request-list-card'
import { ClientProfileCard } from '@/components/clients/profile-card'
import { ClientMessagesCard } from '@/components/clients/client-messages-card'
import {
  DetailHeader,
  MoneyLine,
  FactRail,
  DataTable,
  EmptyState,
  ConfirmDelete,
  PhaseStrip,
  type Column,
  type Fact,
} from '@/components/patterns'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'
import { toneOf, PROJECT_STATUS_TONES, CONTACT_STATUS_TONES } from '@/lib/design/tones'
import { label, PROJECT_STATUS_LABELS, CONTACT_STATUS_LABELS } from '@/lib/design/labels'
import { projectTotal, projectPaid, projectOutstanding } from '@/lib/utils/project-money'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PhaseSummary } from '@/lib/types/project'

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

const TABS = ['projects', 'requests', 'people', 'profile', 'whatsapp'] as const
type Tab = (typeof TABS)[number]

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [requests, setRequests] = useState<RequestListItem[]>([])
  const [metrics, setMetrics] = useState<RequestMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Tab>('projects')

  // Deep-linkable without pulling the page into a Suspense boundary, which is
  // what useSearchParams would require. Same approach the tasks page takes.
  const readTabFromUrl = useRef(false)
  useEffect(() => {
    if (readTabFromUrl.current) return
    readTabFromUrl.current = true
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    if (fromUrl && (TABS as readonly string[]).includes(fromUrl)) setTab(fromUrl as Tab)
  }, [])

  const selectTab = (next: string) => {
    setTab(next as Tab)
    window.history.replaceState(null, '', `/clients/${id}?tab=${next}`)
  }

  const formUrl = client?.formToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${client.formToken}`
    : null

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

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get(`/requests?clientId=${id}`)
      setRequests(response.data)
    } catch {
      setRequests([])
    }
  }, [id])

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await api.get(`/requests/metrics?clientId=${id}`)
      setMetrics(response.data)
    } catch {
      setMetrics(null)
    }
  }, [id])

  useEffect(() => {
    fetchClient()
    fetchRequests()
    fetchMetrics()
  }, [fetchClient, fetchRequests, fetchMetrics])

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
      setConfirmRotate(false)
    }
  }

  const handleCopy = async () => {
    if (!formUrl) return handleGenerateToken()
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('לא הצלחנו להעתיק. הקישור מופיע בפרטים מימין.')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/clients/${id}`)
      toast.success('לקוח נמחק בהצלחה')
      router.push('/clients')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה במחיקת לקוח')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const money = useMemo(() => {
    const projects = client?.projects ?? []
    return {
      total: projects.reduce((s, p) => s + projectTotal(p.advanceAmount, p.phases), 0),
      paid: projects.reduce(
        (s, p) => s + projectPaid(p.advanceAmount, p.advancePaidAt, p.phases),
        0,
      ),
      outstanding: projects.reduce((s, p) => s + projectOutstanding(p.phases), 0),
    }
  }, [client])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!client) {
    return <EmptyState kind="filtered" title="לקוח לא נמצא" />
  }

  const primaryContact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0]
  const openRequests = metrics
    ? metrics.pipeline.pendingReview + metrics.pipeline.open + metrics.pipeline.inProgress
    : null
  const activeProjects = client.projects.filter((p) => p.status === 'ACTIVE').length

  const facts: Fact[] = [
    {
      term: 'מצב',
      value:
        activeProjects > 0 ? (
          <StatusPill tone="success" emphasis="quiet" dot>פעיל</StatusPill>
        ) : (
          <StatusPill tone="neutral" emphasis="quiet" dot>רדום</StatusPill>
        ),
    },
    {
      term: 'איש קשר',
      hideWhenEmpty: true,
      value: primaryContact && (
        <span className="flex flex-col gap-0.5">
          <span>{primaryContact.name}</span>
          <a
            href={`tel:${primaryContact.phone}`}
            dir="ltr"
            className="font-mono text-link tabular-nums"
          >
            {primaryContact.phone}
          </a>
        </span>
      ),
    },
    { term: 'ח.פ / ע.מ', hideWhenEmpty: true, value: client.taxId && <bdi dir="ltr" className="font-mono">{client.taxId}</bdi> },
    { term: 'כתובת', hideWhenEmpty: true, value: client.address },
    {
      term: 'לקוח מאז',
      // Seeded at run time in e2e, so this reads "today" and would break the
      // baseline tomorrow. Masked rather than frozen.
      value: (
        <bdi data-volatile className="font-mono tabular-nums">
          {formatDate(client.createdAt)}
        </bdi>
      ),
    },
    {
      term: 'פורטל',
      value: formUrl ? (
        <span className="flex flex-col gap-1">
          <span className="text-figure-paid">פעיל</span>
          {/* The absolute URL, not the path. Someone selects this text and
              pastes it into WhatsApp; a relative path is useless there. */}
          <code
            data-testid="portal-url"
            dir="ltr"
            className="block truncate text-ui-2xs text-content-faint"
          >
            {formUrl}
          </code>
        </span>
      ) : (
        // A fact, not a second button. Creating the link is the page's primary
        // action and lives in the header; offering it twice under two nearly
        // identical labels is how you end up with two things to maintain and a
        // user wondering whether they do the same thing.
        <span className="text-content-faint">לא נוצר עדיין</span>
      ),
    },
    {
      term: 'הערות',
      hideWhenEmpty: true,
      value: client.notes && (
        <p className="whitespace-pre-wrap text-content-muted">{client.notes}</p>
      ),
    },
  ]

  // Per-project money lives here, as columns of a table that is being read
  // anyway - not as a second card. Per-phase money belongs to the project page.
  const projectColumns: Column<ClientProject>[] = [
    { key: 'name', header: 'פרויקט', mobile: 'primary', cell: (p) => p.name },
    {
      key: 'status',
      header: 'מצב',
      mobile: 'trailing',
      cell: (p) => (
        <StatusPill tone={toneOf(PROJECT_STATUS_TONES, p.status)} dot>
          {label(PROJECT_STATUS_LABELS, p.status)}
        </StatusPill>
      ),
    },
    {
      key: 'phases',
      header: 'שלבים',
      width: '8rem',
      cell: (p) =>
        p.phases.length > 0 ? <PhaseStrip phases={p.phases} /> : <span className="text-content-faint">—</span>,
    },
    {
      key: 'total',
      header: 'סה"כ',
      align: 'numeric',
      width: '7rem',
      mobile: 'meta',
      cell: (p) => <bdi>{formatCurrency(projectTotal(p.advanceAmount, p.phases))}</bdi>,
    },
    {
      key: 'paid',
      header: 'שולם',
      align: 'numeric',
      width: '7rem',
      cell: (p) => {
        const v = projectPaid(p.advanceAmount, p.advancePaidAt, p.phases)
        return v > 0 ? <bdi className="text-figure-paid">{formatCurrency(v)}</bdi> : <span className="text-content-faint">—</span>
      },
    },
    {
      key: 'outstanding',
      header: 'לגבייה',
      align: 'numeric',
      width: '7rem',
      mobile: 'meta',
      cell: (p) => {
        const v = projectOutstanding(p.phases)
        return v > 0 ? <bdi className="font-semibold text-figure-due">{formatCurrency(v)}</bdi> : <span className="text-content-faint">—</span>
      },
    },
    {
      key: 'deadline',
      header: 'דדליין',
      align: 'numeric',
      width: '7rem',
      cell: (p) => <bdi>{formatDate(p.deadline)}</bdi>,
    },
  ]

  const contactColumns: Column<ClientContact>[] = [
    { key: 'name', header: 'שם', mobile: 'primary', cell: (c) => c.name },
    { key: 'role', header: 'תפקיד', mobile: 'meta', cell: (c) => c.role ?? '—' },
    {
      key: 'primary',
      header: 'ראשי',
      width: '5rem',
      cell: (c) =>
        c.isPrimary ? (
          <StatusPill tone="success" emphasis="quiet" dot>ראשי</StatusPill>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'טלפון',
      align: 'numeric',
      mobile: 'meta',
      cell: (c) => (
        <bdi dir="ltr">{c.phone}</bdi>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      mobile: 'trailing',
      cell: (c) => (
        <StatusPill tone={toneOf(CONTACT_STATUS_TONES, c.status)} dot>
          {label(CONTACT_STATUS_LABELS, c.status)}
        </StatusPill>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <DetailHeader
        backHref="/clients"
        breadcrumb="לקוחות /"
        title={client.name}
        pills={
          <>
            {client.isVip && (
              <Star role="img" aria-label="VIP" className="size-4 fill-marker-vip text-marker-vip" />
            )}
            {client.isInternal && (
              <StatusPill tone="info" emphasis="quiet" dot>פנימי</StatusPill>
            )}
          </>
        }
        primaryAction={
          // Literally what this page gets opened for, mid-WhatsApp-conversation.
          <Button size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? 'הועתק' : client.formToken ? 'העתק קישור פורטל' : 'צור קישור פורטל'}
          </Button>
        }
        menu={
          <>
            <DropdownMenuItem onClick={() => setShowEditForm(true)}>
              <Edit className="size-4" />
              עריכת פרטים
            </DropdownMenuItem>
            {client.formToken && (
              <DropdownMenuItem onClick={() => setConfirmRotate(true)}>
                <RotateCcw className="size-4" />
                אפס קישור פורטל
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-tone-danger-foreground"
            >
              <Trash2 className="size-4" />
              מחיקת לקוח
            </DropdownMenuItem>
          </>
        }
      />

      {/*
        Money at exactly one granularity, and the granularity is this page's own
        noun. It used to appear three times in three shapes: an aggregate band,
        a per-project/per-phase card, and again per row in the projects card -
        all three computed from the same helpers.
      */}
      <MoneyLine
        figures={[
          { term: 'מוסכם', value: formatCurrency(money.total) },
          { term: 'שולם', value: formatCurrency(money.paid), tone: money.paid > 0 ? 'paid' : 'muted' },
          {
            term: 'לגבייה',
            value: money.outstanding > 0 ? formatCurrency(money.outstanding) : '—',
            tone: money.outstanding > 0 ? 'due' : 'muted',
          },
          { term: 'פניות פתוחות', value: openRequests ?? '—' },
        ]}
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Tabs value={tab} onValueChange={selectTab} className="flex flex-col gap-3">
          <TabsList className="w-max">
            <TabsTrigger value="projects">פרויקטים {client.projects.length || ''}</TabsTrigger>
            <TabsTrigger value="requests">פניות {openRequests || ''}</TabsTrigger>
            <TabsTrigger value="people">אנשים {client.contacts.length || ''}</TabsTrigger>
            <TabsTrigger value="profile">פרופיל הבוט</TabsTrigger>
            <TabsTrigger value="whatsapp">וואטסאפ</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="m-0 flex flex-col gap-2">
            {client.projects.length === 0 ? (
              <EmptyState
                kind="new"
                title="אין פרויקטים"
                description="פרויקט הוא מה שמחזיק את השלבים והכסף של הלקוח הזה."
                action={
                  <Button
                    size="sm"
                    onClick={() => router.push(`/projects?new=true&clientId=${client.id}`)}
                  >
                    <Plus className="size-4" />
                    פרויקט חדש
                  </Button>
                }
              />
            ) : (
              <>
                <DataTable
                  rows={client.projects}
                  columns={projectColumns}
                  getRowId={(p) => p.id}
                  getRowHref={(p) => `/projects/${p.id}`}
                />
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/projects?new=true&clientId=${client.id}`)}
                  >
                    <Plus className="size-4" />
                    פרויקט חדש
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="requests" className="m-0">
            <RequestListCard
              requests={requests}
              action={
                <Button size="sm" onClick={() => setShowRequestForm(true)}>
                  <Plus className="size-4" />
                  פנייה חדשה
                </Button>
              }
            />
          </TabsContent>

          <TabsContent value="people" className="m-0 flex flex-col gap-2">
            {client.contacts.length === 0 ? (
              <EmptyState
                kind="new"
                title="אין אנשי קשר"
                description="מי מדבר איתך בעסק הזה."
                action={
                  <Button size="sm" onClick={() => setShowContactForm(true)}>
                    <Plus className="size-4" />
                    הוסף איש קשר
                  </Button>
                }
              />
            ) : (
              <>
                <DataTable
                  rows={client.contacts}
                  columns={contactColumns}
                  getRowId={(c) => c.id}
                  getRowHref={(c) => `/contacts/${c.id}`}
                />
                <div>
                  <Button size="sm" variant="outline" onClick={() => setShowContactForm(true)}>
                    <Plus className="size-4" />
                    הוסף איש קשר
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="profile" className="m-0">
            <ClientProfileCard
              clientId={client.id}
              profileHe={client.profileHe ?? null}
              onSaved={fetchClient}
            />
          </TabsContent>

          <TabsContent value="whatsapp" className="m-0">
            <ClientMessagesCard clientId={id} />
          </TabsContent>
        </Tabs>

        <FactRail facts={facts} className="lg:sticky lg:top-3" />
      </div>

      <ClientForm
        client={client}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={fetchClient}
      />

      <ContactForm
        defaultClientId={client.id}
        open={showContactForm}
        onOpenChange={setShowContactForm}
        onSuccess={fetchClient}
      />

      <RequestForm
        defaultClientId={client.id}
        open={showRequestForm}
        onOpenChange={setShowRequestForm}
        onSuccess={fetchRequests}
      />

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        pending={deleting}
        title="מחיקת לקוח"
        description={`למחוק את ${client.name}? הפעולה אינה ניתנת לביטול.`}
        onConfirm={handleDelete}
      />

      {/* Was a raw window.confirm(), in an app that has a styled dialog. */}
      <ConfirmDelete
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        pending={tokenBusy}
        title="איפוס קישור הפורטל"
        description="הקישור שכבר נשלח ללקוח יפסיק לעבוד מייד. צריך לשלוח לו את החדש."
        confirmLabel="אפס קישור"
        onConfirm={handleGenerateToken}
      />
    </div>
  )
}
