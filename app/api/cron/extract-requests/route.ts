import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { RequestExtractionService } from '@/lib/services/request-extraction.service'
import { isCronAuthorized } from '@/lib/api/cron-auth'

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

    const stats = await RequestExtractionService.runForOwner(user.id)
    return NextResponse.json({ ok: true, ...stats })
  } catch (error) {
    console.error('extract-requests error:', error)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
