import { Skeleton } from '@/components/ui/skeleton'

/**
 * A loading state shaped like the thing that replaces it.
 *
 * Five list pages each rendered the identical `5 x <Skeleton className="h-12
 * w-full" />` - a stack of grey bars that looks nothing like a table with a
 * header, so the layout jumped the moment data arrived. This draws the header
 * band and the row rhythm at the real row height.
 */
export function TableSkeleton({
  rows = 6,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden>
      <div className="flex h-8 items-center gap-4 border-b bg-surface-subtle px-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1 rounded-sm" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-row items-center gap-4 border-b px-3 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3 rounded-sm"
              // Uneven widths read as content rather than as a loading bar.
              style={{ flex: c === 0 ? 2 : 1, maxWidth: c === 0 ? undefined : '6rem' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
