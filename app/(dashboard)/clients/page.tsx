'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { ClientForm } from '@/components/forms/client-form'
import {
  PageHeader,
  SearchField,
  SegmentControl,
  DataTable,
  EmptyState,
  TableSkeleton,
  PhaseStrip,
  type Column,
  type Segment,
} from '@/components/patterns'
import { formatCurrency } from '@/lib/utils'
import {
  projectTotal,
  projectPaid,
  projectOutstanding,
  type PhaseAmount,
} from '@/lib/utils/project-money'

interface ClientProject {
  status: string
  advanceAmount: string | number | null
  advancePaidAt: string | null
  phases: PhaseAmount[]
}

interface Client {
  id: string
  name: string
  isVip: boolean
  isInternal: boolean
  formToken?: string | null
  _count: { contacts: number; projects: number }
  projects: ClientProject[]
}

/** Money and activity for one client, through the shared helpers. */
function summarise(client: Client) {
  const projects = client.projects ?? []

  const total = projects.reduce((sum, p) => sum + projectTotal(p.advanceAmount, p.phases), 0)
  const paid = projects.reduce(
    (sum, p) => sum + projectPaid(p.advanceAmount, p.advancePaidAt, p.phases),
    0,
  )
  const outstanding = projects.reduce((sum, p) => sum + projectOutstanding(p.phases), 0)
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length

  return { total, paid, outstanding, activeProjects, isActive: activeProjects > 0 }
}

type View = 'active' | 'dormant' | 'all'

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('active')
  const [showForm, setShowForm] = useState(false)

  // ⌘K offers "לקוח חדש" as /clients?new=true, which only /projects knew how to
  // honour - so the palette's create action navigated here and then did nothing.
  const readQuery = useRef(false)
  useEffect(() => {
    if (readQuery.current) return
    readQuery.current = true
    if (new URLSearchParams(window.location.search).get('new') === 'true') {
      setShowForm(true)
      router.replace('/clients', { scroll: false })
    }
  }, [router])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const response = await api.get(`/clients?${params.toString()}`)
      setClients(response.data)
    } catch {
      toast.error('שגיאה בטעינת לקוחות')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchClients()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchClients, search])

  const summarised = useMemo(
    () => clients.map((client) => ({ client, ...summarise(client) })),
    [clients],
  )

  const segments: Segment[] = [
    { value: 'active', label: 'פעילים', count: summarised.filter((c) => c.isActive).length },
    { value: 'dormant', label: 'רדומים', count: summarised.filter((c) => !c.isActive).length },
    { value: 'all', label: 'הכל', count: summarised.length },
  ]

  const rows = useMemo(() => {
    const filtered = summarised.filter((c) =>
      view === 'all' ? true : view === 'active' ? c.isActive : !c.isActive,
    )
    // Opinionated default: this list exists to rank clients by money.
    return [...filtered].sort((a, b) => b.outstanding - a.outstanding || b.total - a.total)
  }, [summarised, view])

  type Row = (typeof rows)[number]

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'שם עסק',
      mobile: 'primary',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.client.name}
          {r.client.isVip && (
            <Star role="img" aria-label="VIP" className="size-3.5 fill-marker-vip text-marker-vip" />
          )}
          {r.client.isInternal && (
            <StatusPill tone="neutral" emphasis="quiet">
              פנימי
            </StatusPill>
          )}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'מצב',
      mobile: 'trailing',
      cell: (r) =>
        r.isActive ? (
          <StatusPill tone="success" dot>
            פעיל
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" dot>
            רדום
          </StatusPill>
        ),
    },
    {
      key: 'projects',
      header: 'פרויקטים',
      align: 'numeric',
      width: '7rem',
      mobile: 'meta',
      cell: (r) => (
        <bdi>
          {r.activeProjects}/{r.client._count.projects}
        </bdi>
      ),
    },
    {
      key: 'phases',
      header: 'שלבים',
      width: '8rem',
      cell: (r) => {
        const phases = (r.client.projects ?? []).flatMap((p) => p.phases)
        return phases.length > 0 ? (
          <PhaseStrip phases={phases} />
        ) : (
          <span className="text-content-faint">—</span>
        )
      },
    },
    {
      key: 'total',
      header: 'סה"כ מוסכם',
      align: 'numeric',
      width: '8rem',
      cell: (r) => <bdi>{formatCurrency(r.total)}</bdi>,
    },
    {
      key: 'paid',
      header: 'שולם',
      align: 'numeric',
      width: '8rem',
      cell: (r) =>
        r.paid > 0 ? (
          <bdi className="text-figure-paid">{formatCurrency(r.paid)}</bdi>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'outstanding',
      header: 'לגבייה',
      align: 'numeric',
      width: '8rem',
      mobile: 'meta',
      cell: (r) =>
        r.outstanding > 0 ? (
          <bdi className="font-semibold text-figure-due">{formatCurrency(r.outstanding)}</bdi>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'portal',
      header: 'פורטל',
      width: '5rem',
      // A client with no token cannot approve a quote. That is a live defect,
      // and being able to see it across the whole roster at once is the point.
      cell: (r) =>
        r.client.formToken ? (
          <span className="text-figure-paid" aria-label="פורטל פעיל">
            ✓
          </span>
        ) : (
          <span className="text-content-faint" aria-label="אין קישור פורטל">
            —
          </span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="לקוחות"
        count={loading ? undefined : `${rows.length} מתוך ${clients.length}`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            לקוח חדש
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentControl segments={segments} value={view} onChange={(v) => setView(v as View)} />
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי שם עסק או ח.פ..."
        />
      </div>

      {loading ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        search ? (
          <EmptyState
            kind="filtered"
            title="לא נמצאו תוצאות"
            description={`אין לקוח שמתאים ל"${search}".`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                נקה חיפוש
              </Button>
            }
          />
        ) : (
          <EmptyState
            kind="new"
            icon={Building2}
            title="אין עדיין לקוחות"
            description="לקוח נוצר מליד שנסגר, או ידנית. הפרויקטים והפניות תלויים בו."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                לקוח חדש
              </Button>
            }
          />
        )
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.client.id}
          getRowHref={(r) => `/clients/${r.client.id}`}
        />
      )}

      <ClientForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchClients} />
    </div>
  )
}
