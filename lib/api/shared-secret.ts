import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison of a caller-supplied secret against the configured
 * one. Shared by every endpoint that authenticates with a header secret, so
 * none of them re-derives the length check that timingSafeEqual needs.
 */
export function timingSafeMatch(provided: string, configured: string): boolean {
  const left = Buffer.from(provided)
  const right = Buffer.from(configured)

  if (left.length !== right.length) return false

  return timingSafeEqual(left, right)
}
