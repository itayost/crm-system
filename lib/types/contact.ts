import type { z } from 'zod'
import type { contactStatus, contactSource } from '@/lib/validations/enums'

/**
 * The Contact as the dashboard receives it over the wire: dates are ISO
 * strings and Decimals are strings, because that is what JSON does to them.
 *
 * Same reasoning as lib/types/request.ts - three files had each declared their
 * own Contact shape, and the pipeline remodel would have needed the identical
 * edit in all three. Pages that need less narrow with Pick<ContactRecord, ...>.
 */

export type ContactStatus = z.infer<typeof contactStatus>
export type ContactSource = z.infer<typeof contactSource>

/** The thin project shape a contact page shows through its client. */
export interface ContactProject {
  id: string
  name: string
  type: string
  status: string
  deadline: string | null
  price: number | string | null
}

export interface ContactRecord {
  id: string
  name: string
  phone: string
  email: string | null
  company: string | null
  status: ContactStatus
  source: ContactSource
  estimatedBudget: number | string | null
  projectType: string | null
  isVip: boolean
  address: string | null
  taxId: string | null
  notes: string | null
  nextActionAt: string | null
  nextActionNote: string | null
  convertedAt: string | null
  lastContactedAt: string | null
  role: string | null
  isPrimary: boolean
  clientId: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; projects: ContactProject[] } | null
  _count?: { projects: number }
}

/** The columns the contacts list actually renders. */
export type ContactListItem = Pick<
  ContactRecord,
  'id' | 'name' | 'phone' | 'email' | 'company' | 'status' | 'source' | 'nextActionAt' | 'nextActionNote' | 'createdAt'
>
