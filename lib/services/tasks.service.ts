import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validations/task'

interface TaskFilters {
  status?: string
  projectId?: string
  standalone?: boolean
  search?: string
}

export class TasksService {
  static async getAll(userId: string, filters?: TaskFilters) {
    const where: Prisma.TaskWhereInput = { userId }

    if (filters?.status) {
      where.status = filters.status as Prisma.EnumTaskStatusFilter
    }

    if (filters?.projectId) {
      where.projectId = filters.projectId
    }

    if (filters?.standalone) {
      where.projectId = null
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: {
        project: {
          include: { contact: true },
        },
      },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    return task
  }

  static async create(userId: string, data: CreateTaskInput) {
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
      })

      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }
    }

    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        projectId: data.projectId || undefined,
        userId,
      },
    })
  }

  static async update(userId: string, id: string, data: UpdateTaskInput) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId },
      })

      if (!project) {
        throw new Error('פרויקט לא נמצא')
      }
    }

    const updateData: Prisma.TaskUpdateInput = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate !== undefined
        ? (data.dueDate ? new Date(data.dueDate) : null)
        : undefined,
      project: data.projectId !== undefined
        ? (data.projectId ? { connect: { id: data.projectId } } : { disconnect: true })
        : undefined,
    }

    if (data.status === 'COMPLETED' && !task.completedAt) {
      updateData.completedAt = new Date()
    }

    return prisma.task.update({
      where: { id },
      data: updateData,
    })
  }

  static async delete(userId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
    })

    if (!task) {
      throw new Error('משימה לא נמצאה')
    }

    return prisma.task.delete({ where: { id } })
  }
}
