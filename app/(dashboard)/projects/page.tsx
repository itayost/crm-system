'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { ProjectForm } from '@/components/forms/project-form'
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
import {
  toneOf,
  emphasisOf,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  PROJECT_STATUS_TONES,
  PHASE_STATUS_TONES,
} from '@/lib/design/tones'
import {
  label,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PRIORITY_LABELS,
  PHASE_STATUS_LABELS,
} from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { projectTotal, projectOutstanding } from '@/lib/money/project'
import type { ProjectListItem } from '@/lib/types/project'

type View = 'active' | 'completed' | 'all'

/** The first stage that is not signed off yet. Where the project actually is. */
function currentPhase(project: ProjectListItem) {
  return [...project.phases]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .find((p) => p.status !== 'APPROVED')
}

function isLate(project: ProjectListItem) {
  return (
    project.status === 'ACTIVE' &&
    Boolean(project.deadline) &&
    new Date(project.deadline as string) < new Date()
  )
}

function ProjectsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('active')
  const [showForm, setShowForm] = useState(false)
  const [defaultClientId, setDefaultClientId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      const clientId = searchParams.get('clientId')
      if (clientId) setDefaultClientId(clientId)
      setShowForm(true)
      router.replace('/projects', { scroll: false })
    }
  }, [searchParams, router])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const response = await api.get(`/projects?${params.toString()}`)
      setProjects(response.data)
    } catch {
      toast.error('שגיאה בטעינת פרויקטים')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProjects()
    }, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchProjects, search])

  const buckets = useMemo(
    () => ({
      active: projects.filter((p) => p.status === 'ACTIVE'),
      completed: projects.filter((p) => p.status === 'COMPLETED'),
      all: projects,
    }),
    [projects],
  )

  const segments: Segment[] = [
    { value: 'active', label: 'פעילים', count: buckets.active.length },
    { value: 'completed', label: 'הושלמו', count: buckets.completed.length },
    { value: 'all', label: 'הכל', count: buckets.all.length },
  ]

  const rows = useMemo(() => {
    // Deadline first, nothing-scheduled last, then the loudest priority.
    const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
    return [...buckets[view]].sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity
      if (ad !== bd) return ad - bd
      return order.indexOf(a.priority) - order.indexOf(b.priority)
    })
  }, [buckets, view])

  const columns: Column<ProjectListItem>[] = [
    {
      key: 'name',
      header: 'שם',
      mobile: 'primary',
      cell: (p) => (
        <span className="inline-flex items-baseline gap-1.5">
          {p.name}
          <span className="text-ui-2xs text-content-subtle">
            {label(PROJECT_TYPE_LABELS, p.type)}
          </span>
        </span>
      ),
    },
    { key: 'client', header: 'לקוח', mobile: 'meta', cell: (p) => p.client?.name ?? '—' },
    {
      key: 'current-phase',
      header: 'שלב נוכחי',
      mobile: 'trailing',
      // The most useful cell on this page, and one it never had: a status of
      // "פעיל" tells you nothing you did not already know from the segment.
      cell: (p) => {
        const phase = currentPhase(p)
        if (!phase) {
          return p.phases.length > 0 ? (
            <StatusPill tone="success" dot>הכל אושר</StatusPill>
          ) : (
            <span className="text-content-faint">אין שלבים</span>
          )
        }
        return (
          <StatusPill tone={toneOf(PHASE_STATUS_TONES, phase.status)} dot>
            {phase.name ?? label(PHASE_STATUS_LABELS, phase.status)}
          </StatusPill>
        )
      },
    },
    {
      key: 'phases',
      header: 'התקדמות',
      width: '9rem',
      cell: (p) =>
        p.phases.length > 0 ? (
          <PhaseStrip phases={p.phases} />
        ) : (
          <span className="text-content-faint">—</span>
        ),
    },
    {
      key: 'priority',
      header: 'עדיפות',
      width: '6rem',
      cell: (p) => (
        <StatusPill
          tone={toneOf(PRIORITY_TONES, p.priority)}
          emphasis={emphasisOf(PRIORITY_EMPHASIS, p.priority)}
        >
          {label(PRIORITY_LABELS, p.priority)}
        </StatusPill>
      ),
    },
    {
      key: 'deadline',
      header: 'דדליין',
      align: 'numeric',
      width: '7rem',
      mobile: 'meta',
      cell: (p) => (
        <bdi className={isLate(p) ? 'font-semibold text-tone-danger-foreground' : undefined}>
          {formatDate(p.deadline)}
        </bdi>
      ),
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
      key: 'outstanding',
      header: 'לגבייה',
      align: 'numeric',
      width: '7rem',
      cell: (p) => {
        const v = projectOutstanding(p.phases)
        return v > 0 ? (
          <bdi className="font-semibold text-figure-due">{formatCurrency(v)}</bdi>
        ) : (
          <span className="text-content-faint">—</span>
        )
      },
    },
  ]

  // A column that just repeats the segment is noise, so status only appears
  // where the segment is not already answering it.
  if (view === 'all') {
    columns.splice(2, 0, {
      key: 'status',
      header: 'סטטוס',
      width: '6rem',
      cell: (p) => (
        <StatusPill tone={toneOf(PROJECT_STATUS_TONES, p.status)} dot>
          {label(PROJECT_STATUS_LABELS, p.status)}
        </StatusPill>
      ),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="פרויקטים"
        count={loading ? undefined : `${rows.length} מתוך ${projects.length}`}
        actions={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            פרויקט חדש
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentControl segments={segments} value={view} onChange={(v) => setView(v as View)} />
        <SearchField value={search} onChange={setSearch} placeholder="חיפוש לפי שם פרויקט..." />
      </div>

      {loading ? (
        <TableSkeleton columns={7} />
      ) : rows.length === 0 ? (
        search ? (
          <EmptyState
            kind="filtered"
            title="לא נמצאו תוצאות"
            description={`אין פרויקט שמתאים ל"${search}".`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                נקה חיפוש
              </Button>
            }
          />
        ) : (
          <EmptyState
            kind="new"
            icon={Briefcase}
            title="אין פרויקטים בתצוגה הזו"
            description="פרויקט שייך לעסק, ומחזיק את השלבים והכסף שלו."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                פרויקט חדש
              </Button>
            }
          />
        )
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          getRowHref={(p) => `/projects/${p.id}`}
        />
      )}

      <ProjectForm
        defaultClientId={defaultClientId}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) setDefaultClientId(undefined)
        }}
        onSuccess={fetchProjects}
      />
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<TableSkeleton columns={7} />}>
      <ProjectsPageContent />
    </Suspense>
  )
}
