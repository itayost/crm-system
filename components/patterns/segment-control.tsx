'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface Segment {
  /** URL value for `?view=`. */
  value: string
  label: string
  count?: number
}

/**
 * The named piles of a list, as one control.
 *
 * The rule this enforces: a pile is a segment, not a stacked block. Every named
 * subset of a list is mutually exclusive, counted here, and addressed by a
 * single `?view=` param. Nothing that is a subset of a table renders above that
 * table.
 *
 * That one rule removes `RequestPipeline` and `DecisionsCard` as page furniture
 * (each was rendered verbatim on three pages), collapses the three different
 * filter idioms on /tasks into one, and makes the `?status=` vs `?queue=`
 * mismatch impossible - the pipeline linked to `?status=`, the page only ever
 * read `?queue=`, so four of its five links silently went to an unfiltered list.
 */
export function SegmentControl({
  segments,
  value,
  onChange,
  className,
}: {
  segments: Segment[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="תצוגות"
      data-slot="segment-control"
      className={cn(
        'flex w-max max-w-full gap-0.5 overflow-x-auto rounded-md bg-surface-muted p-0.5',
        className,
      )}
    >
      {segments.map((segment) => {
        const active = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-segment={segment.value}
            onClick={() => onChange(segment.value)}
            className={cn(
              'inline-flex h-control items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 text-ui-sm transition-colors duration-fast',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card font-semibold text-content-strong shadow-e1'
                : 'text-content-muted hover:text-content-strong',
            )}
          >
            {segment.label}
            {segment.count != null && (
              <span
                className={cn(
                  'font-mono text-ui-2xs tabular-nums',
                  active ? 'text-content-strong' : 'text-content-faint',
                )}
              >
                {segment.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
