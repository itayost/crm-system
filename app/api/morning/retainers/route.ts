// app/api/morning/retainers/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService } from '@/lib/services/morning.service'

const createRetainerSchema = z.object({
  clientName: z.string().min(1, 'שם לקוח חובה'),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  clientTaxId: z.string().optional(),
  description: z.string().min(1, 'תיאור שירות חובה'),
  amount: z.number().positive('הסכום חייב להיות חיובי'),
  frequency: z.number().min(1).max(12).default(1), // 1=monthly, 12=annual
  startDate: z.string().optional(),  // Default: today
  endDate: z.string().optional(),
  remarks: z.string().optional()
})

// GET /api/morning/retainers - Get all retainers
export const GET = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
      ? parseInt(searchParams.get('status')!)
      : undefined
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const result = await MorningService.getRetainers({ status, page, pageSize })

    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch retainers')
  }
})

// POST /api/morning/retainers - Create a new retainer
export const POST = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const body = await req.json()
    const validated = createRetainerSchema.parse(body)

    const retainer = await MorningService.createRetainer({
      clientName: validated.clientName,
      clientEmail: validated.clientEmail || undefined,
      clientPhone: validated.clientPhone,
      clientTaxId: validated.clientTaxId,
      description: validated.description,
      amount: validated.amount,
      frequency: validated.frequency,
      startDate: validated.startDate || new Date().toISOString().split('T')[0],
      endDate: validated.endDate,
      remarks: validated.remarks
    })

    return createResponse(retainer, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to create retainer')
  }
})
