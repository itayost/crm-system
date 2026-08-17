'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { ContactForm } from '@/components/forms/contact-form'
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
import { toneOf, CONTACT_STATUS_TONES } from '@/lib/design/tones'
import { label, CONTACT_STATUS_LABELS, CONTACT_SOURCE_LABELS } from '@/lib/design/labels'
import { LEAD_STATUSES } from '@/lib/validations/enums'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ContactRecord } from '@/lib/types/contact'

type Lead = Pick<
  ContactRecord,
  | 'id'
  | 'name'
  | 'phone'
  | 'company'
  | 'status'
  | 'source'
  | 'estimatedBudget'
  | 'nextActionAt'
  | 'nextActionNote'
  | 'createdAt'
>

/** Compared against the start of today, so a lead due today is not late. */
function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return new Date(iso) < start
}

function isDueNow(iso: string | null): boolean {
  if (!iso) return true // nobody has planned the next step, which is the point
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return new Date(iso) <= end
}

const VIEWS = ['todo', 'pipeline', 'lost', 'all'] as const
type View = (typeof VIEWS)[number]

/**
 * "איזה ליד חייב תשובה, ומתי הבטחתי."
 *
 * Replaces the /contacts list. The old page had three tabs, and its לקוחות tab
 * was a near-duplicate of /clients - the real seam is not person-vs-business,
 * it is pipeline-vs-roster. A lead is a person in a funnel carrying a promise
 * (`nextActionAt`); that is a workflow and deserves a page. A person inside a
 * business is only interesting in the context of that business, which is a
 * lookup - and lookups are what ⌘K is for.
 *
 * /contacts/[id] survives untouched: it is still the target of
 * Project.primaryContactId, Request.contactId and WhatsApp identity resolution.
 */
export default function LeadsPage() {
  const [contacts, setContacts] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('todo')
  const [showForm, setShowForm] = useState(false)

  // `?view=` is the one vocabulary a segment is addressed by, and the היום
  // cockpit links here with it ("לידים ששקטו" -> /leads?view=pipeline).
  // Without this read the link silently landed on the default pile.
  // Read from window rather than useSearchParams so the page stays outside a
  // Suspense boundary - the same approach /requests and the client page take.
  const readView = useRef(false)
  useEffect(() => {
    if (readView.current) return
    readView.current = true
    const fromUrl = new URLSearchParams(window.location.search).get('view')
    if (fromUrl && (VIEWS as readonly string[]).includes(fromUrl)) setView(fromUrl as View)
  }, [])

  const selectView = (next: string) => {
    setView(next as View)
    window.history.replaceState(null, '', `/leads?view=${next}`)
  }

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const response = await api.get(`/contacts?${params.toString()}`)
      setContacts(response.data)
    } catch {
      toast.error('שגיאה בטעינת לידים')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchContacts()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchContacts, search])

  // LEAD_STATUSES is the single source for which stages count as a lead;
  // LOST is deliberately outside it, so it is added back by name here rather
  // than by widening that constant.
  const leads = useMemo(
    () =>
      contacts.filter(
        (c) => (LEAD_STATUSES as readonly string[]).includes(c.status) || c.status === 'LOST',
      ),
    [contacts],
  )

  const buckets = useMemo(() => {
    const live = leads.filter((c) => c.status !== 'LOST')
    return {
      todo: live.filter((c) => isDueNow(c.nextActionAt)),
      pipeline: live,
      lost: leads.filter((c) => c.status === 'LOST'),
      all: leads,
    }
  }, [leads])

  const segments: Segment[] = [
    { value: 'todo', label: 'לטיפול', count: buckets.todo.length },
    { value: 'pipeline', label: 'בצנרת', count: buckets.pipeline.length },
    { value: 'lost', label: 'אבודים', count: buckets.lost.length },
    { value: 'all', label: 'הכל', count: buckets.all.length },
  ]

  const rows = useMemo(() => {
    // Promised-soonest first, unplanned last, then newest. The same ordering
    // the leads table has always used, made explicit.
    return [...buckets[view]].sort((a, b) => {
      const at = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Infinity
      const bt = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Infinity
      if (at !== bt) return at - bt
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [buckets, view])

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'שם',
      mobile: 'primary',
      cell: (c) => (
        <span className="inline-flex items-baseline gap-1.5">
          {c.name}
          {c.company && <span className="text-ui-2xs text-content-subtle">{c.company}</span>}
        </span>
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
    {
      key: 'next-action',
      header: 'פעולה הבאה',
      mobile: 'meta',
      cell: (c) =>
        c.nextActionAt ? (
          <span className="inline-flex items-center gap-2">
            <StatusPill
              tone={isOverdue(c.nextActionAt) ? 'danger' : 'neutral'}
              emphasis={isOverdue(c.nextActionAt) ? 'solid' : 'quiet'}
              dot={!isOverdue(c.nextActionAt)}
            >
              <bdi className="font-mono tabular-nums">{formatDate(c.nextActionAt)}</bdi>
            </StatusPill>
            {c.nextActionNote && (
              <span className="truncate text-ui-2xs text-content-subtle">{c.nextActionNote}</span>
            )}
          </span>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'טלפון',
      align: 'numeric',
      width: '9rem',
      mobile: 'meta',
      cell: (c) => <bdi dir="ltr">{c.phone}</bdi>,
    },
    {
      key: 'source',
      header: 'מקור',
      width: '7rem',
      cell: (c) => (
        <StatusPill tone="neutral" emphasis="quiet" dot>
          {label(CONTACT_SOURCE_LABELS, c.source)}
        </StatusPill>
      ),
    },
    {
      key: 'budget',
      header: 'תקציב משוער',
      align: 'numeric',
      width: '8rem',
      // On the model all along, surfaced nowhere. It is how you decide which
      // lead to chase first.
      cell: (c) =>
        c.estimatedBudget ? (
          <bdi>{formatCurrency(c.estimatedBudget)}</bdi>
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'created',
      header: 'נוצר',
      align: 'numeric',
      width: '7rem',
      cell: (c) => <bdi>{formatDate(c.createdAt)}</bdi>,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="לידים"
        count={loading ? undefined : `${rows.length} מתוך ${leads.length}`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            ליד חדש
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentControl segments={segments} value={view} onChange={selectView} />
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי שם, טלפון, אימייל..."
        />
      </div>

      {loading ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        search ? (
          <EmptyState
            kind="filtered"
            title="לא נמצאו תוצאות"
            description={`אין ליד שמתאים ל"${search}".`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                נקה חיפוש
              </Button>
            }
          />
        ) : view === 'todo' ? (
          <EmptyState
            kind="calm"
            title="אין ליד שמחכה לך"
            description="כל מי שבצנרת יש לו פעולה הבאה מתוכננת קדימה."
          />
        ) : (
          <EmptyState
            kind="new"
            icon={UserPlus}
            title="אין לידים"
            description="ליד הוא אדם בצנרת. כשהוא נסגר הוא הופך ללקוח, ואז הוא חי תחת העסק שלו."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                ליד חדש
              </Button>
            }
          />
        )
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(c) => c.id}
          getRowHref={(c) => `/contacts/${c.id}`}
        />
      )}

      <ContactForm open={showForm} onOpenChange={setShowForm} onSuccess={fetchContacts} />
    </div>
  )
}
