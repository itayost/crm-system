import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateContactInput, UpdateContactInput } from '@/lib/validations/contact'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] as const
const CLIENT_STATUSES = ['CLIENT', 'INACTIVE'] as const

interface ContactFilters {
  status?: string
  source?: string
  phase?: 'lead' | 'client'
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
      include: { projects: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, userId },
      include: {
        projects: {
          include: { tasks: true },
        },
      },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    return contact
  }

  static async create(userId: string, data: CreateContactInput) {
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
      include: { projects: { select: { status: true } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (data.status === 'INACTIVE') {
      const hasActiveProjects = contact.projects.some(
        (p) => p.status === 'ACTIVE'
      )
      if (hasActiveProjects) {
        throw new Error('לא ניתן להפוך ללא פעיל כשיש פרויקטים פעילים')
      }
    }

    const updateData: Prisma.ContactUpdateInput = {
      ...data,
      estimatedBudget: data.estimatedBudget != null
        ? new Prisma.Decimal(data.estimatedBudget)
        : data.estimatedBudget,
    }

    if (data.status === 'CLIENT' && !contact.convertedAt) {
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
      include: { _count: { select: { projects: true } } },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact._count.projects > 0) {
      throw new Error('לא ניתן למחוק איש קשר שיש לו פרויקטים')
    }

    return prisma.contact.delete({ where: { id } })
  }
}
