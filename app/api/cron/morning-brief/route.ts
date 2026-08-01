import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { MorningBriefService } from '@/lib/services/morning-brief.service'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'
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

    const ownerChatId = await WhatsAppAgentService.getOwnerChatId()
    if (!ownerChatId) {
      return NextResponse.json({ error: 'Owner chatId not found — send a message to the bot first' }, { status: 500 })
    }

    const brief = await MorningBriefService.generateBrief(user.id)

    await WahaService.sendMessage({
      chatId: ownerChatId,
      text: brief,
    })

    return NextResponse.json({ ok: true, briefLength: brief.length })
  } catch (error) {
    console.error('Morning brief error:', error)
    return NextResponse.json({ error: 'Failed to generate morning brief' }, { status: 500 })
  }
}
