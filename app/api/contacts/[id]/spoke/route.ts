import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { recordConversationSchema } from '@/lib/validations/contact'

/**
 * דיברתי. Its own route rather than a flag on PUT /contacts/[id], so that
 * lastContactedAt never appears on the general update schema where a caller
 * could set it to an arbitrary value.
 */
export const POST = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = recordConversationSchema.parse(body)
  const contact = await ContactsService.recordConversation(userId, id, data)

  return createResponse(contact)
})
