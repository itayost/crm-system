import { StatusPill } from '@/components/ui/status-pill'
import { daysSince } from '@/lib/services/request-metrics.service'

/** Past this, an open request is worth a second look rather than a scroll past. */
const STALE_DAYS = 7

/**
 * How long a request has been sitting.
 *
 * The dates were always there and never shown, so a ticket could go quiet for
 * two weeks without anything on screen changing. Only open work ages: once a
 * request is resolved the number is trivia, so it goes plain.
 */
export function RequestAge({ createdAt, status }: { createdAt: string; status: string }) {
  const days = daysSince(createdAt)
  const live = status === 'PENDING_REVIEW' || status === 'OPEN' || status === 'IN_PROGRESS'

  if (days === 0) return <span className="text-xs text-content-faint">היום</span>

  const text = `${days} ימים`

  if (live && days >= STALE_DAYS) {
    return (
      <StatusPill tone="warning" emphasis="outline">
        <bdi>{text}</bdi>
      </StatusPill>
    )
  }

  return (
    <span className={live ? 'text-sm text-content-body' : 'text-sm text-content-faint'}>
      <bdi>{text}</bdi>
    </span>
  )
}
