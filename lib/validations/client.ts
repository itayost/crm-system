import { z } from 'zod'

export const createClientSchema = z.object({
  name: z.string().min(1, 'שם עסק חובה'),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  isInternal: z.boolean().optional(),
})

export const updateClientSchema = createClientSchema.partial()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
