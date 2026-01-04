// app/api/morning/documents/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService, MORNING_PAYMENT_TYPES } from '@/lib/services/morning.service'

const createDocumentSchema = z.object({
  type: z.enum(['invoice', 'invoice_receipt', 'receipt', 'quote']),
  clientName: z.string().min(1, 'שם לקוח חובה'),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  clientTaxId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'תיאור פריט חובה'),
    quantity: z.number().positive(),
    price: z.number()
  })).min(1, 'נדרש לפחות פריט אחד'),
  paymentType: z.number().optional(),
  dueDate: z.string().optional(),
  remarks: z.string().optional()
})

// GET /api/morning/documents - Search documents
export const GET = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { searchParams } = new URL(req.url)

    const params = {
      type: searchParams.get('type') ? parseInt(searchParams.get('type')!) : undefined,
      status: searchParams.get('status') ? parseInt(searchParams.get('status')!) : undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 0,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50
    }

    const result = await MorningService.searchDocuments(params)

    return createResponse(result)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to search documents')
  }
})

// POST /api/morning/documents - Create a new document
export const POST = withAuth(async (req) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const body = await req.json()
    const validated = createDocumentSchema.parse(body)

    let document

    switch (validated.type) {
      case 'invoice':
        document = await MorningService.createTaxInvoice({
          clientName: validated.clientName,
          clientEmail: validated.clientEmail || undefined,
          clientPhone: validated.clientPhone,
          clientTaxId: validated.clientTaxId,
          items: validated.items,
          dueDate: validated.dueDate,
          remarks: validated.remarks
        })
        break

      case 'invoice_receipt':
        document = await MorningService.createTaxInvoiceReceipt({
          clientName: validated.clientName,
          clientEmail: validated.clientEmail || undefined,
          clientPhone: validated.clientPhone,
          clientTaxId: validated.clientTaxId,
          items: validated.items,
          paymentType: validated.paymentType || MORNING_PAYMENT_TYPES.EFT,
          remarks: validated.remarks
        })
        break

      case 'receipt':
        const totalAmount = validated.items.reduce(
          (sum, item) => sum + (item.quantity * item.price),
          0
        )
        document = await MorningService.createReceipt({
          clientName: validated.clientName,
          clientEmail: validated.clientEmail || undefined,
          amount: totalAmount,
          paymentType: validated.paymentType || MORNING_PAYMENT_TYPES.EFT,
          description: validated.items.map(i => i.description).join(', '),
          remarks: validated.remarks
        })
        break

      case 'quote':
        document = await MorningService.createQuote({
          clientName: validated.clientName,
          clientEmail: validated.clientEmail || undefined,
          clientPhone: validated.clientPhone,
          items: validated.items,
          validUntil: validated.dueDate,
          remarks: validated.remarks
        })
        break

      default:
        return errorResponse('סוג מסמך לא חוקי', 400)
    }

    return createResponse(document, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to create document')
  }
})
