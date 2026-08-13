/**
 * Fixed-window rate limiting, held in memory.
 *
 * Per instance, not global: Vercel may run several function instances, so the
 * true ceiling is limit x instances. That is enough for what this guards. A
 * burst from one caller lands on one warm instance, and the endpoint's real
 * defences are the shared secret (nothing without it gets this far) and the
 * duplicate window (identical payloads never become a second row). This layer
 * only exists to stop someone hammering a leaked secret.
 *
 * Windows are pruned as they expire, so an endless stream of distinct keys
 * cannot grow the process forever.
 */

/** Prune expired windows once the map grows past this many keys. */
const PRUNE_THRESHOLD = 500

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  if (windows.size > PRUNE_THRESHOLD) prune(now)

  const current = windows.get(key)

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  // Immutable update: the window is replaced rather than counted up in place.
  windows.set(key, { ...current, count: current.count + 1 })

  return { allowed: true, remaining: limit - current.count - 1, retryAfterSeconds: 0 }
}

/** Test seam: forget every window. */
export function resetRateLimits(): void {
  windows.clear()
}

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}
