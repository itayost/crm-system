import * as React from 'react'

import { cn } from '@/lib/utils'
import { PHASE_STATUS_TONES, toneOf, type Tone } from '@/lib/design/tones'
import type { PhaseAmount } from '@/lib/money/project'

/**
 * A project's phases as one glyph.
 *
 * The most distinctive fact in this domain is that approval and payment are
 * separate axes: a phase can be APPROVED and unpaid, and un-approving one must
 * never un-pay it. That rule is load-bearing in the schema and in the revenue
 * maths, and it had no visual form at all - money was instead rendered three
 * times in three different shapes on the client page.
 *
 * One device carries both. Segment width is the phase's share of the money,
 * segment fill is the work state, and the rule underneath is whether the cash
 * actually landed.
 *
 * The underline is INK, never green. A green "paid" rule under a green
 * "approved" fill collapses the two axes the strip exists to separate - the
 * whole point is that hue answers "how is the work going" and the mark answers
 * "did we get paid", so they must not be the same channel.
 */

const SEGMENT_TONE: Record<Tone, string> = {
  neutral: 'bg-border-strong',
  info: 'bg-tone-info-mark',
  success: 'bg-tone-success-mark',
  warning: 'bg-tone-warning-mark',
  caution: 'bg-tone-caution-mark',
  danger: 'bg-tone-danger-mark',
  accent: 'bg-tone-accent-mark',
  progress: 'bg-tone-progress-mark',
}

function amount(value: PhaseAmount['price']): number {
  if (value == null) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

export function PhaseStrip({
  phases,
  className,
  label,
}: {
  phases: PhaseAmount[]
  className?: string
  /** Accessible summary. Falls back to a count when not supplied. */
  label?: string
}) {
  if (phases.length === 0) return null

  // A zero-price phase still has to be visible, or a project priced entirely on
  // its advance renders as an empty strip.
  const weights = phases.map((p) => Math.max(amount(p.price), 1))

  const paid = phases.filter((p) => p.paidAt).length

  return (
    <span
      data-slot="phase-strip"
      role="img"
      aria-label={label ?? `${phases.length} שלבים, ${paid} שולמו`}
      className={cn('flex h-2.5 min-w-18 items-start gap-0.5', className)}
    >
      {phases.map((phase, i) => (
        <span
          key={i}
          className={cn(
            'relative block h-1 rounded-[1px]',
            SEGMENT_TONE[toneOf(PHASE_STATUS_TONES, phase.status)],
            // The paid mark: ink, and the same ink under every fill hue.
            phase.paidAt &&
              'after:absolute after:inset-x-0 after:top-1.5 after:h-0.5 after:rounded-[1px] after:bg-content-strong',
          )}
          style={{ flex: weights[i] }}
        />
      ))}
    </span>
  )
}
