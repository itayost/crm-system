// app/api/leads/[id]/convert/route.ts
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { LeadsService } from '@/lib/services/leads.service'

// POST /api/leads/[id]/convert - Convert lead to client
export const POST = withAuth(async (req, { params, userId }) => {
  try {
    const leadId = params.id as string
    const result = await LeadsService.convertToClient(leadId, userId)
    
    return createResponse({
      message: 'הליד הומר ללקוח בהצלחה',
      ...result
    })
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to convert lead')
  }
})