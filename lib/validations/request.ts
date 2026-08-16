import { z } from 'zod'
import { intakeSchema } from './intake'
import {
  requestType,
  requestStatus,
  requestSource,
  priority,
  requestBilling,
  clientDecision,
} from './enums'

// Re-exported so existing importers keep working; defined in ./enums to avoid a
// cycle with ./intake.
export {
  requestType,
  requestStatus,
  requestSource,
  priority,
  requestBilling,
  clientDecision,
} from './enums'

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

/**
 * Sending a quote is a transition, not a field edit.
 *
 * Deliberately absent from updateRequestSchema above: pricing has guards of its
 * own (a billable request needs a project to hang its phase on) and, once the
 * client has answered, the price they agreed to must not be quietly editable
 * through the generic update route.
 */
export const sendQuoteSchema = z.object({
  billingKind: requestBilling,
  estimateHours: z.coerce.number().positive().max(999).optional(),
  quotedPrice: z.coerce.number().nonnegative().max(9_999_999).optional(),
})

/** What the portal posts back. The note is the client's own words on a decline. */
export const clientDecisionSchema = z.object({
  decision: clientDecision,
  note: z.string().max(1000).optional(),
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
export type SendQuoteInput = z.infer<typeof sendQuoteSchema>
export type ClientDecisionInput = z.infer<typeof clientDecisionSchema>
export type DraftRequestInput = z.infer<typeof draftRequestSchema>
export type BulkDraftRequestsInput = z.infer<typeof bulkDraftRequestsSchema>
