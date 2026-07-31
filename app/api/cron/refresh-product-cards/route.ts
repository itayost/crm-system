import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ProductCardService } from '@/lib/services/product-card.service'
import { isCronAuthorized } from '@/lib/api/cron-auth'

// Reading and summarising a whole repo takes longer than the default window,
// and on a night when several repos moved this runs them back to back.
export const maxDuration = 300

/**
 * Nightly, SHA-gated. Most nights every repo reports `unchanged` and the run
 * costs eight GitHub calls and zero model calls. `?projectId=` forces one
 * project through even on an unchanged HEAD - for right after editing the
 * generator or a card's manual notes.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'No owner user found' }, { status: 500 })
  }

  const projectId = req.nextUrl.searchParams.get('projectId')

  try {
    if (projectId) {
      const outcome = await ProductCardService.refreshProject(user.id, projectId, { force: true })
      return NextResponse.json({ ok: outcome !== 'failed', outcome })
    }

    const outcomes = await ProductCardService.refreshAll(user.id)
    const failed = Object.values(outcomes).filter((o) => o === 'failed').length
    return NextResponse.json({ ok: failed === 0, outcomes })
  } catch (error) {
    console.error('Product card refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh product cards' }, { status: 500 })
  }
}
