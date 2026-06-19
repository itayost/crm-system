import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/validations/project'

interface ProjectFilters {
  status?: string
  clientId?: string
  search?: string
}

export class ProjectsService {
  static async getAll(userId: string, filters?: ProjectFilters) {
    const where: Prisma.ProjectWhereInput = { userId }

    if (filters?.status) {
      where.status = filters.status as Prisma.EnumProjectStatusFilter
    }

    if (filters?.clientId) {
      where.clientId = filters.clientId
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
        client: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        client: true,
        primaryContact: true,
        tasks: true,
      },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }

    return project
  }

  static async create(userId: string, data: CreateProjectInput) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId },
    })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    if (data.primaryContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.primaryContactId, userId, clientId: data.clientId },
        select: { id: true },
      })
      if (!contact) {
        throw new Error('איש קשר לא נמצא')
      }
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
        clientId: data.clientId,
        primaryContactId: data.primaryContactId,
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
