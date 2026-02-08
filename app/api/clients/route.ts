// app/api/clients/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'
import { ClientStatus, ClientType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

const createClientSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין'),
  phone: z.string().min(9, 'טלפון חובה').regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  company: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  type: z.enum(['REGULAR', 'VIP']).optional(),
  notes: z.string().optional(),
})

// GET /api/clients - Get all clients
export const GET = withAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as ClientStatus | null
    const type = searchParams.get('type') as ClientType | null
    const search = searchParams.get('search') || undefined
    
    const clients = await ClientsService.getAll(userId, {
      status: status || undefined,
      type: type || undefined,
      search
    })
    
    return createResponse(clients)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch clients')
  }
})

// POST /api/clients - Create new client
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validatedData = createClientSchema.parse(body)

    // Check for duplicate email
    const existingClient = await prisma.client.findFirst({
      where: {
        userId,
        email: validatedData.email,
        status: 'ACTIVE'
      }
    })

    const client = await ClientsService.create(userId, {
      ...validatedData,
      type: validatedData.type as ClientType | undefined
    })

    return createResponse({
      ...client,
      ...(existingClient && { _warning: `לקוח עם אימייל זהה כבר קיים: ${existingClient.name}` })
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create client')
  }
})