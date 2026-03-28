import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/validations/project'

interface ProjectFilters {
  status?: string
  contactId?: string
  search?: string
}

export class ProjectsService {
  static async getAll(userId: string, filters?: ProjectFilters) {
    const where: Prisma.ProjectWhereInput = { userId }

    if (filters?.status) {
      where.status = filters.status as Prisma.EnumProjectStatusFilter
    }

    if (filters?.contactId) {
      where.contactId = filters.contactId
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.project.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, company: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        contact: true,
        tasks: true,
      },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    return project
  }

  static async create(userId: string, data: CreateProjectInput) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, userId },
    })

    if (!contact) {
      throw new Error('איש קשר לא נמצא')
    }

    if (contact.status !== 'CLIENT') {
      throw new Error('ניתן ליצור פרויקט רק עבור לקוח פעיל')
    }

    return prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        priority: data.priority,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        price: data.price != null ? new Prisma.Decimal(data.price) : undefined,
        retention: data.retention != null ? new Prisma.Decimal(data.retention) : undefined,
        retentionFrequency: data.retentionFrequency,
        contactId: data.contactId,
        userId,
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateProjectInput) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    const updateData: Prisma.ProjectUpdateInput = {
      name: data.name,
      description: data.description,
      type: data.type,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate !== undefined
        ? (data.startDate ? new Date(data.startDate) : null)
        : undefined,
      deadline: data.deadline !== undefined
        ? (data.deadline ? new Date(data.deadline) : null)
        : undefined,
      price: data.price !== undefined
        ? (data.price != null ? new Prisma.Decimal(data.price) : null)
        : undefined,
      retention: data.retention !== undefined
        ? (data.retention != null ? new Prisma.Decimal(data.retention) : null)
        : undefined,
      retentionFrequency: data.retentionFrequency,
    }

    if (data.status === 'COMPLETED' && !project.completedAt) {
      updateData.completedAt = new Date()
    } else if (data.status === 'ACTIVE') {
      updateData.completedAt = null
    }

    return prisma.project.update({
      where: { id },
      data: updateData,
    })
  }

  static async delete(userId: string, id: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: { _count: { select: { tasks: true } } },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    if (project._count.tasks > 0) {
      throw new Error('לא ניתן למחוק פרויקט שיש לו משימות')
    }

    return prisma.project.delete({ where: { id } })
  }
}
