import { NextRequest } from 'next/server'
import { createResponse, errorResponse } from '@/lib/api/api-handler'
import { PriorityScoringService } from '@/lib/services/priority-scoring.service'
import { prisma } from '@/lib/db/prisma'

// POST /api/cron/priority-recalc - Automated daily priority recalculation
export async function POST(req: NextRequest) {
  try {
    // Verify this is a Vercel cron request
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return errorResponse('Unauthorized', 401)
    }

    console.log('Starting automated priority recalculation...')
    
    // Get all active users
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true }
    })

    const results = []
    let totalTasksUpdated = 0
    let totalProjectsUpdated = 0

    // Recalculate scores for each user
    for (const user of users) {
      try {
        console.log(`Recalculating priority scores for user: ${user.name} (${user.email})`)
        
        const result = await PriorityScoringService.recalculateAllScores(user.id)
        
        results.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          tasksUpdated: result.tasksUpdated,
          projectsUpdated: result.projectsUpdated,
          success: true
        })
        
        totalTasksUpdated += result.tasksUpdated
        totalProjectsUpdated += result.projectsUpdated
        
        console.log(`Completed for user ${user.name}: ${result.tasksUpdated} tasks, ${result.projectsUpdated} projects`)
      } catch (error) {
        console.error(`Error recalculating for user ${user.name}:`, error)
        
        results.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          tasksUpdated: 0,
          projectsUpdated: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const summary = {
      totalUsers: users.length,
      successfulUsers: results.filter(r => r.success).length,
      failedUsers: results.filter(r => !r.success).length,
      totalTasksUpdated,
      totalProjectsUpdated,
      totalItemsUpdated: totalTasksUpdated + totalProjectsUpdated,
      executionTime: new Date().toISOString(),
      results
    }

    console.log('Automated priority recalculation completed:', summary)
    
    return createResponse({
      success: true,
      message: 'חישוב עדיפויות אוטומטי הושלם',
      data: summary
    })
  } catch (error) {
    console.error('Error in automated priority recalculation:', error)
    
    if (error instanceof Error) {
      return errorResponse(`שגיאה בחישוב עדיפויות אוטומטי: ${error.message}`, 500)
    }
    
    return errorResponse('שגיאה בחישוב עדיפויות אוטומטי', 500)
  }
}
