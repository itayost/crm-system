// app/api/clients/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'
import { ClientStatus, ClientType } from '@prisma/client'

const createClientSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין'),
  phone: z.string().min(9, 'טלפון חובה'),
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
    
    const client = await ClientsService.create(userId, {
      ...validatedData,
      type: validatedData.type as ClientType | undefined
    })
    
    return createResponse(client, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to create client')
  }
})