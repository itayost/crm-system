import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type { CreatePhaseInput, UpdatePhaseInput } from '@/lib/validations/phase'

/**
 * Billing phases on a project.
 *
 * A ProjectPhase has no userId of its own - ownership comes through the
 * project, like AgentProjectConfig - so every method starts by proving the
 * caller owns the project. Error messages are Hebrew on purpose: withAuth maps
 * a non-Hebrew Error to a 500 rather than a 400.
 */
export class PhasesService {
  private static async assertOwnsProject(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    })

    if (!project) {
      throw new Error('פרויקט לא נמצא')
    }
  }

  /** Guards against reaching another project's phase through this project's id. */
  private static async assertPhaseInProject(projectId: string, phaseId: string) {
    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    })

    if (!phase) {
      throw new Error('שלב לא נמצא')
    }

    return phase
  }

  static async listByProject(userId: string, projectId: string) {
    await this.assertOwnsProject(userId, projectId)

    return prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })
  }

  static async create(userId: string, projectId: string, data: CreatePhaseInput) {
    await this.assertOwnsProject(userId, projectId)

    const last = await prisma.projectPhase.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    return prisma.projectPhase.create({
      data: {
        name: data.name,
        price: new Prisma.Decimal(data.price),
        order: (last?.order ?? 0) + 1,
        projectId,
      },
    })
  }

  static async update(
    userId: string,
    projectId: string,
    phaseId: string,
    data: UpdatePhaseInput
  ) {
    await this.assertOwnsProject(userId, projectId)
    const phase = await this.assertPhaseInProject(projectId, phaseId)

    const updateData: Prisma.ProjectPhaseUncheckedUpdateInput = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.price !== undefined) updateData.price = new Prisma.Decimal(data.price)

    if (data.status !== undefined) {
      updateData.status = data.status
      // approvedAt tracks the sign-off, so it follows the status both ways.
      // paidAt deliberately does not: money that arrived does not un-arrive
      // because the phase went back for another round of revisions.
      if (data.status === 'APPROVED') {
        updateData.approvedAt = phase.approvedAt ?? new Date()
      } else {
        updateData.approvedAt = null
      }
    }

    if (data.paid !== undefined) {
      updateData.paidAt = data.paid ? (phase.paidAt ?? new Date()) : null
    }

    return prisma.projectPhase.update({ where: { id: phaseId }, data: updateData })
  }

  /**
   * Swaps a phase with its neighbour. A no-op at the ends rather than an error:
   * the buttons are disabled there, so reaching this is a double-click, not a
   * mistake worth a toast.
   */
  static async move(userId: string, projectId: string, phaseId: string, direction: 'UP' | 'DOWN') {
    await this.assertOwnsProject(userId, projectId)
    const phase = await this.assertPhaseInProject(projectId, phaseId)

    const neighbour = await prisma.projectPhase.findFirst({
      where: {
        projectId,
        order: direction === 'UP' ? { lt: phase.order } : { gt: phase.order },
      },
      orderBy: { order: direction === 'UP' ? 'desc' : 'asc' },
    })

    if (neighbour) {
      await prisma.$transaction([
        prisma.projectPhase.update({ where: { id: phase.id }, data: { order: neighbour.order } }),
        prisma.projectPhase.update({ where: { id: neighbour.id }, data: { order: phase.order } }),
      ])
    }

    return this.listByProject(userId, projectId)
  }

  static async delete(userId: string, projectId: string, phaseId: string) {
    await this.assertOwnsProject(userId, projectId)
    await this.assertPhaseInProject(projectId, phaseId)

    await prisma.$transaction(async (tx) => {
      await tx.projectPhase.delete({ where: { id: phaseId } })

      // Renumber 1..n so the gap does not accumulate and "order" stays
      // meaningful for the move-swap above.
      const remaining = await tx.projectPhase.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: { id: true },
      })

      for (const [index, row] of remaining.entries()) {
        await tx.projectPhase.update({ where: { id: row.id }, data: { order: index + 1 } })
      }
    })
  }
}
