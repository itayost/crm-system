'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PhaseStrip } from '@/components/patterns'
import {
  toneOf,
  emphasisOf,
  CONTACT_STATUS_TONES,
  PRIORITY_TONES,
  PRIORITY_EMPHASIS,
  REQUEST_TYPE_TONES,
} from '@/lib/design/tones'
import {
  label,
  CONTACT_STATUS_LABELS,
  PRIORITY_LABELS,
  REQUEST_TYPE_LABELS,
} from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { projectTotal } from '@/lib/utils/project-money'
import type { TodayBoard } from '@/lib/services/today.service'
import type { RequestMetrics } from '@/lib/services/request-metrics.service'
import type { PhaseSummary } from '@/lib/types/project'

interface PendingTask {
  id: string
  title: string
  status: string
  priority: string
  category?: string
  dueDate: string | null
  project: { id: string; name: string } | null
}

interface ActiveProject {
  id: string
  name: string
  status: string
  type: string
  deadline?: string | null
  client: { id: string; name: string } | null
  advanceAmount?: number | string | null
  phases?: PhaseSummary[]
  _count: { tasks: number }
}

interface DashboardData {
  revenue: number
  outstanding: number
  contacts: { leads: number; clients: number }
  projects: { active: number; completed: number }
  tasks: { pending: number; overdue: number }
  requests: { pendingReview: number; open: number }
  activeProjects: ActiveProject[]
  pendingTasks: PendingTask[]
}

/** A block that only exists when it has something in it. */
function Block({
  id,
  title,
  count,
  action,
  children,
}: {
  /** Stable English handle. The Hebrew title is copy and may change. */
  id: string
  title: string
  count?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section data-section={id} className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center gap-2 border-b bg-surface-subtle px-3 py-2">
        <h2 className="text-ui-sm font-semibold text-content-strong">{title}</h2>
        {count != null && (
          <span className="font-mono text-ui-2xs tabular-nums text-content-subtle">{count}</span>
        )}
        {action && <div className="ms-auto">{action}</div>}
      </header>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 last:border-b-0 [&:not(:last-child)]:border-b">
      <div className="flex h-row w-full items-center gap-2 text-ui-sm">{children}</div>
    </div>
  )
}

function isOverdue(iso: string | null) {
  if (!iso) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return new Date(iso) < start
}

/**
 * היום - "מה אני חייב לעשות עכשיו, ובאיזה סדר."
 *
 * This page used to be five identical KPI tiles: same size, same weight, same
 * layout for revenue (money), a lead count (people) and an open-request count
 * (a queue), with three of the five going neutral on a quiet day - so a calm
 * morning rendered as five grey boxes. Five aggregates measuring five unrelated
 * things is a report, and the person reading it already knows how many projects
 * he has. What he does not know is which of eleven possible things is oldest
 * and blocked on him.
 *
 * The ordering rule is who is blocked: you first, then a decision only you can
 * make, then what is sitting with the client, then the money.
 *
 * Blocks 1-6 render only when non-empty - the same discipline MorningBriefService
 * applies when it drops empty sections rather than printing eleven "אין" lines.
 * A calm day is therefore short and dignified, not a wall of zeroes.
 */
