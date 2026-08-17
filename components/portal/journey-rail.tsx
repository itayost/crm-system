import { StatusPill } from '@/components/ui/status-pill'
import { toneClass, type Tone } from '@/lib/design/tones'
import type { ClientPhaseView, ClientTimelineEvent } from '@/lib/services/client-view'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

/**
 * The portal's signature device.
 *
 * The console's phase strip encodes width = price, fill = work state, ink
 * underline = paid. Right for an operator scanning twelve projects; wrong for a
 * client reading their own, because width-as-price says "this step matters more
 * because it costs more", and a 10px horizontal glyph cannot carry a date.
 *
 * So the client's version is vertical, dated, and shows the future:
 *
 *   done   filled ink marker + the date it happened on. Proof, with a timestamp.
 *   now    the only tone-coloured marker on the rail. Colour is scarce here
 *          precisely so this one is unmissable at arm's length.
 *   ahead  a hollow ring and a dotted connector, undated - the shape of what is
 *          left, which is the half that answers "what happens next" without the
 *          client having to ask for it.
 *
 * Paid stays an ink underline, inherited from the phase strip and not
 * negotiable: work state owns the colour and money owns the mark. Rendering
 * "paid" in green collapses the two axes the device exists to keep apart -
 * approval and payment are separate facts, and PhasesService is emphatic that
 * un-approving a phase must never un-pay it.
 *
 * One device, two uses: the phases of a project and the events of a request.
 * A client learns it once.
 */
export type JourneyState = 'done' | 'now' | 'ahead'

export interface JourneyStep {
  key: string
  title: string
  state: JourneyState
  /** Painted only on the `now` marker. Every other state is ink or nothing. */
  tone?: Tone
  at?: string | null
  amount?: number | null
  /** Draws the ink underline under the amount. */
  paid?: boolean
  /** A short trailing label for the current step, e.g. בעבודה. */
  badge?: string
  note?: string
}

export function JourneyRail({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  if (steps.length === 0) return null

  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1

        return (
          <li key={step.key} className="grid grid-cols-[0.875rem_1fr] gap-3.5">
            <Glyph state={step.state} tone={step.tone} last={last} />

            <div className={cn('flex flex-col gap-1', last ? 'pb-0' : 'pb-5')}>
              <span
                className={cn(
                  'text-portal-sm',
                  step.state === 'now' && 'font-bold text-content-strong',
                  step.state === 'done' && 'font-semibold text-content-body',
                  step.state === 'ahead' && 'font-medium text-content-muted',
                )}
              >
                {step.title}
              </span>

              {(step.at || step.amount != null || step.badge) && (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-portal-2xs text-content-muted">
                  {step.badge && (
                    <StatusPill tone={step.tone ?? 'neutral'} emphasis="soft" dot>
                      {step.badge}
                    </StatusPill>
                  )}
                  {step.at && (
                    <span className="font-mono tabular-nums">
                      <bdi>{formatDate(step.at)}</bdi>
                    </span>
                  )}
                  {step.amount != null && (
                    <span
                      className={cn(
                        'font-mono tabular-nums',
                        step.paid &&
                          'border-b-2 border-content-strong pb-px font-semibold text-content-strong',
                      )}
                    >
                      <bdi>{formatCurrency(step.amount)}</bdi>
                    </span>
                  )}
                </span>
              )}

              {step.note && <span className="text-portal-xs text-content-muted">{step.note}</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The marker column.
 *
 * `h-full` on a stretched grid item is what lets the connector fill the gap the
 * body's padding creates - which is why the spacing lives on the body and not on
 * the row. Put it on the row and every connector stops short, leaving a rail
 * that reads as a column of disconnected dots.
 */
function Glyph({ state, tone, last }: { state: JourneyState; tone?: Tone; last: boolean }) {
  return (
    <span aria-hidden className="flex h-full flex-col items-center">
      <span
        className={cn(
          'mt-1 shrink-0 rounded-full border-2',
          state === 'done' && 'size-3.5 border-primary bg-primary',
          // The halo is the "you are here". It reads --t-mark from the tone
          // class on this same element, so the hue is chosen once.
          state === 'now' &&
            cn(
              toneClass[tone ?? 'progress'],
              'tone-mark size-3.5 border-transparent ring-4 ring-[hsl(var(--t-mark)/0.18)]',
            ),
          // A dashed 14px circle renders as four arcs and reads as a drawing
          // artifact rather than as a marker. Hollow and slightly smaller says
          // "not yet" without looking broken.
          state === 'ahead' && 'size-3 border-border-strong bg-transparent',
        )}
      />
      {!last && (
        <span
          className={cn(
            'mt-0.5 w-0.5 flex-1',
            state === 'done'
              ? 'bg-[hsl(var(--rail-travelled))]'
              : // Untravelled: a dotted connector, drawn rather than dashed, so
                // the rhythm does not change with the gap it has to span.
                'bg-[repeating-linear-gradient(180deg,hsl(var(--border-strong))_0_3px,transparent_3px_9px)]',
          )}
        />
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------
 * Adapters. The rail knows nothing about requests or phases.
 * ---------------------------------------------------------------------- */

export function timelineSteps(events: ClientTimelineEvent[]): JourneyStep[] {
  return events.map((event) => ({
    key: event.key,
    title: event.label,
    state: event.state,
    tone: event.tone,
    at: event.at,
    note: event.note,
  }))
}

/**
 * A project's phases as a journey.
 *
 * PAID and DONE are both behind the client; IN_PROGRESS and AWAITING_YOU are
 * where we are; SCHEDULED is ahead. The date shown is the one that proves the
 * step: when it was paid, else when it was signed off.
 */
export function phaseSteps(
  phases: ClientPhaseView[],
  labels: Record<string, string>,
  advance?: { amount: number; paidAt: string | null } | null,
): JourneyStep[] {
  // The advance is money the client agreed to and may already have paid, but it
  // is not a ProjectPhase - so without it the rail adds up to less than the
  // total sitting directly above it, with nothing on the page explaining why.
  const head: JourneyStep[] = advance
    ? [
        {
          key: 'advance',
          title: 'מקדמה',
          state: advance.paidAt ? 'done' : 'now',
          tone: 'caution',
          at: advance.paidAt,
          amount: advance.amount,
          paid: !!advance.paidAt,
          badge: advance.paidAt ? undefined : 'ממתין לתשלום',
        },
      ]
    : []

  const rest = phases.map((phase): JourneyStep => {
    const done = phase.status === 'PAID' || phase.status === 'DONE'
    const ahead = phase.status === 'SCHEDULED'

    return {
      key: phase.id,
      title: phase.name,
      state: done ? 'done' : ahead ? 'ahead' : 'now',
      tone: phase.status === 'AWAITING_YOU' ? 'caution' : 'progress',
      at: phase.paidAt ?? phase.approvedAt,
      amount: phase.price > 0 ? phase.price : null,
      paid: phase.status === 'PAID',
      badge: done || ahead ? undefined : labels[phase.status],
    }
  })

  return [...head, ...rest]
}
