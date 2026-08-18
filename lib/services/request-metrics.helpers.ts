/**
 * The arithmetic behind the request metrics, with no database attached.
 *
 * These are imported by client components (request-age.tsx renders "opened 15
 * days ago"), and they used to live beside RequestMetricsService, which imports
 * prisma. That dragged the database client into the browser bundle - harmless
 * looking until Prisma 7, whose driver adapter pulls in node-only pg and fails
 * the build outright.
 */

/** Whole days elapsed, floored - "opened 15 days ago" not "15.4". */
export function daysSince(from: Date | string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

/**
 * Median rather than mean: one job that sat for three months would drag an
 * average past every real number and make the figure useless.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
