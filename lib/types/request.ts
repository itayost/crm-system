import type { z } from 'zod'
import type {
  requestType,
  requestStatus,
  requestSource,
  priority,
  requestBilling,
  clientDecision,
} from '@/lib/validations/enums'
import type { Intake } from '@/lib/validations/intake'

/**
 * The Request as the dashboard receives it over the wire: dates are ISO
 * strings, intake is already-parsed JSON, and the thin relations mirror
 * REQUEST_INCLUDE in requests.service.ts.
 *
 * Pages that need less narrow with Pick<RequestRecord, ...> instead of
 * declaring another local shape - four of those drifted apart once already.
 */

export type RequestType = z.infer<typeof requestType>
export type RequestStatus = z.infer<typeof requestStatus>
export type RequestSource = z.infer<typeof requestSource>
export type RequestPriority = z.infer<typeof priority>
export type RequestBilling = z.infer<typeof requestBilling>
export type ClientDecision = z.infer<typeof clientDecision>

export interface RequestRecord {
  id: string
  title: string
  description: string | null
  type: RequestType
  status: RequestStatus
  priority: RequestPriority
  source: RequestSource
  isAiGenerated: boolean
  aiConfidence: number | null
  aiNote: string | null
  attachments: string[]
  intake: Intake | null
  clientId: string
  contactId: string | null
  projectId: string | null
  taskId: string | null
  sourceMessageId: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string

  /**
   * The commercial layer. Decimals arrive as strings over JSON, which is why
   * these are not numbers - pass them through formatCurrency rather than
   * arithmetic, or Number() them once at the edge.
   */
  billingKind: RequestBilling | null
  estimateHours: string | null
  quotedPrice: string | null
  quotedAt: string | null
  clientDecision: ClientDecision | null
  clientDecisionAt: string | null
  clientDecisionNote: string | null
  phaseId: string | null

  client: { id: string; name: string } | null
  contact: { id: string; name: string } | null
  project: { id: string; name: string } | null
  task: { id: string; title: string; status: string } | null
}
