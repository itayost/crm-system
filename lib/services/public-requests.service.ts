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

export interface ResolvedClient {
  id: string
  name: string
  userId: string
}

export interface SubmitResult {
  id: string
  clientName: string
  reporterName?: string
  attachmentCount: number
  ownerUserId: string
}

export class PublicRequestsService {
  /**
   * Resolve the owning client from a public form token. Callers validate the
   * result before doing any side effects (e.g. uploading an attachment).
   *
   * findUnique, not findFirst, and the empty guard above it - both deliberate.
   * `formToken` is nullable, so `findFirst({ where: { formToken: null } })`
   * happily returns the first client that has never been given a token at all,
   * handing a caller somebody's portal for nothing. Today's callers pass a
   * Zod-checked string so it was only latent, but a route reading
   * `searchParams.get('token')` gets `null` for free. findUnique types the
   * field as `string`, which turns that whole class of bug into a compile
   * error, and the guard covers the empty string it cannot type away.
   */
  static async resolveClientByToken(token: string): Promise<ResolvedClient | null> {
    if (!token?.trim()) return null

    return prisma.client.findUnique({
      where: { formToken: token },
      select: { id: true, name: true, userId: true },
    })
  }

  static async submit(client: ResolvedClient, input: PublicRequestSubmit): Promise<SubmitResult> {
    // projectId is only honored if it belongs to this client.
    let projectId: string | undefined = undefined
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, clientId: client.id },
        select: { id: true },
      })
      projectId = project?.id
    }

    // Contact match/create and Request create must be atomic so a failed
    // request insert never leaves a ghost reporter Contact behind.
    const request = await prisma.$transaction(async (tx) => {
      // Reporter Contact only when a phone is provided (Contact.phone is non-null).
      let contactId: string | undefined = undefined
      if (input.reporterPhone) {
        const existing = await tx.contact.findFirst({
          where: { userId: client.userId, clientId: client.id, phone: input.reporterPhone },
          select: { id: true },
        })
        if (existing) {
          contactId = existing.id
        } else {
          const created = await tx.contact.create({
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

      return tx.request.create({
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
