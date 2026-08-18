import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import type {
  CreatePhaseInput,
  PhaseReviewInput,
  UpdatePhaseInput,
} from '@/lib/validations/phase'
import { phaseReviewOwnerNotice } from '@/lib/services/whatsapp-messages'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

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
   * The client signs off delivered work, or asks for another round.
   *
   * The only method on this class scoped by a token instead of a userId,
   * because the caller is the client. Same shape as
   * RequestsService.recordClientDecision, and same invariant: the phase is
   * reached through `project.client.formToken`, never by id alone, so a caller
   * can pass any phase id they like and still only ever touch their own.
   *
   * This moves money. An APPROVED phase with no paidAt is what
   * projectOutstanding() counts as an invoice worth chasing, so the moment a
   * client presses approve the amount leaves "not yet due" and appears in
   * Itay's dashboard and morning brief. That is the correct meaning - the
   * schema has always described approvedAt as the sign-off - and it is why the
   * portal says so above the button rather than after it.
   *
   * Only PENDING_APPROVAL is answerable. REVISIONS means Itay is mid-round and
   * the ball is on his side; NOT_STARTED and IN_PROGRESS are not delivered yet.
   */
  static async recordClientReview(
    token: string,
    phaseId: string,
    input: PhaseReviewInput,
  ): Promise<{ alreadyReviewed: boolean; status: string }> {
    if (!token?.trim()) {
      throw new Error('קישור לא תקין')
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, project: { client: { formToken: token } } },
      select: {
        id: true,
        name: true,
        status: true,
        price: true,
        project: { select: { name: true, userId: true, client: { select: { name: true } } } },
      },
    })

    // Identical for "not yours" and "does not exist", so the message cannot be
    // used to probe which phase ids are real.
    if (!phase) {
      throw new Error('שלב לא נמצא')
    }

    // Not an error. A double-tap on a phone is the expected case, and so is
    // answering a link twice from two devices.
    if (phase.status !== 'PENDING_APPROVAL') {
      return { alreadyReviewed: true, status: phase.status }
    }

    const approved = input.decision === 'APPROVED'
    const now = new Date()

    // Conditional claim: two concurrent answers, and only the first one lands.
    const claimed = await prisma.projectPhase.updateMany({
      where: { id: phaseId, status: 'PENDING_APPROVAL' },
      data: {
        status: approved ? 'APPROVED' : 'REVISIONS',
        // Follows the status both ways, exactly as update() does. paidAt is
        // untouched here and always: money that arrived does not un-arrive.
        approvedAt: approved ? now : null,
        clientReviewedAt: now,
        clientNote: approved ? null : (input.note?.trim() ?? null),
      },
    })

    if (claimed.count === 0) {
      return { alreadyReviewed: true, status: phase.status }
    }

    await notifyOwnerOfPhaseReview({
      userId: phase.project.userId,
      clientName: phase.project.client.name,
      projectName: phase.project.name,
      phaseName: phase.name,
      price: Number(phase.price),
      decision: input.decision,
      note: input.note?.trim() ?? null,
    })

    return { alreadyReviewed: false, status: approved ? 'APPROVED' : 'REVISIONS' }
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

/**
 * Itay's line. Fire-and-forget: the review is already recorded, and a WAHA
 * outage must not turn a client's sign-off into an error on their screen.
 */
async function notifyOwnerOfPhaseReview(params: {
  userId: string
  clientName: string
  projectName: string
  phaseName: string
  price: number
  decision: 'APPROVED' | 'REVISIONS'
  note: string | null
}) {
  try {
    const ownerChatId = await WhatsAppAgentService.resolveOwnerChatId()
    if (!ownerChatId) {
      console.warn('No owner chat id available - phase review notification skipped')
      return
    }

    await WahaService.sendMessage({
      chatId: ownerChatId,
      text: phaseReviewOwnerNotice(params),
    })
  } catch (error) {
    console.error('Failed to notify owner about a phase review:', error)
  }
}
