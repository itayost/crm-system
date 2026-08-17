import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * One labelled number.
 *
 * This component existed three times - in `client-summary-band`,
 * `client-money-card` and the portal's `project-card` - written slightly
 * differently each time, with each copy re-deciding its own tone ternary.
 *
 * `<bdi>` is not optional. These are LTR numbers inside an RTL page; without
 * it `₪1,200` renders with the shekel on the wrong side. The portal already
 * knew this and wrapped every figure; the dashboard did not, anywhere. Putting
 * it in the primitive means no call site has to remember.
 */
export function Figure({
  term,
  value,
  tone = 'plain',
  className,
}: {
  term: React.ReactNode
  value: React.ReactNode
  tone?: 'plain' | 'paid' | 'due' | 'muted'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <dt className="text-ui-2xs text-content-subtle">{term}</dt>
      <dd
        className={cn(
          'font-mono text-ui-md font-semibold tabular-nums',
          tone === 'plain' && 'text-content-strong',
          tone === 'paid' && 'text-figure-paid',
          tone === 'due' && 'text-figure-due',
          tone === 'muted' && 'text-content-subtle',
        )}
      >
        <bdi>{value}</bdi>
      </dd>
    </div>
  )
}

/**
 * The money band under a detail-page header.
 *
 * Money renders at exactly one granularity per page, and the granularity is
 * the page's own noun. This is that one place for a client or a project;
 * per-project money becomes columns in a table, and per-phase money lives only
 * on the project page. Following that rule is what removes six of the eleven
 * stacked cards from the client page.
 */
export function MoneyLine({
  figures,
  className,
}: {
  figures: React.ComponentProps<typeof Figure>[]
  className?: string
}) {
  return (
    <dl
      data-slot="money-line"
      className={cn('flex flex-wrap divide-x divide-x-reverse rounded-lg border bg-card', className)}
    >
      {figures.map((figure, i) => (
        <Figure key={i} {...figure} className="min-w-[8rem] flex-1 px-4 py-2.5" />
      ))}
    </dl>
  )
}
