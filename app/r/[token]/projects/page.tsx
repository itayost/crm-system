import Link from 'next/link'

import { PortalNav } from '@/components/portal/portal-nav'
import { PortalProjectCard } from '@/components/portal/project-card'
import { PublicRequestsService } from '@/lib/services/public-requests.service'
import { listClientProjects, listClientRequests } from '@/lib/services/client-view'

export const dynamic = 'force-dynamic'

/**
 * The client's own projects and what they have agreed to pay.
 *
 * Everything here goes through client-view.ts rather than Prisma directly, so
 * the whitelist that keeps aiNote and productCard away from a client covers
 * this page too.
 */
export default async function PortalProjectsPage({
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

  const [projects, requests] = await Promise.all([
    listClientProjects(token),
    listClientRequests(token),
  ])
  const awaiting = requests.filter((r) => r.awaitingDecision).length

  return (
    <>
      <PortalNav token={token} active="projects" awaiting={awaiting} />

      <h1 className="mb-1 text-2xl font-bold text-content-strong">הפרויקטים שלך</h1>
      <p className="mb-6 text-sm text-content-muted">
        מה בעבודה, ומה סוכם. הסכומים כוללים רק עבודה שאושרה.
      </p>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium text-content-strong">אין עדיין פרויקטים</p>
          <Link href={`/r/${token}`} className="mt-2 inline-block text-sm underline">
            חזרה לעמוד הראשי
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <PortalProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  )
}
