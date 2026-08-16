import { PublicRequestForm } from '@/components/forms/public-request-form'
import { PortalRequestList } from '@/components/portal/request-list'
import { PublicRequestsService } from '@/lib/services/public-requests.service'
import { listClientRequests } from '@/lib/services/client-view'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * The client's portal: what they have asked for, and how to ask for more.
 *
 * A server component reading Prisma directly, which is the point - there is no
 * public JSON read API behind this page, so there is nothing to enumerate and
 * no CORS surface. The one write, answering a quote, is a Server Action.
 *
 * The submit form stays on this page rather than moving to /r/[token]/new. The
 * client was handed exactly one link and it should keep doing everything, and
 * e2e/public-request.spec.ts asserts the form is reachable right here.
 */
export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const client = await PublicRequestsService.resolveClientByToken(token)

  if (!client) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-content-strong">הקישור אינו תקין</h1>
          <p className="mt-2 text-content-muted">בדקו את הקישור או פנו אלינו ישירות.</p>
        </div>
      </div>
    )
  }

  const [requests, projects] = await Promise.all([
    listClientRequests(token),
    prisma.project.findMany({
      where: { clientId: client.id },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const awaiting = requests.filter((request) => request.awaitingDecision).length

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-content-strong">{client.name}</h1>
        <p className="mt-1 text-sm text-content-muted">
          {awaiting > 0
            ? `יש ${awaiting === 1 ? 'הצעת מחיר אחת שממתינה' : `${awaiting} הצעות מחיר שממתינות`} לאישורך.`
            : 'כאן אפשר לעקוב אחרי הפניות שלכם ולפתוח חדשות.'}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-content-strong">הפניות שלך</h2>
        <PortalRequestList token={token} requests={requests} />
      </section>

      {/* Heading text is asserted by e2e/public-request.spec.ts - it is the
          guard that the submit form stayed reachable from this one link when
          the list was added above it. Do not reword without updating it. */}
      <section id="new-request" className="scroll-mt-6">
        <h2 className="mb-1 text-lg font-semibold text-content-strong">דיווח תקלה / בקשה</h2>
        <p className="mb-4 text-sm text-content-muted">מלאו את הטופס ונחזור אליכם בהקדם.</p>
        <PublicRequestForm token={token} clientName={client.name} projects={projects} />
      </section>
    </>
  )
}
