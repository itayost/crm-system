import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * Validates the Bearer token in the Authorization header against AGENT_API_KEY.
 * Uses constant-time compare to prevent timing-based key recovery.
 *
 * Returns null on success (handler may proceed) or a NextResponse 401 on failure.
 */
export function validateAgentBearer(req: NextRequest): NextResponse | null {
  const expected = process.env.AGENT_API_KEY
  if (!expected) {
    return NextResponse.json({ error: 'AGENT_API_KEY not configured' }, { status: 500 })
  }

  const header = req.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provided = header.slice(prefix.length)
  // Lengths must match for timingSafeEqual; pad to common length on mismatch.
  if (provided.length !== expected.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
