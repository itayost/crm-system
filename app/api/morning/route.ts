// app/api/morning/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService } from '@/lib/services/morning.service'

// GET /api/morning - Test connection and get status
export const GET = withAuth(async () => {
  try {
    const isEnabled = MorningService.isEnabled()

    if (!isEnabled) {
      return createResponse({
        enabled: false,
        message: 'אינטגרציית Morning אינה מוגדרת'
      })
    }

    const connectionTest = await MorningService.testConnection()

    return createResponse({
      enabled: true,
      connected: connectionTest.success,
      businessName: connectionTest.businessName,
      error: connectionTest.error
    })
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to check Morning status')
  }
})
