import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The title row every page starts with.
 *
 * This block was hand-typed on seven pages, each with its own idea of the
 * heading size and whether a subtitle belonged. `count` sits next to the title
 * rather than under it, because in a console the useful question is "how many
 * am I looking at", not "what is this page called" - you already know that.
 */
export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  /** Result count, rendered beside the title. Omit when it is not a list. */
  count?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h1 className="text-ui-lg font-semibold text-content-strong">{title}</h1>

      {count != null && (
        <span className="font-mono text-ui-xs tabular-nums text-content-faint">{count}</span>
      )}

      {description && (
        <p className="text-ui-xs text-content-subtle">{description}</p>
      )}

      {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
