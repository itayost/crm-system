import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1, 'שם פרויקט חובה'),
  description: z.string().optional(),
  type: z.enum([
    'LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP',
    'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  advanceAmount: z.number().min(0).optional(),
  retention: z.number().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
  clientId: z.string().min(1, 'לקוח חובה'),
  primaryContactId: z.string().optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum([
    'LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP',
    'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION',
  ]).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  advanceAmount: z.number().min(0).nullable().optional(),
  // true marks the advance paid now, false clears it. Kept apart from the
  // amount so recording payment is never a side effect of editing the figure.
  advancePaid: z.boolean().optional(),
  retention: z.number().nullable().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
