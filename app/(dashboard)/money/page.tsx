'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Coins } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import {
  PageHeader,
  SegmentControl,
  DataTable,
  EmptyState,
  TableSkeleton,
  MoneyLine,
  type Column,
  type Segment,
} from '@/components/patterns'
import { toneOf, LEDGER_STATE_TONES } from '@/lib/design/tones'
import { label, LEDGER_STATE_LABELS } from '@/lib/design/labels'
import { isAwaitingApproval, isCollectable, isPaid } from '@/lib/money/ledger'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Ledger, LedgerRow } from '@/lib/services/money.service'

type View = 'due' | 'awaiting' | 'paid' | 'all'

/**
 * "מה נכנס, מה מגיע לי, ומה עוד לא סגור."
 *
 * The monthly invoicing ritual on one screen. This is also why `outstanding`
 * stopped needing to be a KPI tile on the dashboard: a total with nothing to
 * click is a fact, whereas a list with a button is a collection.
 */
export default function MoneyPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('due')
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchLedger = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/money')
      setLedger(data)
    } catch {
      toast.error('שגיאה בטעינת הכספים')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLedger()
  }, [fetchLedger])

  const all = useMemo(() => ledger?.rows ?? [], [ledger])

  const buckets = useMemo(
    () => ({
      due: all.filter(isCollectable),
      awaiting: all.filter(isAwaitingApproval),
      paid: all.filter(isPaid),
      all,
    }),
    [all],
  )

  const segments: Segment[] = [
    { value: 'due', label: 'לגבייה', count: buckets.due.length },
    { value: 'awaiting', label: 'ממתין לאישור לקוח', count: buckets.awaiting.length },
    { value: 'paid', label: 'שולם', count: buckets.paid.length },
    { value: 'all', label: 'הכל', count: all.length },
  ]

  const markPaid = async (row: LedgerRow) => {
    if (row.kind === 'advance') {
      toast.error('מקדמה מסומנת כשולמה מתוך דף הפרויקט')
      return
    }
    setBusyId(row.id)
    try {
      await api.put(`/projects/${row.projectId}/phases/${row.id}`, { paid: true })
      toast.success('סומן כשולם')
      fetchLedger()
    } catch {
      toast.error('שגיאה בעדכון התשלום')
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<LedgerRow>[] = [
    {
      key: 'client',
      header: 'לקוח',
      mobile: 'primary',
      cell: (r) => r.clientName ?? '—',
    },
    { key: 'project', header: 'פרויקט', mobile: 'meta', cell: (r) => r.projectName },
    { key: 'name', header: 'שלב', mobile: 'meta', cell: (r) => r.name },
    {
      key: 'status',
      header: 'מצב',
      mobile: 'trailing',
      cell: (r) => (
        <StatusPill tone={toneOf(LEDGER_STATE_TONES, r.state)} dot>
          {label(LEDGER_STATE_LABELS, r.state)}
        </StatusPill>
      ),
    },
    {
      key: 'price',
      header: 'סכום',
      align: 'numeric',
      width: '8rem',
      mobile: 'meta',
      cell: (r) => <bdi className={isPaid(r) ? 'text-figure-paid' : undefined}>{formatCurrency(r.price)}</bdi>,
    },
    {
      key: 'paidAt',
      header: 'שולם',
      align: 'numeric',
      width: '7rem',
      cell: (r) => <bdi>{formatDate(r.paidAt)}</bdi>,
    },
    {
      key: 'action',
      header: '',
      width: '8rem',
      mobile: 'actions',
      cell: (r) =>
        isCollectable(r) && r.kind === 'phase' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === r.id}
            onClick={(e) => {
              e.stopPropagation()
              markPaid(r)
            }}
          >
            {busyId === r.id ? 'מסמן...' : 'סמן כשולם'}
          </Button>
        ) : null,
    },
  ]

  const rows = buckets[view]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="כספים" count={loading ? undefined : `${rows.length} שורות`} />

      {ledger && (
        <MoneyLine
          figures={[
            { term: 'שולם החודש', value: formatCurrency(ledger.totals.paidThisMonth), tone: 'paid' },
            {
              term: 'לגבייה',
              value: ledger.totals.due > 0 ? formatCurrency(ledger.totals.due) : '—',
              tone: ledger.totals.due > 0 ? 'due' : 'muted',
            },
            { term: 'ממתין לאישור', value: formatCurrency(ledger.totals.awaiting), tone: 'muted' },
          ]}
        />
      )}

      <SegmentControl segments={segments} value={view} onChange={(v) => setView(v as View)} />

      {loading ? (
        <TableSkeleton columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          kind={view === 'due' ? 'calm' : 'filtered'}
          icon={view === 'due' ? Coins : undefined}
          title={view === 'due' ? 'אין מה לגבות' : 'אין שורות בתצוגה הזו'}
          description={
            view === 'due'
              ? 'כל מה שאושר גם שולם. זה המצב שאליו רוצים להגיע בסוף החודש.'
              : undefined
          }
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowHref={(r) => `/projects/${r.projectId}`}
        />
      )}
    </div>
  )
}
