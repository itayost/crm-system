import { prisma } from '@/lib/db/prisma'

export interface PublicRequestSubmit {
  token: string
  type?: 'BUG' | 'REQUEST' | 'QUESTION' | 'OTHER'
  title: string
  description: string
  projectId?: string
  reporterName?: string
  reporterPhone?: string
  reporterEmail?: string
  attachments: string[]
}

export interface SubmitResult {
  id: string
  clientName: string
  reporterName?: string
  attachmentCount: number
  ownerUserId: string
}

export class PublicRequestsService {
  static async submit(input: PublicRequestSubmit): Promise<SubmitResult> {
    const client = await prisma.client.findFirst({
      where: { formToken: input.token },
      select: { id: true, name: true, userId: true },
    })
    if (!client) {
      throw new Error('NOT_FOUND')
    }

    // projectId is only honored if it belongs to this client.
    let projectId: string | undefined = undefined
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, clientId: client.id },
        select: { id: true },
      })
      projectId = project?.id
    }

    // Reporter Contact only when a phone is provided (Contact.phone is non-null).
    let contactId: string | undefined = undefined
    if (input.reporterPhone) {
      const existing = await prisma.contact.findFirst({
        where: { userId: client.userId, clientId: client.id, phone: input.reporterPhone },
        select: { id: true },
      })
      if (existing) {
        contactId = existing.id
      } else {
        const created = await prisma.contact.create({
          data: {
            name: input.reporterName || 'לקוח',
            phone: input.reporterPhone,
            email: input.reporterEmail,
            status: 'CLIENT',
            source: 'OTHER',
            clientId: client.id,
            userId: client.userId,
          },
          select: { id: true },
        })
        contactId = created.id
      }
    }

    // If we could not attach a Contact, keep reporter details in the description.
    const reporterLine =
      !contactId && (input.reporterName || input.reporterEmail)
        ? `\n\nדיווח מאת: ${[input.reporterName, input.reporterEmail].filter(Boolean).join(' / ')}`
        : ''

    const request = await prisma.request.create({
      data: {
        title: input.title,
        description: input.description + reporterLine,
        type: input.type ?? 'REQUEST',
        status: 'PENDING_REVIEW',
        source: 'FORM',
        priority: 'MEDIUM',
        isAiGenerated: false,
        attachments: input.attachments,
        clientId: client.id,
        contactId,
        projectId,
        userId: client.userId,
      },
      select: { id: true },
    })

    return {
      id: request.id,
      clientName: client.name,
      reporterName: input.reporterName,
      attachmentCount: input.attachments.length,
      ownerUserId: client.userId,
    }
  }
}
