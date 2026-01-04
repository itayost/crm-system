// app/api/morning/retainers/[id]/route.ts
import { z } from 'zod'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { MorningService } from '@/lib/services/morning.service'

const updateRetainerSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  frequency: z.number().min(1).max(12).optional(),
  endDate: z.string().optional(),
  action: z.enum(['pause', 'resume', 'cancel']).optional()
})

// GET /api/morning/retainers/[id] - Get a single retainer
export const GET = withAuth(async (
  _req,
  { params }
) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { id } = await params
    const retainer = await MorningService.getRetainer(id)

    return createResponse(retainer)
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to fetch retainer')
  }
})

// PUT /api/morning/retainers/[id] - Update a retainer
export const PUT = withAuth(async (
  req,
  { params }
) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { id } = await params
    const body = await req.json()
    const validated = updateRetainerSchema.parse(body)

    let retainer

    // Handle action-based updates
    if (validated.action) {
      switch (validated.action) {
        case 'pause':
          retainer = await MorningService.pauseRetainer(id)
          break
        case 'resume':
          retainer = await MorningService.resumeRetainer(id)
          break
        case 'cancel':
          retainer = await MorningService.cancelRetainer(id)
          break
      }
    } else {
      // Handle regular field updates
      retainer = await MorningService.updateRetainer(id, {
        amount: validated.amount,
        description: validated.description,
        frequency: validated.frequency,
        endDate: validated.endDate
      })
    }

    return createResponse(retainer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    return errorResponse((error as Error).message || 'Failed to update retainer')
  }
})

// DELETE /api/morning/retainers/[id] - Cancel a retainer
export const DELETE = withAuth(async (
  _req,
  { params }
) => {
  try {
    if (!MorningService.isEnabled()) {
      return errorResponse('אינטגרציית Morning אינה מופעלת', 400)
    }

    const { id } = await params
    const retainer = await MorningService.cancelRetainer(id)

    return createResponse({
      success: true,
      message: 'הריטיינר בוטל בהצלחה',
      retainer
    })
  } catch (error) {
    return errorResponse((error as Error).message || 'Failed to cancel retainer')
  }
})
