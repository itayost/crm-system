import { Skeleton } from '@/components/ui/skeleton'

/**
 * The first streaming boundary in the app.
 *
 * There was no loading.tsx, error.tsx or not-found.tsx anywhere, so a
 * navigation showed the previous page until the next one's client-side fetch
 * resolved. Additive: it works with the existing 'use client' + axios pages
 * because App Router wraps the segment regardless.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
