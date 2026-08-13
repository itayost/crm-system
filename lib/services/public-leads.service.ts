import { Prisma, type ContactSource } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { normalizePhone } from '@/lib/services/whatsapp-identity'
import { formatDate } from '@/lib/utils'

/**
 * A lead arriving from the website form.
 *
 * One phone, one contact. The form used to create a row per submission, which
 * is how five identical leads landed in the list in six seconds, and how a
 * returning client became a second NEW lead shadowing their own record.
 *
 * Three outcomes:
 * - CREATED  nobody in the CRM has this number yet
 * - MERGED   someone does, and this submission says something new: it is
 *            appended to their notes and any blank field it fills is filled
 * - DUPLICATE the same payload again within the window: no write, no WhatsApp
 *
 * DUPLICATE is deliberately narrow. It needs the same name and nothing new in
 * any other field, so a second submission that actually adds something (the
 * email they forgot) still reaches Itay instead of being swallowed as a retry.
 */

/** How long an identical resubmission counts as the same submission. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

export interface LeadSubmission {
  name: string
  phone: string
  email?: string
  company?: string
  source?: ContactSource
  estimatedBudget?: number
  projectType?: string
  notes?: string
}

export type LeadOutcome = 'CREATED' | 'MERGED' | 'DUPLICATE'

export interface LeadContact {
  id: string
  name: string
  phone: string
}

export interface LeadResult {
  outcome: LeadOutcome
  contact: LeadContact
}

const MATCH_FIELDS = {
  id: true,
  name: true,
  phone: true,
  email: true,
  company: true,
  projectType: true,
  estimatedBudget: true,
  notes: true,
  updatedAt: true,
} as const

type ExistingContact = Prisma.ContactGetPayload<{ select: typeof MATCH_FIELDS }>

export class PublicLeadsService {
  static async submit(
    ownerId: string,
    input: LeadSubmission,
    now: Date = new Date()
  ): Promise<LeadResult> {
    const phone = normalizePhone(input.phone) || input.phone.trim()

    // Stored numbers predate normalisation, so match the raw form too: an older
    // row saved as 054-499-4417 must still be recognised as the same person.
    const candidates = Array.from(new Set([phone, input.phone.trim()]))

    const existing = await prisma.contact.findFirst({
      where: { userId: ownerId, phone: { in: candidates } },
      orderBy: { createdAt: 'desc' },
      select: MATCH_FIELDS,
    })

    if (!existing) {
      const created = await prisma.contact.create({
        data: {
          name: input.name,
          email: input.email,
          phone,
          company: input.company,
          source: input.source ?? 'WEBSITE',
          estimatedBudget: budgetOf(input.estimatedBudget),
          projectType: input.projectType,
          notes: input.notes,
          status: 'NEW',
          userId: ownerId,
        },
        select: { id: true, name: true, phone: true },
      })

      return { outcome: 'CREATED', contact: created }
    }

    if (isRepeatOf(existing, input, now.getTime() - DUPLICATE_WINDOW_MS)) {
      return {
        outcome: 'DUPLICATE',
        contact: { id: existing.id, name: existing.name, phone: existing.phone },
      }
    }

    const merged = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        // Status, name and pipeline fields are left alone: a client who fills
        // the form again is still a client, not a fresh lead.
        notes: appendSubmission(existing.notes, input, now),
        email: existing.email ?? input.email,
        company: existing.company ?? input.company,
        projectType: existing.projectType ?? input.projectType,
        estimatedBudget: existing.estimatedBudget ?? budgetOf(input.estimatedBudget),
      },
      select: { id: true, name: true, phone: true },
    })

    return { outcome: 'MERGED', contact: merged }
  }
}

function budgetOf(amount: number | undefined): Prisma.Decimal | undefined {
  return amount != null ? new Prisma.Decimal(amount) : undefined
}

/**
 * Is this submission the one we already have, sent again?
 *
 * Compared against updatedAt rather than createdAt so a merge also starts the
 * window: three identical submissions produce one row and one notification,
 * whether the first of them created the contact or merged into it.
 */
function isRepeatOf(
  existing: ExistingContact,
  input: LeadSubmission,
  windowStart: number
): boolean {
  if (existing.updatedAt.getTime() < windowStart) return false
  if (existing.name !== input.name) return false
  if (input.email && existing.email !== input.email) return false
  if (input.company && existing.company !== input.company) return false
  if (input.projectType && existing.projectType !== input.projectType) return false

  if (input.estimatedBudget != null) {
    if (existing.estimatedBudget == null) return false
    if (!new Prisma.Decimal(input.estimatedBudget).equals(existing.estimatedBudget)) return false
  }

  // The note is appended verbatim on both paths, so containment covers a
  // contact that was created with this text and one that was merged into.
  if (input.notes && !(existing.notes ?? '').includes(input.notes)) return false

  return true
}

function appendSubmission(
  existingNotes: string | null,
  input: LeadSubmission,
  now: Date
): string {
  const lines = [`[${formatDate(now)}] טופס מהאתר`, `שם: ${input.name}`]

  if (input.email) lines.push(`אימייל: ${input.email}`)
  if (input.company) lines.push(`חברה: ${input.company}`)
  if (input.projectType) lines.push(`סוג פרויקט: ${input.projectType}`)
  if (input.estimatedBudget != null) lines.push(`תקציב משוער: ${input.estimatedBudget}`)
  if (input.notes) lines.push(`הודעה: ${input.notes}`)

  const entry = lines.join('\n')

  return existingNotes ? `${existingNotes}\n\n${entry}` : entry
}
