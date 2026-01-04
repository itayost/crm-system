// app/api/morning/invoice/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService, MORNING_PAYMENT_TYPES } from '@/lib/services/morning.service'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

const createInvoiceFromPaymentSchema = z.object({
  paymentId: z.string().min(1, 'מזהה תשלום חובה'),
  markAsPaid: z.boolean().optional().default(false),
  paymentType: z.number().optional()
})

const createInvoiceDirectSchema = z.object({
  clientId: z.string().min(1, 'מזהה לקוח חובה'),
  projectId: z.string().optional(),
  amount: z.number().positive('הסכום חייב להיות חיובי'),
  description: z.string().min(1, 'תיאור חובה'),
  createPayment: z.boolean().optional().default(true),
  markAsPaid: z.boolean().optional().default(false),
  paymentType: z.number().optional()
})

// POST /api/morning/invoice - Create invoice from payment or directly
export const POST = withAuth(async (req, { userId }) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const body = await req.json()

    // Check if creating from payment or directly
    if (body.paymentId) {
      // Create invoice from existing CRM payment
      const validated = createInvoiceFromPaymentSchema.parse(body)

      const payment = await prisma.payment.findFirst({
        where: {
          id: validated.paymentId,
          userId
        },
        include: {
          client: true,
          project: true
        }
      })

      if (!payment) {
        return errorResponse('תשלום לא נמצא', 404)
      }

      // Check if invoice already exists
      if (payment.invoiceNumber) {
        return errorResponse('חשבונית כבר הופקה לתשלום זה', 400)
      }

      const description = payment.project
        ? `${payment.project.name} - ${payment.notes || 'תשלום'}`
        : payment.notes || 'תשלום עבור שירותים'

      let document
      if (validated.markAsPaid) {
        // Create invoice+receipt
        document = await MorningService.createTaxInvoiceReceipt({
          clientName: payment.client.company || payment.client.name,
          clientEmail: payment.client.email || undefined,
          clientPhone: payment.client.phone || undefined,
          clientTaxId: payment.client.taxId || undefined,
          items: [{
            description,
            quantity: 1,
            price: Number(payment.amount)
          }],
          paymentType: validated.paymentType || MORNING_PAYMENT_TYPES.EFT,
          remarks: payment.notes || undefined
        })
      } else {
        // Create invoice only
        document = await MorningService.createTaxInvoice({
          clientName: payment.client.company || payment.client.name,
          clientEmail: payment.client.email || undefined,
          clientPhone: payment.client.phone || undefined,
          clientTaxId: payment.client.taxId || undefined,
          items: [{
            description,
            quantity: 1,
            price: Number(payment.amount)
          }],
          dueDate: payment.dueDate.toISOString().split('T')[0],
          remarks: payment.notes || undefined
        })
      }

      // Update payment with invoice number
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          invoiceNumber: String(document.number),
          ...(validated.markAsPaid ? {
            status: 'PAID',
            paidAt: new Date(),
            receiptNumber: String(document.number)
          } : {})
        }
      })

      // If marked as paid, update client revenue
      if (validated.markAsPaid) {
        await prisma.client.update({
          where: { id: payment.clientId },
          data: {
            totalRevenue: {
              increment: payment.amount
            }
          }
        })
      }

      return createResponse({
        success: true,
        document,
        payment: {
          id: payment.id,
          invoiceNumber: String(document.number)
        }
      }, 201)
    } else {
      // Create invoice directly
      const validated = createInvoiceDirectSchema.parse(body)

      const client = await prisma.client.findFirst({
        where: {
          id: validated.clientId,
          userId
        }
      })

      if (!client) {
        return errorResponse('לקוח לא נמצא', 404)
      }

      let project = null
      if (validated.projectId) {
        project = await prisma.project.findFirst({
          where: {
            id: validated.projectId,
            userId
          }
        })
      }

      const description = project
        ? `${project.name} - ${validated.description}`
        : validated.description

      let document
      if (validated.markAsPaid) {
        document = await MorningService.createTaxInvoiceReceipt({
          clientName: client.company || client.name,
          clientEmail: client.email || undefined,
          clientPhone: client.phone || undefined,
          clientTaxId: client.taxId || undefined,
          items: [{
            description,
            quantity: 1,
            price: validated.amount
          }],
          paymentType: validated.paymentType || MORNING_PAYMENT_TYPES.EFT
        })
      } else {
        document = await MorningService.createTaxInvoice({
          clientName: client.company || client.name,
          clientEmail: client.email || undefined,
          clientPhone: client.phone || undefined,
          clientTaxId: client.taxId || undefined,
          items: [{
            description,
            quantity: 1,
            price: validated.amount
          }]
        })
      }

      // Create payment in CRM if requested
      let payment = null
      if (validated.createPayment) {
        payment = await prisma.payment.create({
          data: {
            amount: new Prisma.Decimal(validated.amount),
            type: 'PROJECT',
            status: validated.markAsPaid ? 'PAID' : 'PENDING',
            dueDate: new Date(),
            paidAt: validated.markAsPaid ? new Date() : null,
            invoiceNumber: String(document.number),
            receiptNumber: validated.markAsPaid ? String(document.number) : null,
            notes: description,
            clientId: client.id,
            projectId: validated.projectId || null,
            userId
          }
        })

        // Update client revenue if paid
        if (validated.markAsPaid) {
          await prisma.client.update({
            where: { id: client.id },
            data: {
              totalRevenue: {
                increment: new Prisma.Decimal(validated.amount)
              }
            }
          })
        }
      }

      return createResponse({
        success: true,
        document,
        payment: payment ? {
          id: payment.id,
          invoiceNumber: String(document.number)
        } : null
      }, 201)
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to create invoice')
  }
})
