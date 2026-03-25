import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { DashboardService } from '@/lib/services/dashboard.service'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const data = await DashboardService.getData(userId)

  return createResponse(data)
})
