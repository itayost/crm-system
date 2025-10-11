import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { PriorityScoringService } from '@/lib/services/priority-scoring.service'
import { withAuth } from '@/lib/api/auth-handler'

// GET /api/priority/top - Get top priority items
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Validate limit
    if (limit < 1 || limit > 50) {
      return errorResponse('מספר הפריטים חייב להיות בין 1 ל-50', 400)
    }
    
    const topItems = await PriorityScoringService.getTopPriorityItems(userId, limit)
    
    return createResponse({
      success: true,
      data: {
        items: topItems,
        count: topItems.length,
        limit
      }
    })
  } catch (error) {
    console.error('Error fetching top priority items:', error)
    
    if (error instanceof Error) {
      return errorResponse(`שגיאה בטעינת פריטי עדיפות: ${error.message}`, 500)
    }
    
    return errorResponse('שגיאה בטעינת פריטי עדיפות', 500)
  }
})
