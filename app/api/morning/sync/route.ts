// app/api/morning/sync/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService } from '@/lib/services/morning.service'
import { prisma } from '@/lib/db/prisma'

const syncClientSchema = z.object({
  clientId: z.string().min(1, 'מזהה לקוח חובה')
})

// POST /api/morning/sync - Sync a CRM client to Morning
export const POST = withAuth(async (req, { userId }) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const body = await req.json()
    const validated = syncClientSchema.parse(body)

    // Get CRM client
    const crmClient = await prisma.client.findFirst({
      where: {
        id: validated.clientId,
        userId
      }
    })

    if (!crmClient) {
      return errorResponse('לקוח לא נמצא', 404)
    }

    // Create or find client in Morning
    const morningClient = await MorningService.createClient({
      name: crmClient.company || crmClient.name,
      emails: crmClient.email ? [crmClient.email] : undefined,
      phone: crmClient.phone || undefined,
      taxId: crmClient.taxId || undefined,
      address: crmClient.address || undefined,
      country: 'IL'
    })

    return createResponse({
      success: true,
      crmClient: {
        id: crmClient.id,
        name: crmClient.name
      },
      morningClient
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to sync client')
  }
})
