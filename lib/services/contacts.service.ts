import { prisma } from '@/lib/db/prisma'
import { Prisma, type ContactStatus } from '@prisma/client'
import type { CreateContactInput, UpdateContactInput } from '@/lib/validations/contact'
import { ClientsService } from './clients.service'
import { LEAD_STATUSES, CLIENT_STATUSES, TERMINAL_CONTACT_STATUSES } from '@/lib/validations/enums'

interface ContactFilters {
  status?: string
  source?: string
  phase?: 'lead' | 'client'
  clientId?: string
  search?: string
}

export class ContactsService {
  static async getAll(userId: string, filters?: ContactFilters) {
    const where: Prisma.ContactWhereInput = { userId }

    // `phase` narrows to the pipeline or to the client roster; `status` picks a
    // single stage. Both used to be written to `where.status`, so passing them
    // together silently dropped the status - phase just overwrote it.
    const phaseStatuses: readonly ContactStatus[] | null =
      filters?.phase === 'lead'
        ? LEAD_STATUSES
        : filters?.phase === 'client'
          ? CLIENT_STATUSES
          : null

    if (filters?.status) {
      const status = filters.status as ContactStatus
      // A status outside the requested phase describes an empty set. Returning
      // it is more honest than quietly ignoring one of the two filters.
      if (phaseStatuses && !phaseStatuses.includes(status)) return []
      where.status = status
    } else if (phaseStatuses) {
      where.status = { in: [...phaseStatuses] }
    }

    if (filters?.source) {
      where.source = filters.source as Prisma.EnumContactSourceFilter
    }

    if (filters?.clientId) {
      where.clientId = filters.clientId
    }

    if (filters?.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search, mode: 'insensitive' } },
            { company: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    return prisma.contact.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { projects: true } },
      },
      // The leads list is a worklist, so it sorts by what is owed soonest and
      // puts leads with nothing scheduled at the bottom. Everywhere else,
      // newest first is still the useful order.
      orderBy:
        filters?.phase === 'lead'
          ? [{ nextActionAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
          : { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: {
        client: {
          include: {
            projects: {
              include: {
                tasks: true,
                phases: { select: { price: true, status: true, paidAt: true } },
              },
            },
          },
        },
      },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    return contact
  }

  /**
   * A caller-supplied clientId is a foreign key into another aggregate, so it is
   * only accepted when that Client belongs to the same owner. Without this a
   * contact could be attached to someone else's business and then read back
   * together with that business's projects and tasks.
   */
  private static async assertOwnsClient(userId: string, clientId?: string | null) {
    if (!clientId) return

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true },
    })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }
  }

  static async create(userId: string, data: CreateContactInput) {
    await this.assertOwnsClient(userId, data.clientId)

    return prisma.contact.create({
      data: {
        ...data,
        // Someone attached to an existing business is not a lead - nobody is
        // going to sell to the bookkeeper. Derived here rather than in the
        // schema default so the form, the API and the WhatsApp agent all get
        // it, and left convertedAt-less because that field means "was once a
        // lead we won", which this contact never was.
        status: data.clientId ? 'CLIENT' : undefined,
        estimatedBudget: data.estimatedBudget != null
          ? new Prisma.Decimal(data.estimatedBudget)
          : undefined,
        nextActionAt: data.nextActionAt ? new Date(data.nextActionAt) : undefined,
        userId,
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateContactInput) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: { client: { select: { projects: { select: { status: true } } } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    await this.assertOwnsClient(userId, data.clientId)

    if (data.status === 'INACTIVE') {
      const hasActiveProjects =
        contact.client?.projects.some((p) => p.status === 'ACTIVE') ?? false
      if (hasActiveProjects) {
        throw new Error('לא ניתן להפוך ללא פעיל כשיש פרויקטים פעילים')
      }
    }

    // First time a contact becomes a CLIENT, spin up its Client (business).
    let justConverted = false
    if (data.status === 'CLIENT' && !contact.clientId) {
      await ClientsService.convertContactToClient(userId, id)
      justConverted = true
    }

    const updateData: Prisma.ContactUncheckedUpdateInput = {
      ...data,
      estimatedBudget: data.estimatedBudget != null
        ? new Prisma.Decimal(data.estimatedBudget)
        : data.estimatedBudget,
      // Tri-state: a date sets it, null clears it, undefined leaves it alone.
      nextActionAt:
        data.nextActionAt !== undefined
          ? (data.nextActionAt ? new Date(data.nextActionAt) : null)
          : undefined,
    }

    if (data.status === 'CLIENT' && !contact.convertedAt && !justConverted) {
      updateData.convertedAt = new Date()
    }

    // Won, lost, or gone quiet - there is nothing left to chase, so a stale
    // "call them Thursday" should not keep surfacing in the morning brief.
    // Skipped when the caller set a next action in the same request.
    const isTerminal =
      data.status != null &&
      (TERMINAL_CONTACT_STATUSES as readonly string[]).includes(data.status)
    if (isTerminal && data.nextActionAt === undefined && data.nextActionNote === undefined) {
      updateData.nextActionAt = null
      updateData.nextActionNote = null
    }

    return prisma.contact.update({
      where: { id },
      data: updateData,
    })
  }

  static async delete(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: { client: { select: { _count: { select: { projects: true } } } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact.isPrimary && (contact.client?._count.projects ?? 0) > 0) {
      throw new Error('לא ניתן למחוק איש קשר ראשי של לקוח שיש לו פרויקטים')
    }

    return prisma.contact.delete({ where: { id } })
  }
}
