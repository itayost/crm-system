import * as React from 'react'

import { cn } from '@/lib/utils'

export interface Fact {
  term: React.ReactNode
  value: React.ReactNode
  /** Hide the row entirely when the value is empty, rather than printing a dash. */
  hideWhenEmpty?: boolean
}

/**
 * The facts about a record, beside the work rather than stacked above it.
 *
 * A detail page has one column of work and one rail of facts. Anything that is
 * neither actionable nor a fact does not exist. `/clients/[id]` was eleven
 * full-width cards in a single column; most of what they held is reference
 * material that belongs here, read once and then ignored.
 *
 * A real `<dl>`, not a grid of loose spans - the old "פרטים" blocks were
 * `md:grid-cols-2` of label/value pairs whose two columns never lined up with
 * each other.
 */
export function FactRail({
  facts,
  className,
}: {
  facts: Fact[]
  className?: string
}) {
  const visible = facts.filter(
    (f) => !f.hideWhenEmpty || (f.value != null && f.value !== ''),
  )

  return (
    <dl
      data-slot="fact-rail"
      className={cn('divide-y overflow-hidden rounded-lg border bg-card', className)}
    >
      {visible.map((fact, i) => (
        <div key={i} className="flex gap-3 px-3 py-2 text-ui-xs">
          <dt className="w-18 shrink-0 text-content-subtle">{fact.term}</dt>
          <dd className="min-w-0 flex-1 text-content-body">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
