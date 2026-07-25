import { NextRequest, NextResponse } from 'next/server'
import { SupportFollowupsService } from '@/lib/services/support-followups.service'
import { isCronAuthorized } from '@/lib/api/cron-auth'

/**
 * Hourly sweep over support conversations whose confirmation went unanswered:
 * two reminders, then file the draft flagged as unconfirmed.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await SupportFollowupsService.sweep()
    return NextResponse.json({ ok: true, ...stats })
  } catch (error) {
    console.error('support-followups error:', error)
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
