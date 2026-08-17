import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Three kinds of empty, because they are three different situations and
 * answering them the same way is what made the old ones useless.
 *
 * - `new`      nothing exists yet. Explain what would create one, and offer it.
 * - `filtered` things exist, this query found none. Offer to clear the filter.
 * - `calm`     nothing is *supposed* to be here. This is good news, and it
 *              should read like good news rather than like a failure.
 *
 * The previous state of play: `components/ui/empty-state.tsx` existed, was
 * imported by nobody, and fifteen bespoke empty states were written by hand
 * instead - nine of them a bare centred div with two <p> tags.
 */
export function EmptyState({
  kind = 'new',
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  kind?: 'new' | 'filtered' | 'calm'
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      data-kind={kind}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center',
        kind === 'calm' ? 'border-tone-success-mark/30' : 'border-border-strong/60',
        className,
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className={cn(
            'size-5',
            kind === 'calm' ? 'text-tone-success-mark' : 'text-content-faint',
          )}
        />
      )}

      <p className="text-ui-md font-semibold text-content-strong">{title}</p>

      {description && (
        <p className="max-w-sm text-ui-sm text-content-subtle">{description}</p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
