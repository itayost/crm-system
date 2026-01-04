import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { DashboardService } from '@/lib/services/dashboard.service'

// GET /api/dashboard/search - Global search
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!query) {
      // Return recent searches/suggestions
      const recentSearches = await DashboardService.getRecentSearches(userId)
      return createResponse({ results: recentSearches, type: 'recent' })
    }
    
    const results = await DashboardService.searchAll(userId, query, limit)
    
    return createResponse({ results, type: 'search', query })
  } catch (error) {
    console.error('Search error:', error)
    return errorResponse((error as Error).message || 'Failed to perform search')
  }
})