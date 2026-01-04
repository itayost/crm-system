// app/api/clients/[id]/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'
import { ClientStatus, ClientType } from '@prisma/client'

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(9).optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  type: z.enum(['REGULAR', 'VIP']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  notes: z.string().optional(),
})

// GET /api/clients/[id] - Get single client
export const GET = withAuth(async (req, { params, userId }) => {
  try {
    const { id: clientId } = await params
    const client = await ClientsService.getById(clientId, userId)
    return createResponse(client)
  } catch (error) {
    return errorResponse((error as Error).message || 'Client not found', 404)
  }
})

// PUT /api/clients/[id] - Update client
export const PUT = withAuth(async (req, { params, userId }) => {
  try {
    const { id: clientId } = await params
    const body = await req.json()
    const validatedData = updateClientSchema.parse(body)
    
    const client = await ClientsService.update(clientId, userId, {
      ...validatedData,
      type: validatedData.type as ClientType | undefined,
      status: validatedData.status as ClientStatus | undefined
    })
    
    return createResponse(client)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('נתונים לא תקינים', 400)
    }
    return errorResponse((error as Error).message || 'Failed to update client')
  }
})

// DELETE /api/clients/[id] - Delete client
export const DELETE = withAuth(async (req, { params, userId }) => {
  try {
    const { id: clientId } = await params
    const result = await ClientsService.delete(clientId, userId)
    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to delete client')
  }
})