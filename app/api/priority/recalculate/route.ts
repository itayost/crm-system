import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { PriorityScoringService } from '@/lib/services/priority-scoring.service'
import { withAuth } from '@/lib/api/auth-handler'

// POST /api/priority/recalculate - Manually trigger priority recalculation
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    console.log(`Starting priority recalculation for user ${userId}`)
    
    const result = await PriorityScoringService.recalculateAllScores(userId)
    
    console.log(`Priority recalculation completed for user ${userId}:`, result)
    
    return createResponse({
      success: true,
      message: 'חישוב עדיפויות הושלם בהצלחה',
      data: {
        tasksUpdated: result.tasksUpdated,
        projectsUpdated: result.projectsUpdated,
        totalUpdated: result.tasksUpdated + result.projectsUpdated
      }
    })
  } catch (error) {
    console.error('Error recalculating priority scores:', error)
    
    if (error instanceof Error) {
      return errorResponse(`שגיאה בחישוב עדיפויות: ${error.message}`, 500)
    }
    
    return errorResponse('שגיאה בחישוב עדיפויות', 500)
  }
})
