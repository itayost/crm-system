import { JourneyRail, phaseSteps } from '@/components/portal/journey-rail'
import { PortalSection } from '@/components/portal/portal-page'
import { StatusPill } from '@/components/ui/status-pill'
import { CLIENT_PHASE_STATUS_LABELS } from '@/lib/design/labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ClientProjectView } from '@/lib/services/client-view'

/**
 * One project, read as a journey rather than as a list of line items.
 *
 * The money is unchanged in substance - the same three figures the ledger
 * already exposed, and `outstanding` still counts only work that was signed off
 * and not yet paid, so a client who approved a price this morning does not open
 * this and read that they already owe for it. What changes is that the phases
 * now carry dates and a position, so "where are we" has an answer that does not
 * require reading five status chips and inferring one.
 */
export function PortalProjectCard({ project }: { project: ClientProjectView }) {
  const steps = phaseSteps(project.phases, CLIENT_PHASE_STATUS_LABELS, project.advance)
  const current = project.phases.findIndex(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'AWAITING_YOU',
  )

  return (
    <section className="flex flex-col gap-5 rounded-lg border bg-card p-5 shadow-e1">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-portal-title font-medium text-content-strong">
            {project.name}
          </h2>
          {project.completedAt ? (
            <StatusPill tone="success" dot>
              הושלם
            </StatusPill>
          ) : (
            <StatusPill tone="progress" dot>
              בעבודה
            </StatusPill>
          )}
        </div>

        {/* "Step 4 of 5, connecting the booking system" is the sentence a client
            would say out loud. It only exists when a phase is actually running -
            inventing a position for a project that has not started says less
            than saying nothing. */}
        {current >= 0 && (
          <p className="text-portal-xs text-content-muted">
            שלב <bdi className="font-mono tabular-nums">{current + 1}</bdi> מתוך{' '}
            <bdi className="font-mono tabular-nums">{project.phases.length}</bdi> ·{' '}
            {project.phases[current].name}
          </p>
        )}

        {project.deadline && !project.completedAt && (
          <p className="text-portal-2xs text-content-faint">
            יעד: <bdi>{formatDate(project.deadline)}</bdi>
          </p>
        )}
      </div>

      {project.description && (
        <p className="whitespace-pre-wrap text-portal-sm text-content-body">{project.description}</p>
      )}

      {project.total > 0 && (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-3 overflow-hidden rounded-md border">
            <Figure term='סה"כ מוסכם' value={project.total} />
            <Figure term="שולם" value={project.paid} tone="paid" bordered />
            <Figure term="לתשלום" value={project.outstanding} tone="due" bordered />
          </dl>

          {project.notYetDue > 0 && (
            <p className="text-portal-2xs text-content-muted">
              <bdi>{formatCurrency(project.notYetDue)}</bdi> על עבודה שטרם הושלמה, ולכן טרם
              לתשלום.
            </p>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <PortalSection heading="השלבים">
          <div className="rounded-md border p-4">
            <JourneyRail steps={steps} />
          </div>
          <p className="text-portal-2xs text-content-muted">קו מתחת לסכום = שולם.</p>
        </PortalSection>
      )}
    </section>
  )
}

/**
 * `figure-paid` and `figure-due` rather than a tone.
 *
 * Money is not a status: a paid figure is not "success" and an outstanding one
 * is not "warning" - nothing is wrong with an invoice that has not been paid
 * yet. The two figure tokens exist so money reads as money everywhere instead of
 * borrowing the lifecycle palette.
 */
function Figure({
  term,
  value,
  tone,
  bordered,
}: {
  term: string
  value: number
  tone?: 'paid' | 'due'
  bordered?: boolean
}) {
  const colour =
    value === 0
      ? 'text-content-muted'
      : tone === 'paid'
        ? 'text-figure-paid'
        : tone === 'due'
          ? 'text-figure-due'
          : 'text-content-strong'

  return (
    <div className={bordered ? 'border-s p-3' : 'p-3'}>
      <dt className="text-portal-2xs text-content-muted">{term}</dt>
      <dd className={`font-mono text-portal-sm font-semibold tabular-nums ${colour}`}>
        <bdi>{formatCurrency(value)}</bdi>
      </dd>
    </div>
  )
}
