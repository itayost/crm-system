import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { updateContactSchema } from '@/lib/validations/contact'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const contact = await ContactsService.getById(userId, id)

  return createResponse(contact)
})

export const PUT = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = updateContactSchema.parse(body)
  const contact = await ContactsService.update(userId, id, data)

  return createResponse(contact)
})

export const DELETE = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  await ContactsService.delete(userId, id)

  return createResponse({ success: true })
})
