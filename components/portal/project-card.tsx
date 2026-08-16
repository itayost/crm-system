import { StatusPill } from '@/components/ui/status-pill'
import { CLIENT_PHASE_STATUS_LABELS, label } from '@/lib/design/labels'
import { CLIENT_PHASE_STATUS_TONES, toneOf } from '@/lib/design/tones'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ClientProjectView } from '@/lib/services/client-view'

/**
 * One project, with the ledger the client has never been able to see.
 *
 * Three figures, and the third is the one that matters: outstanding counts work
 * that was signed off and not yet paid. It deliberately does not count work
 * merely quoted, so a client who approved a price this morning does not open
 * this and read that they owe for it already.
 */
export function PortalProjectCard({ project }: { project: ClientProjectView }) {
  const notYetDue = Math.max(project.total - project.paid - project.outstanding, 0)

  return (
    <section className="rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-content-strong">{project.name}</h2>
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

      {project.description && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-content-muted">{project.description}</p>
      )}

      {project.deadline && !project.completedAt && (
        <p className="mt-1 text-xs text-content-faint">
          יעד: <bdi>{formatDate(project.deadline)}</bdi>
        </p>
      )}

      {project.total > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-surface-subtle p-3 text-sm">
          <Figure term='סה"כ מוסכם' value={project.total} />
          <Figure term="שולם" value={project.paid} tone="success" />
          <Figure term="לתשלום" value={project.outstanding} tone="warning" />
        </dl>
      )}

      {notYetDue > 0 && (
        <p className="mt-2 text-xs text-content-faint">
          <bdi>{formatCurrency(notYetDue)}</bdi> על עבודה שטרם הושלמה, ולכן טרם לתשלום.
        </p>
      )}

      {project.phases.length > 0 && (
        <ul className="mt-4 space-y-2">
          {project.phases.map((phase) => (
            <li
              key={phase.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
            >
              <span className="flex items-center gap-2">
                <span className="text-content-strong">{phase.name}</span>
                <StatusPill tone={toneOf(CLIENT_PHASE_STATUS_TONES, phase.status)} emphasis="quiet" dot>
                  {label(CLIENT_PHASE_STATUS_LABELS, phase.status)}
                </StatusPill>
              </span>
              <span className="tabular-nums text-content-muted">
                <bdi>{formatCurrency(phase.price)}</bdi>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Figure({
  term,
  value,
  tone,
}: {
  term: string
  value: number
  tone?: 'success' | 'warning'
}) {
  const colour =
    tone === 'success' && value > 0
      ? 'text-tone-success-foreground'
      : tone === 'warning' && value > 0
        ? 'text-tone-warning-foreground'
        : 'text-content-strong'

  return (
    <div>
      <dt className="text-xs text-content-faint">{term}</dt>
      <dd className={`font-bold tabular-nums ${colour}`}>
        <bdi>{formatCurrency(value)}</bdi>
      </dd>
    </div>
  )
}
