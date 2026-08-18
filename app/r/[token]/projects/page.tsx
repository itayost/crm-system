import Link from 'next/link'

import { InvalidToken } from '@/components/portal/invalid-token'
import { PortalNav } from '@/components/portal/portal-nav'
import { PortalTitle } from '@/components/portal/portal-page'
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

  if (!client) return <InvalidToken />

  const [projects, requests] = await Promise.all([
    listClientProjects(token),
    listClientRequests(token),
  ])
  const awaiting = requests.filter((r) => r.awaitingDecision).length

  return (
    <div className="flex flex-col gap-7">
      <PortalNav token={token} active="projects" awaiting={awaiting} />

      <header className="flex flex-col gap-1.5">
        <PortalTitle>הפרויקטים שלך</PortalTitle>
        <p className="text-portal-sm text-content-muted">
          מה בעבודה, ומה סוכם. הסכומים כוללים רק עבודה שאושרה.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-portal-base font-semibold text-content-strong">אין עדיין פרויקטים</p>
          <Link
            href={`/r/${token}`}
            className="mt-2 inline-block text-portal-sm font-semibold text-link underline underline-offset-4"
          >
            חזרה לעמוד הראשי
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {projects.map((project) => (
            <PortalProjectCard key={project.id} token={token} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
