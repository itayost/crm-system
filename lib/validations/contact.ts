import { z } from 'zod'
import { contactStatus, contactSource } from './enums'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

/**
 * There is deliberately no `status` on create. Whether a new contact is a lead
 * or a client is not the caller's to decide - it follows from whether they were
 * attached to a business, and ContactsService.create derives it. Letting the
 * form, the API and the WhatsApp agent each answer that question separately is
 * how a bookkeeper added to an existing client ended up in the לידים tab.
 */
export const createContactSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string().min(9, 'טלפון חובה').regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  company: z.string().optional(),
  source: contactSource,
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
  clientId: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
  nextActionAt: z.string().datetime().optional(),
  nextActionNote: z.string().optional(),
})

export const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string().regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין').optional(),
  company: z.string().optional(),
  status: contactStatus.optional(),
  source: contactSource.optional(),
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  isVip: z.boolean().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
  // null unlinks the contact from its business; undefined leaves it alone
  clientId: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  // Same tri-state: null clears the next action, undefined leaves it alone.
  nextActionAt: z.string().datetime().nullable().optional(),
  nextActionNote: z.string().nullable().optional(),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
