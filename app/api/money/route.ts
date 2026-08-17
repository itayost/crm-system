import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { MoneyService } from '@/lib/services/money.service'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const ledger = await MoneyService.getLedger(userId)

  return createResponse(ledger)
})
