import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateContactInput, UpdateContactInput } from '@/lib/validations/contact'
import { ClientsService } from './clients.service'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] as const
const CLIENT_STATUSES = ['CLIENT', 'INACTIVE'] as const

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

    if (filters?.status) {
      where.status = filters.status as Prisma.EnumContactStatusFilter
    }

    if (filters?.source) {
      where.source = filters.source as Prisma.EnumContactSourceFilter
    }

    if (filters?.phase === 'lead') {
      where.status = { in: [...LEAD_STATUSES] }
    } else if (filters?.phase === 'client') {
      where.status = { in: [...CLIENT_STATUSES] }
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
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: {
        client: {
          include: {
            projects: { include: { tasks: true } },
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
        estimatedBudget: data.estimatedBudget != null
          ? new Prisma.Decimal(data.estimatedBudget)
          : undefined,
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
    }

    if (data.status === 'CLIENT' && !contact.convertedAt && !justConverted) {
      updateData.convertedAt = new Date()
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