export default function TodayPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [board, setBoard] = useState<TodayBoard | null>(null)
  const [metrics, setMetrics] = useState<RequestMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [dashboard, todayBoard, requestMetrics] = await Promise.all([
        api.get('/dashboard'),
        api.get('/today/board'),
        api.get('/requests/metrics').catch(() => null),
      ])
      setData(dashboard.data)
      setBoard(todayBoard.data)
      if (requestMetrics) setMetrics(requestMetrics.data)
    } catch {
      toast.error('שגיאה בטעינת המסך')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const triageAct = async (id: string, action: 'approve' | 'dismiss') => {
    setBusyId(id)
    try {
      await api.post(`/requests/${id}/action`, { action })
      toast.success(action === 'approve' ? 'הפנייה אושרה' : 'הפנייה נדחתה')
      fetchAll()
    } catch {
      toast.error('שגיאה בעדכון הפנייה')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!data || !board) {
    return (
      <EmptyState
        kind="filtered"
        title="שגיאה בטעינת הנתונים"
        description="נסה לרענן. אם זה חוזר, שווה להסתכל בלוג."
      />
    )
  }

  const decisions = metrics?.decisions
  const blockedOnYou = (decisions?.needsPricing ?? 0) + (decisions?.unclassified ?? 0)
  const atClientTotal =
    board.atClient.phasesAwaitingApproval +
    board.atClient.quotesUnanswered +
    board.atClient.quietLeads
  const collectTotal = board.collect.reduce((s, r) => s + r.price, 0)

  const needsYou = board.dueLeads.length + board.triage.length + blockedOnYou
  const overdueLeads = board.dueLeads.filter((l) => l.overdue).length
  const overdueTasks = data.tasks.overdue

  const dayTasks = data.pendingTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) <= new Date(new Date().setHours(23, 59, 59, 999)),
  )

  const calm = needsYou === 0 && dayTasks.length === 0 && board.collect.length === 0

  return (
    <div className="flex flex-col gap-3">
      {/* The day line, not a page title. */}
      <div data-section="day-line" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5">
        <h1 className="text-ui-lg font-semibold text-content-strong">
          {format(new Date(), 'EEEE, d בMMMM', { locale: he })}
        </h1>
        <p className="text-ui-sm text-content-muted">
          {calm
            ? 'היום נקי'
            : [
                needsYou > 0 ? `${needsYou} דברים דורשים אותך` : null,
                overdueLeads + overdueTasks > 0 ? `${overdueLeads + overdueTasks} באיחור` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
      </div>

      {calm && (
        <EmptyState
          kind="calm"
          title="אין דבר שחסום עליך"
          description="הבוט מסנן ומתייק, ואתה מאשר. כשמשהו יגיע - הוא יופיע כאן."
        />
      )}

      {/* 1 · What you promised yourself about a named lead. */}
      {board.dueLeads.length > 0 && (
        <Block
          id="due-leads" title="פעולות להיום" count={board.dueLeads.length}>
          {board.dueLeads.map((lead) => (
            <Row key={lead.id}>
              <Link
                href={`/contacts/${lead.id}`}
                className="font-medium text-content-strong hover:underline"
              >
                {lead.name}
              </Link>
              <StatusPill tone={toneOf(CONTACT_STATUS_TONES, lead.status)} emphasis="quiet" dot>
                {label(CONTACT_STATUS_LABELS, lead.status)}
              </StatusPill>
              <span className="min-w-0 flex-1 truncate text-content-subtle">
                {lead.nextActionNote}
              </span>
              {lead.overdue ? (
                <StatusPill tone="danger" emphasis="solid">
                  <bdi className="font-mono">{formatDate(lead.nextActionAt)}</bdi>
                </StatusPill>
              ) : (
                <bdi className="font-mono text-ui-xs tabular-nums text-content-subtle">
                  {formatDate(lead.nextActionAt)}
                </bdi>
              )}
            </Row>
          ))}
        </Block>
      )}

      {/* 2 · Client tickets nobody has triaged. Where the <2h target lives. */}
      {board.triage.length > 0 && (
        <Block
          id="triage"
          title="ממתין לך — פניות"
          count={board.triage.length}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/requests?view=triage">הכל</Link>
            </Button>
          }
        >
          {board.triage.map((request) => (
            <Row key={request.id}>
              <Link
                href={`/requests/${request.id}`}
                className="min-w-0 flex-1 truncate font-medium text-content-strong hover:underline"
              >
                {request.title}
              </Link>
              <StatusPill tone={toneOf(REQUEST_TYPE_TONES, request.type)} emphasis="quiet" dot>
                {label(REQUEST_TYPE_LABELS, request.type)}
              </StatusPill>
              <span className="text-content-subtle">{request.clientName ?? '—'}</span>
              <Button
                size="sm"
                disabled={busyId === request.id}
                onClick={() => triageAct(request.id, 'approve')}
              >
                <Check className="size-3.5" />
                אשר
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === request.id}
                onClick={() => triageAct(request.id, 'dismiss')}
              >
                <X className="size-3.5" />
                דחה
              </Button>
            </Row>
          ))}
        </Block>
      )}

      {/* 3 · Only the two queues that are blocked on you. awaitingClient and
             withoutTask are not - they live in block 5 and on /requests. */}
      {blockedOnYou > 0 && (
        <Block
          id="decisions" title="חסום על החלטה שלך">
          {(decisions?.needsPricing ?? 0) > 0 && (
            <Row>
              <Link href="/requests?view=needsPricing" className="flex-1 hover:underline">
                ממתין לתמחור
              </Link>
              <StatusPill tone="warning">
                <bdi className="font-mono">{decisions?.needsPricing}</bdi>
              </StatusPill>
            </Row>
          )}
          {(decisions?.unclassified ?? 0) > 0 && (
            <Row>
              <Link href="/requests?view=unclassified" className="flex-1 hover:underline">
                ללא סיווג חיוב
              </Link>
              <StatusPill tone="caution">
                <bdi className="font-mono">{decisions?.unclassified}</bdi>
              </StatusPill>
            </Row>
          )}
        </Block>
      )}

      {/* 4 · Overdue and due today. */}
      {dayTasks.length > 0 && (
        <Block
          id="day-tasks"
          title="משימות — באיחור ולהיום"
          count={dayTasks.length}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/tasks?view=today">הכל</Link>
            </Button>
          }
        >
          {dayTasks.slice(0, 8).map((task) => (
            <Row key={task.id}>
              <span className="min-w-0 flex-1 truncate font-medium text-content-strong">
                {task.title}
              </span>
              {task.project && (
                <Link
                  href={`/projects/${task.project.id}`}
                  className="text-content-subtle hover:underline"
                >
                  {task.project.name}
                </Link>
              )}
              <StatusPill
                tone={toneOf(PRIORITY_TONES, task.priority)}
                emphasis={emphasisOf(PRIORITY_EMPHASIS, task.priority)}
              >
                {label(PRIORITY_LABELS, task.priority)}
              </StatusPill>
              <bdi
                className={`font-mono text-ui-xs tabular-nums ${
                  isOverdue(task.dueDate) ? 'font-semibold text-tone-danger-foreground' : 'text-content-subtle'
                }`}
              >
                {formatDate(task.dueDate)}
              </bdi>
            </Row>
          ))}
        </Block>
      )}

      {/* 5 · Rotting, but not your move. */}
      {atClientTotal > 0 && (
        <Block
          id="at-client" title="אצל הלקוח">
          {board.atClient.phasesAwaitingApproval > 0 && (
            <Row>
              <span className="flex-1">שלבים ממתינים לאישור לקוח</span>
              <StatusPill tone="caution" emphasis="quiet" dot>
                <bdi className="font-mono">{board.atClient.phasesAwaitingApproval}</bdi>
              </StatusPill>
            </Row>
          )}
          {board.atClient.quotesUnanswered > 0 && (
            <Row>
              <Link href="/requests?view=awaitingClient" className="flex-1 hover:underline">
                הצעות מחיר שלא נענו
              </Link>
              <StatusPill tone="caution" emphasis="quiet" dot>
                <bdi className="font-mono">{board.atClient.quotesUnanswered}</bdi>
              </StatusPill>
            </Row>
          )}
          {board.atClient.quietLeads > 0 && (
            <Row>
              <Link href="/leads?view=pipeline" className="flex-1 hover:underline">
                לידים ששקטו
              </Link>
              <StatusPill tone="neutral" emphasis="quiet" dot>
                <bdi className="font-mono">{board.atClient.quietLeads}</bdi>
              </StatusPill>
            </Row>
          )}
        </Block>
      )}

      {/* 6 · The outstanding KPI, itemised. A total with nothing to click is a
             fact; a list with a button is a collection. */}
      {board.collect.length > 0 && (
        <Block
          id="collect"
          title="לגבייה"
          action={
            <span className="flex items-center gap-2">
              <bdi className="font-mono text-ui-sm font-semibold tabular-nums text-figure-due">
                {formatCurrency(collectTotal)}
              </bdi>
              <Button asChild size="sm" variant="ghost">
                <Link href="/money">הכל</Link>
              </Button>
            </span>
          }
        >
          {board.collect.slice(0, 3).map((row) => (
            <Row key={row.id}>
              <span className="text-content-subtle">{row.clientName ?? '—'}</span>
              <Link
                href={`/projects/${row.projectId}`}
                className="font-medium text-content-strong hover:underline"
              >
                {row.projectName}
              </Link>
              <span className="min-w-0 flex-1 truncate text-content-subtle">{row.name}</span>
              <bdi className="font-mono text-ui-sm font-semibold tabular-nums">
                {formatCurrency(row.price)}
              </bdi>
            </Row>
          ))}
        </Block>
      )}

      {/* 7 · Always renders. Four figures, no tiles, no icons. */}
      <div data-section="state" className="flex flex-wrap overflow-hidden rounded-lg border bg-card">
        {[
          { k: 'פרויקטים פעילים', v: String(data.projects.active), href: '/projects' },
          { k: 'פניות פתוחות', v: String(data.requests.open), href: '/requests' },
          { k: 'לידים בצנרת', v: String(data.contacts.leads), href: '/leads' },
          { k: 'הכנסות', v: formatCurrency(data.revenue), href: '/money' },
        ].map((figure) => (
          <Link
            key={figure.k}
            href={figure.href}
            className="flex min-w-[9rem] flex-1 flex-col gap-0.5 border-e px-4 py-2.5 transition-colors duration-fast last:border-e-0 hover:bg-surface-subtle"
          >
            <span className="text-ui-2xs text-content-subtle">{figure.k}</span>
            <bdi className="font-mono text-ui-md font-semibold tabular-nums text-content-strong">
              {figure.v}
            </bdi>
          </Link>
        ))}
      </div>

      {/* On a calm day the useful question shifts from "what is on fire" to
          "what should I push", and that is a project, not a task. */}
      {data.activeProjects.length > 0 && (
        <Block
          id="active-projects"
          title="הפרויקטים בעבודה"
          count={data.activeProjects.length}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/projects">הכל</Link>
            </Button>
          }
        >
          {data.activeProjects.slice(0, 5).map((project) => (
            <Row key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="w-40 truncate font-medium text-content-strong hover:underline"
              >
                {project.name}
              </Link>
              <span className="min-w-0 flex-1 truncate text-content-subtle">
                {project.client?.name ?? '—'}
              </span>
              {project.phases && project.phases.length > 0 && (
                <PhaseStrip phases={project.phases} className="w-28" />
              )}
              <bdi className="font-mono text-ui-xs tabular-nums text-content-subtle">
                {formatCurrency(projectTotal(project.advanceAmount, project.phases ?? []))}
              </bdi>
            </Row>
          ))}
        </Block>
      )}
    </div>
  )
}
