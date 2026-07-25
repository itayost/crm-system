import { z } from 'zod'

export const requestType = z.enum(['REQUEST', 'BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER'])
const requestStatus = z.enum([
  'PENDING_REVIEW',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'DISMISSED',
])
export const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
const requestSource = z.enum(['WHATSAPP', 'MANUAL', 'EMAIL', 'FORM', 'OTHER'])

export const createRequestSchema = z.object({
  title: z.string().min(1, 'כותרת בקשה חובה'),
  description: z.string().optional(),
  type: requestType.optional(),
  priority: priority.optional(),
  source: requestSource.optional(),
  clientId: z.string().min(1, 'לקוח חובה'),
  contactId: z.string().optional(),
  projectId: z.string().optional(),
})

export const updateRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: requestType.optional(),
  status: requestStatus.optional(),
  priority: priority.optional(),
  contactId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
})

// One AI-drafted request produced by the extraction pass
export const draftRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: requestType.optional(),
  priority: priority.optional(),
  clientId: z.string().min(1),
  contactId: z.string().optional(),
  projectId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiNote: z.string().optional(),
  attachments: z.array(z.string()).optional(),
})

export const bulkDraftRequestsSchema = z.array(draftRequestSchema)

export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>
export type DraftRequestInput = z.infer<typeof draftRequestSchema>
export type BulkDraftRequestsInput = z.infer<typeof bulkDraftRequestsSchema>
