import { z } from 'zod'

export const createClientSchema = z.object({
  name: z.string().min(1, 'שם עסק חובה'),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  // What the support bot may know about this client - and may therefore say.
  // `notes` above stays owner-private and never reaches a prompt.
  profileHe: z.string().max(4000, 'הפרופיל ארוך מדי').nullable().optional(),
  isInternal: z.boolean().optional(),
})

export const updateClientSchema = createClientSchema.partial()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
