import { z } from 'zod'
import { intakeSchema } from './intake'
import { requestType, requestStatus, requestSource, priority } from './enums'

// Re-exported so existing importers keep working; defined in ./enums to avoid a
// cycle with ./intake.
export { requestType, requestStatus, requestSource, priority } from './enums'

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
  // A full intake object only - never null. Omitting it leaves the stored
  // intake untouched, so the dashboard can't accidentally wipe what the
  // support agent collected.
  intake: intakeSchema.optional(),
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
  intake: intakeSchema.nullable().optional(),
})

export const bulkDraftRequestsSchema = z.array(draftRequestSchema)

export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>
export type DraftRequestInput = z.infer<typeof draftRequestSchema>
export type BulkDraftRequestsInput = z.infer<typeof bulkDraftRequestsSchema>
