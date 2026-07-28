import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validations/task'

interface TaskFilters {
  status?: string
  category?: string
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

    if (filters?.category) {
      where.category = filters.category as Prisma.EnumTaskCategoryFilter
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
        request: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getById(userId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: {
        project: {
          include: { client: true, primaryContact: true },
        },
        request: { select: { id: true, title: true } },
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
        category: data.category ?? 'CLIENT_WORK',
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
      category: data.category,
      dueDate: data.dueDate !== undefined
        ? (data.dueDate ? new Date(data.dueDate) : null)
        : undefined,
      project: data.projectId !== undefined
        ? (data.projectId ? { connect: { id: data.projectId } } : { disconnect: true })
        : undefined,
    }

    if (data.status === 'COMPLETED' && !task.completedAt) {
      updateData.completedAt = new Date()
    } else if (data.status && data.status !== 'COMPLETED' && task.completedAt) {
      // Reopening a task must drop the completion stamp, or it reads as finished
      // in every report while sitting in the TODO column.
      updateData.completedAt = null
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
