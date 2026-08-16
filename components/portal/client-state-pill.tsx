import { StatusPill } from '@/components/ui/status-pill'
import { CLIENT_REQUEST_STATUS_LABELS, REQUEST_BILLING_LABELS, label } from '@/lib/design/labels'
import {
  CLIENT_REQUEST_STATUS_TONES,
  REQUEST_BILLING_TONES,
  toneOf,
  type Emphasis,
} from '@/lib/design/tones'

/**
 * The only place the portal renders a request state.
 *
 * AWAITING_YOU is the one state allowed `solid`. It is the single row in the
 * list that asks the reader to do something, and the emphasis axis exists
 * precisely so that row can shout while the other four stay scannable.
 */
const STATE_EMPHASIS: Record<string, Emphasis> = {
  AWAITING_YOU: 'solid',
}

export function ClientStatePill({ state }: { state: string }) {
  return (
    <StatusPill
      tone={toneOf(CLIENT_REQUEST_STATUS_TONES, state)}
      emphasis={STATE_EMPHASIS[state] ?? 'soft'}
      dot
    >
      {label(CLIENT_REQUEST_STATUS_LABELS, state)}
    </StatusPill>
  )
}

/** Who pays, in the client's words. Quiet: it is metadata beside the state. */
export function BillingPill({ billingKind }: { billingKind: string | null }) {
  if (!billingKind) return null

  return (
    <StatusPill tone={toneOf(REQUEST_BILLING_TONES, billingKind)} emphasis="quiet" dot>
      {label(REQUEST_BILLING_LABELS, billingKind)}
    </StatusPill>
  )
}
