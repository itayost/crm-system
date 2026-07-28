import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateClientInput, UpdateClientInput } from '@/lib/validations/client'

interface ClientFilters {
  search?: string
  isVip?: boolean
}

interface ConvertOverrides {
  name?: string
  role?: string
}

export class ClientsService {
  static async getAll(userId: string, filters?: ClientFilters) {
    const where: Prisma.ClientWhereInput = { userId }

    if (filters?.isVip !== undefined) {
      where.isVip = filters.isVip
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { taxId: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.client.findMany({
      where,
      include: { _count: { select: { contacts: true, projects: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const client = await prisma.client.findFirst({
      where: { id, userId },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        projects: {
          include: { _count: { select: { tasks: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    return client
  }

  static async create(userId: string, data: CreateClientInput) {
    return prisma.client.create({
      data: { ...data, userId },
    })
  }

  static async update(userId: string, id: string, data: UpdateClientInput) {
    const client = await prisma.client.findFirst({ where: { id, userId } })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    return prisma.client.update({ where: { id }, data })
  }

  static async delete(userId: string, id: string) {
    const client = await prisma.client.findFirst({
      where: { id, userId },
      include: { _count: { select: { projects: true } } },
    })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    if (client._count.projects > 0) {
      throw new Error('לא ניתן למחוק לקוח שיש לו פרויקטים')
    }

    // One transaction: a failure between the two writes would leave the contacts
    // detached from a business that still exists, with primary status lost.
    return prisma.$transaction(async (tx) => {
      await tx.contact.updateMany({
        where: { clientId: id },
        data: { clientId: null, isPrimary: false },
      })

      return tx.client.delete({ where: { id } })
    })
  }

  /**
   * Convert a Contact (lead) into a Client (business), linking the contact as the
   * primary person. Idempotent: if the contact already belongs to a client, returns it.
   */
  static async convertContactToClient(
    userId: string,
    contactId: string,
    overrides?: ConvertOverrides
  ) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact.clientId) {
      return prisma.client.findFirst({ where: { id: contact.clientId, userId } })
    }

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: overrides?.name ?? contact.company ?? contact.name,
          isVip: contact.isVip,
          address: contact.address,
          taxId: contact.taxId,
          notes: contact.notes,
          userId,
        },
      })

      await tx.contact.update({
        where: { id: contactId },
        data: {
          status: 'CLIENT',
          convertedAt: contact.convertedAt ?? new Date(),
          clientId: client.id,
          isPrimary: true,
          role: overrides?.role ?? contact.role ?? 'בעלים',
          // The lead was won; whatever was owed to it next no longer is.
          nextActionAt: null,
          nextActionNote: null,
        },
      })

      return client
    })
  }

  static async regenerateFormToken(userId: string, id: string) {
    const client = await prisma.client.findFirst({ where: { id, userId } })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { formToken: crypto.randomUUID() },
      select: { formToken: true },
    })

    if (!updated.formToken) {
      throw new Error('כישלון בשמירת הטוקן')
    }

    return { formToken: updated.formToken }
  }

  static async getMessages(userId: string, clientId: string, days = 30) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true },
    })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    const since = new Date()
    since.setDate(since.getDate() - days)

    return prisma.whatsAppMessage.findMany({
      where: { contact: { clientId }, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      take: 200,
      include: { contact: { select: { id: true, name: true } } },
    })
  }
}
