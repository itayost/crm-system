import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'
import { StorageService } from '@/lib/services/storage.service'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const path = new URL(req.url).searchParams.get('path')
  if (!path) {
    return errorResponse('path חסר', 400)
  }

  // Ownership + path membership guard (RequestsService.getById throws if not owned).
  const request = await RequestsService.getById(userId, id)
  if (!request.attachments.includes(path)) {
    return errorResponse('קובץ לא נמצא', 404)
  }

  try {
    const url = await StorageService.getSignedUrl(path)
    return createResponse({ url })
  } catch {
    return errorResponse('שגיאה בהפקת קישור לקובץ', 500)
  }
})
