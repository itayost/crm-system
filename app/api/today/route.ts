import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { TodayService } from '@/lib/services/today.service'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const badges = await TodayService.getBadges(userId)

  return createResponse(badges)
})
