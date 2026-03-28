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
  price: z.number().optional(),
  retention: z.number().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).optional(),
  contactId: z.string().min(1, 'לקוח חובה'),
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
  price: z.number().nullable().optional(),
  retention: z.number().nullable().optional(),
  retentionFrequency: z.enum(['MONTHLY', 'YEARLY']).nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
