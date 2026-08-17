import type { z } from 'zod'
import type { phaseStatus } from '@/lib/validations/enums'

/**
 * The Project as the dashboard receives it: ISO date strings, and Decimals
 * that JSON has turned into strings.
 *
 * Four files had each declared their own Project shape, and moving money from
 * `price` onto phases would have needed the identical edit in all four. Same
 * reasoning as lib/types/request.ts. Narrow with Pick<> rather than
 * redeclaring.
 */

export type PhaseStatus = z.infer<typeof phaseStatus>

export interface ProjectPhase {
  id: string
  name: string
  order: number
  status: PhaseStatus
  price: number | string
  approvedAt: string | null
  paidAt: string | null
}

/** What list views need to show a project's money without loading every phase. */
export interface PhaseSummary {
  price: number | string
  status: PhaseStatus
  paidAt: string | null
  /**
   * Present on the list payloads, which name the current phase. Optional
   * because the money helpers only ever need price/status/paidAt, and several
   * callers build a PhaseSummary from exactly those three.
   */
  name?: string
  order?: number
}

export interface ProjectTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
}

export interface ProjectRecord {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  priority: string
  startDate: string | null
  deadline: string | null
  completedAt: string | null
  advanceAmount: number | string | null
  advancePaidAt: string | null
  retention: number | string | null
  retentionFrequency: string | null
  clientId: string
  client: { id: string; name: string } | null
  primaryContactId: string | null
  primaryContact: { id: string; name: string } | null
  phases: ProjectPhase[]
  tasks: ProjectTask[]
  createdAt: string
}

/** The projects table: money summarised, tasks counted rather than listed. */
export type ProjectListItem = Pick<
  ProjectRecord,
  'id' | 'name' | 'type' | 'status' | 'priority' | 'deadline' | 'advanceAmount' | 'advancePaidAt' | 'client'
> & {
  phases: PhaseSummary[]
  _count: { tasks: number }
}
