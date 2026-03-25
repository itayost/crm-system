import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { createContactSchema } from '@/lib/validations/contact'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
  const { searchParams } = new URL(req.url)

  const contacts = await ContactsService.getAll(userId, {
    status: searchParams.get('status') || undefined,
    source: searchParams.get('source') || undefined,
    phase: (searchParams.get('phase') as 'lead' | 'client') || undefined,
    search: searchParams.get('search') || undefined,
  })

  return createResponse(contacts)
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
  const body = await req.json()
  const data = createContactSchema.parse(body)
  const contact = await ContactsService.create(userId, data)

  return createResponse(contact, 201)
})
