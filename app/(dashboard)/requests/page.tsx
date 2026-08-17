'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RequestForm } from '@/components/forms/request-form'
import { AiMark, SourceIcon } from '@/components/requests/request-badges'
import { AttachmentLinks } from '@/components/requests/attachment-links'
import { RequestAge } from '@/components/requests/request-age'
import {
  PageHeader,
  SearchField,
  SegmentControl,
  DataTable,
  EmptyState,
  TableSkeleton,
  type Column,
  type Segment,
} from '@/components/patterns'
import {
  toneOf,
  REQUEST_STATUS_TONES,
  REQUEST_BILLING_TONES,
  TASK_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  REQUEST_STATUS_LABELS,
  REQUEST_BILLING_LABELS,
  REQUEST_TYPE_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/design/labels'
import { formatCurrency } from '@/lib/utils'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'
import type { RequestRecord } from '@/lib/types/request'

/**
 * Each segment is a predicate RequestsService.getAll already supported.
 *
 * This is the structural fix for a defect the old page shipped: RequestPipeline
 * linked to `?status=PENDING_REVIEW` and friends while the page only ever read
 * `?queue=`, so four of its five links navigated to an unfiltered list. One
 * param, one vocabulary - and a counter can no longer disagree with the list it
 * links to, because they are the same predicate.
 *
 * It also removes four stacked full-width blocks. The table this page is named
 * after used to sit below a pipeline chart, a decisions card, the review queue
 * and the awaiting-client queue - two of which returned null when empty, so the
 * page changed shape from one day to the next.
 */
const VIEWS = {
  triage: { label: "לטריאז'", params: { pendingReview: 'true' } },
  needsPricing: { label: 'לתמחור', params: { queue: 'needsPricing' } },
  unclassified: { label: 'ללא סיווג', params: { queue: 'unclassified' } },
  awaitingClient: { label: 'אצל הלקוח', params: { queue: 'awaitingClient' } },
  open: { label: 'פתוחות', params: { excludePending: 'true' } },
  all: { label: 'הכל', params: {} },
} as const

type View = keyof typeof VIEWS

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [metrics, setMetrics] = useState<RequestMetrics | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('open')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RequestRecord | undefined>(undefined)

  const fetchMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/requests/metrics')
      setMetrics(data)
      return data as RequestMetrics
    } catch {
      setMetrics(null)
      return null
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(VIEWS[view].params)
      if (search.trim()) params.set('search', search.trim())
      if (clientFilter !== 'ALL') params.set('clientId', clientFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      const { data } = await api.get(`/requests?${params.toString()}`)
      setRequests(data)
    } catch {
      toast.error('שגיאה בטעינת פניות')
    } finally {
      setLoading(false)
    }
  }, [view, search, clientFilter, typeFilter])

  // Land on the pile that is blocked on you, when there is one.
  const pickedInitialView = useRef(false)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)

    // ⌘K offers "פנייה חדשה" as /requests?new=true. Only /projects honoured
    // that param, so the palette's create action navigated here and stopped.
    if (query.get('new') === 'true') {
      setEditing(undefined)
      setShowForm(true)
      window.history.replaceState(null, '', '/requests')
    }

    const fromUrl = query.get('view')
    if (fromUrl && fromUrl in VIEWS) {
      pickedInitialView.current = true
      setView(fromUrl as View)
      fetchMetrics()
      return
    }
    fetchMetrics().then((m) => {
      if (pickedInitialView.current) return
      pickedInitialView.current = true
      if (m && m.pipeline.pendingReview > 0) setView('triage')
    })
  }, [fetchMetrics])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRequests()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchRequests, search])

  useEffect(() => {
    api
      .get('/clients')
      .then(({ data }) => setClients(data))
      .catch(() => setClients([]))
  }, [])

  const selectView = (next: string) => {
    setView(next as View)
    window.history.replaceState(null, '', `/requests?view=${next}`)
  }

  const segments: Segment[] = useMemo(() => {
    const d = metrics?.decisions
    const p = metrics?.pipeline
    return [
      { value: 'triage', label: VIEWS.triage.label, count: p?.pendingReview },
      { value: 'needsPricing', label: VIEWS.needsPricing.label, count: d?.needsPricing },
      { value: 'unclassified', label: VIEWS.unclassified.label, count: d?.unclassified },
      { value: 'awaitingClient', label: VIEWS.awaitingClient.label, count: d?.awaitingClient },
      { value: 'open', label: VIEWS.open.label, count: p ? p.open + p.inProgress : undefined },
      { value: 'all', label: VIEWS.all.label },
    ]
  }, [metrics])

  const refresh = useCallback(() => {
    fetchRequests()
    fetchMetrics()
  }, [fetchRequests, fetchMetrics])

  const openAttachment = async (id: string, path: string) => {
    const tab = window.open('', '_blank')
    if (!tab) {
      toast.error('הדפדפן חסם את פתיחת הקובץ. אפשרו חלונות קופצים ונסו שוב')
      return
    }
    try {
      const { data } = await api.get(`/requests/${id}/attachment?path=${encodeURIComponent(path)}`)
      tab.location.href = data.url
    } catch {
      tab.close()
      toast.error('שגיאה בפתיחת הקובץ')
    }
  }

  const act = async (id: string, action: 'approve' | 'dismiss') => {
    try {
      await api.post(`/requests/${id}/action`, { action })
      toast.success(action === 'approve' ? 'הפנייה אושרה' : 'הפנייה נדחתה')
      refresh()
    } catch {
      toast.error('שגיאה בעדכון הפנייה')
    }
  }

  const columns: Column<RequestRecord>[] = [
    {
      key: 'title',
      header: 'כותרת',
      mobile: 'primary',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span>{r.title}</span>
          <AiMark isAiGenerated={r.isAiGenerated} />
          <SourceIcon source={r.source} />
          <AttachmentLinks
            attachments={r.attachments}
            onOpen={(path) => openAttachment(r.id, path)}
          />
        </span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      mobile: 'trailing',
      cell: (r) => (
        <StatusPill tone={toneOf(REQUEST_STATUS_TONES, r.status)} dot>
          {label(REQUEST_STATUS_LABELS, r.status)}
        </StatusPill>
      ),
    },
    {
      key: 'billing',
      header: 'חיוב',
      width: '7rem',
      mobile: 'meta',
      // Unclassified is the loud case: the billing gate never engaged, so the
      // work is running unpriced.
      cell: (r) =>
        r.billingKind ? (
          <StatusPill tone={toneOf(REQUEST_BILLING_TONES, r.billingKind)} emphasis="quiet" dot>
            {label(REQUEST_BILLING_LABELS, r.billingKind)}
          </StatusPill>
        ) : (
          <StatusPill tone="danger" emphasis="outline">
            ללא סיווג
          </StatusPill>
        ),
    },
    {
      key: 'price',
      header: 'מחיר',
      align: 'numeric',
      width: '7rem',
      cell: (r) =>
        r.quotedPrice ? (
          <bdi>{formatCurrency(r.quotedPrice)}</bdi>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    { key: 'client', header: 'לקוח', mobile: 'meta', cell: (r) => r.client?.name ?? '—' },
    {
      key: 'project',
      header: 'פרויקט',
      // sendQuote refuses a chargeable request with no project, so a blank here
      // is diagnostic rather than cosmetic.
      cell: (r) => r.project?.name ?? <span className="text-content-faint">—</span>,
    },
    {
      key: 'age',
      header: 'גיל',
      align: 'numeric',
      width: '6rem',
      mobile: 'meta',
      cell: (r) => <RequestAge createdAt={r.createdAt} status={r.status} />,
    },
    {
      key: 'task',
      header: 'משימה',
      width: '7rem',
      cell: (r) =>
        r.task ? (
          <StatusPill tone={toneOf(TASK_STATUS_TONES, r.task.status)} emphasis="quiet" dot>
            {label(TASK_STATUS_LABELS, r.task.status)}
          </StatusPill>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
  ]

  // Triage is the one pile where the useful thing is to decide without leaving.
  if (view === 'triage') {
    columns.push({
      key: 'triage-actions',
      header: '',
      width: '9rem',
      mobile: 'actions',
      cell: (r) => (
        <span className="flex gap-1.5">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              act(r.id, 'approve')
            }}
          >
            אשר
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              act(r.id, 'dismiss')
            }}
          >
            דחה
          </Button>
        </span>
      ),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="פניות"
        count={loading ? undefined : `${requests.length}`}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined)
              setShowForm(true)
            }}
          >
            <Plus className="size-4" />
            פנייה חדשה
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentControl segments={segments} value={view} onChange={selectView} />
        <SearchField value={search} onChange={setSearch} placeholder="חיפוש בפניות..." />
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-control w-36 text-ui-sm" aria-label="לקוח">
            <SelectValue placeholder="לקוח" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הלקוחות</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-control w-32 text-ui-sm" aria-label="סוג">
            <SelectValue placeholder="סוג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הסוגים</SelectItem>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, text]) => (
              <SelectItem key={value} value={value}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton columns={7} />
      ) : requests.length === 0 ? (
        view === 'triage' ? (
          <EmptyState
            kind="calm"
            title="אין פניות שממתינות לך"
            description="הבוט מסנן ומתייק, ואתה מאשר. כשמשהו יגיע - הוא יופיע כאן."
          />
        ) : search ? (
          <EmptyState
            kind="filtered"
            title="לא נמצאו תוצאות"
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                נקה חיפוש
              </Button>
            }
          />
        ) : (
          <EmptyState kind="new" icon={Inbox} title="אין פניות בתצוגה הזו" />
        )
      ) : (
        <DataTable
          rows={requests}
          columns={columns}
          getRowId={(r) => r.id}
          getRowHref={(r) => `/requests/${r.id}`}
        />
      )}

      <RequestForm
        request={editing}
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={refresh}
      />
    </div>
  )
}
