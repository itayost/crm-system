import * as React from 'react'

import { cn } from '@/lib/utils'
import { toneClass, type Emphasis, type Tone } from '@/lib/design/tones'

/**
 * Shape per emphasis. Only `solid` gets `font-semibold` - when every pill in a
 * row was semibold, none of them was emphasis.
 */
const SHAPE: Record<Emphasis, string> = {
  solid: 'rounded-full border px-2 py-0.5 text-xs font-semibold',
  soft: 'rounded-full border px-2 py-0.5 text-xs font-medium',
  outline: 'rounded-full border px-2 py-0.5 text-xs font-medium',
  quiet: 'text-xs font-medium',
}

/**
 * Every status in the product, in one shape.
 *
 * `tone` is which thing it is; `emphasis` is how much it matters. Keeping the
 * two apart is the whole point: a table gets one soft pill for its spine,
 * `quiet` for its metadata, and saves `solid` for the one value that should
 * stop you.
 *
 * `dot` is where the hue actually reads. A -100 wash under -800 text are the
 * two worst places to carry a hue, which is why indigo and blue statuses were
 * indistinguishable. The dot is the first flex child, so RTL puts it on the
 * leading edge with no per-direction CSS.
 *
 * Do not pass a background utility through `className`. The colour comes from
 * one `.tone-*` rule, and a `bg-` utility next to it is the exact conflict that
 * left every badge in this app grey for weeks.
 */
export function StatusPill({
  tone,
  emphasis = 'soft',
  dot = false,
  interactive = false,
  className,
  children,
  ...props
}: {
  tone: Tone
  emphasis?: Emphasis
  dot?: boolean
  interactive?: boolean
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="status-pill"
      data-emphasis={emphasis}
      className={cn(
        'tone-tag inline-flex items-center gap-1.5 align-middle whitespace-nowrap',
        SHAPE[emphasis],
        toneClass[tone],
        interactive &&
          'cursor-pointer transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="tone-mark size-1.5 shrink-0 rounded-full" />}
      {children}
    </span>
  )
}
