// app/api/morning/clients/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService } from '@/lib/services/morning.service'

const createClientSchema = z.object({
  name: z.string().min(1, 'שם לקוח חובה'),
  emails: z.array(z.string().email()).optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional()
})

// GET /api/morning/clients - Get or search clients
export const GET = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    let clients
    if (query) {
      clients = await MorningService.searchClients(query)
    } else {
      clients = await MorningService.getClients(page, pageSize)
    }

    return createResponse(clients)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch Morning clients')
  }
})

// POST /api/morning/clients - Create a new client in Morning
export const POST = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const body = await req.json()
    const validated = createClientSchema.parse(body)

    const client = await MorningService.createClient({
      name: validated.name,
      emails: validated.emails,
      phone: validated.phone,
      mobile: validated.mobile,
      taxId: validated.taxId,
      address: validated.address,
      city: validated.city,
      country: 'IL'
    })

    return createResponse(client, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to create Morning client')
  }
})
