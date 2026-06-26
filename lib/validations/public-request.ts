import { z } from 'zod'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

export const publicRequestSchema = z.object({
  token: z.string().min(1),
  type: z.enum(['BUG', 'REQUEST', 'QUESTION', 'OTHER']).optional(),
  title: z.string().min(1, 'כותרת חובה'),
  description: z.string().min(1, 'תיאור חובה'),
  projectId: z.string().optional(),
  reporterName: z.string().optional(),
  reporterPhone: z
    .string()
    .regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  reporterEmail: z
    .string()
    .email('אימייל לא תקין')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
})

export type PublicRequestInput = z.infer<typeof publicRequestSchema>
