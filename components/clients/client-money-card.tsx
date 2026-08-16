'use client'

import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import { PHASE_STATUS_LABELS, label } from '@/lib/design/labels'
import { PHASE_STATUS_TONES, toneOf } from '@/lib/design/tones'
import { projectOutstanding, projectPaid, projectTotal } from '@/lib/utils/project-money'
import { formatCurrency } from '@/lib/utils'

/**
 * Amounts as they arrive here, which is over JSON - so a Prisma Decimal is
 * already a string by the time this renders. Deliberately narrower than the
 * `Money` type in project-money.ts, which also allows a live Decimal object
 * that only exists server-side.
 */
type JsonMoney = number | string | null | undefined

export interface MoneyProject {
  id: string
  name: string
  advanceAmount?: JsonMoney
  advancePaidAt?: string | null
  phases?: {
    id?: string
    name?: string
    price: JsonMoney
    status?: string
    paidAt?: string | null
  }[]
}

/**
 * What this client is worth, and what they still owe.
 *
 * Every number here was already in the payload - getById returns each phase's
 * price, status and paidAt - and the page threw all of it away except a single
 * per-project total. The three helpers are the same ones the dashboard uses, so
 * a client page and the revenue tile cannot disagree.
 *
 * Retention is deliberately absent: it is a recurring arrangement, not part of
 * a project total, and project-money.ts leaves it out for that reason.
 */
export function ClientMoneyCard({ projects }: { projects: MoneyProject[] }) {
  const withMoney = projects.filter(
    (p) => Number(p.advanceAmount ?? 0) > 0 || (p.phases?.length ?? 0) > 0,
  )
  if (withMoney.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>כספים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {withMoney.map((project) => {
          const phases = project.phases ?? []
          const total = projectTotal(project.advanceAmount, phases)
          const paid = projectPaid(project.advanceAmount, project.advancePaidAt, phases)
          const owed = projectOutstanding(phases)

          return (
            <div key={project.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium text-content-strong hover:underline"
                >
                  {project.name}
                </Link>
                <span className="text-sm text-content-muted">
                  <bdi>{formatCurrency(total)}</bdi>
                </span>
              </div>

              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <Figure term="שולם" value={paid} tone="success" />
                <Figure term="לגבייה" value={owed} tone={owed > 0 ? 'warning' : undefined} />
                <Figure term="טרם אושר" value={Math.max(total - paid - owed, 0)} />
              </dl>

              {phases.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {phases.map((phase, i) => (
                    <li
                      key={phase.id ?? i}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-content-body">{phase.name ?? `שלב ${i + 1}`}</span>
                        {phase.status && (
                          <StatusPill
                            tone={toneOf(PHASE_STATUS_TONES, phase.status)}
                            emphasis="quiet"
                            dot
                          >
                            {label(PHASE_STATUS_LABELS, phase.status)}
                          </StatusPill>
                        )}
                        {phase.paidAt && (
                          <StatusPill tone="success" emphasis="quiet" dot>
                            שולם
                          </StatusPill>
                        )}
                      </span>
                      <span className="tabular-nums text-content-strong">
                        <bdi>{formatCurrency(phase.price ?? 0)}</bdi>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
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
      <dd className={`font-semibold tabular-nums ${colour}`}>
        <bdi>{formatCurrency(value)}</bdi>
      </dd>
    </div>
  )
}
