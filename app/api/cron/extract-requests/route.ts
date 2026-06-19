import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { RequestExtractionService } from '@/lib/services/request-extraction.service'

export async function GET(req: NextRequest) {
  // Fail closed: a missing CRON_SECRET is a misconfiguration, not "auth off".
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
