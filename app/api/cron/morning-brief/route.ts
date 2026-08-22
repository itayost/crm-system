import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MorningBriefService } from '@/lib/services/morning-brief.service'
import { notifyOwner } from '@/lib/services/owner-line'
import { isCronAuthorized } from '@/lib/api/cron-auth'

// The brief now prefers the VPS's local model; CPU inference runs 1-2 minutes.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'No owner user found' }, { status: 500 })
    }

    const brief = await MorningBriefService.generateBrief(user.id)

    const delivered = await notifyOwner(brief, { about: 'the morning brief' })

    if (!delivered) {
      return NextResponse.json(
        { error: 'Morning brief generated but could not be delivered' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, briefLength: brief.length })
  } catch (error) {
    console.error('Morning brief error:', error)
    return NextResponse.json({ error: 'Failed to generate morning brief' }, { status: 500 })
  }
}
