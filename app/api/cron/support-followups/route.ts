import { NextRequest, NextResponse } from 'next/server'
import { SupportFollowupsService } from '@/lib/services/support-followups.service'
import { isCronAuthorized } from '@/lib/api/cron-auth'
import { isBotPaused } from '@/lib/config/bot-pause'

/**
 * Hourly sweep over support conversations whose confirmation went unanswered:
 * two reminders, then file the draft flagged as unconfirmed.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A reminder is the bot writing to a client unprompted, so the pause covers
  // it too. The unanswered confirmations keep waiting and get swept once the
  // bot is back.
  if (isBotPaused()) {
    return NextResponse.json({ ok: true, paused: true })
  }

  try {
    const stats = await SupportFollowupsService.sweep()
    return NextResponse.json({ ok: true, ...stats })
  } catch (error) {
    console.error('support-followups error:', error)
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
