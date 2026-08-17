import * as React from 'react'

import { cn } from '@/lib/utils'
import { toneClass, type Tone } from '@/lib/design/tones'

/**
 * A tinted panel in one of the eight tones.
 *
 * Six near-identical versions of this were written inline - the awaiting and
 * decision summaries in `commercial-card`, both halves of the portal's
 * `quote-card`, `awaiting-client-card` and `pending-review-card` - each pasting
 * `rounded-lg border border-tone-X-mark/40 bg-tone-X-surface/40 p-4` with a
 * different tone spliced in.
 *
 * The tone comes from one `.tone-*` class, which binds all five roles at once.
 * Do not pass a `bg-*` utility through `className`: that is the exact conflict
 * that left every badge in this app grey for weeks.
 */
export function TonePanel({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: Tone
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section
      data-slot="tone-panel"
      className={cn(
        toneClass[tone],
        'rounded-lg border border-[hsl(var(--t-mark)/0.35)] bg-[hsl(var(--t-surface)/0.5)] p-4',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-2 flex items-center gap-2">
          {title && (
            <h3 className="text-ui-sm font-semibold text-[hsl(var(--t-foreground))]">{title}</h3>
          )}
          {action && <div className="ms-auto">{action}</div>}
        </header>
      )}
      <div className="text-ui-sm text-content-body">{children}</div>
    </section>
  )
}
