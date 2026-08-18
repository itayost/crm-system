import { InvalidToken } from '@/components/portal/invalid-token'
import { NewRequestForm } from '@/components/portal/new-request-form'
import { PortalBack, PortalTitle } from '@/components/portal/portal-page'
import { listClientProjects } from '@/lib/services/client-view.queries'
import { PublicRequestsService } from '@/lib/services/public-requests.service'

export const dynamic = 'force-dynamic'

/**
 * Opening a request, on its own route.
 *
 * It used to be the body of the home page: six fields and a file input above
 * anything about the client's actual work, so the first screen of the portal
 * answered "what do you want to tell us" before "is anything waiting on you".
 *
 * A static segment under /requests, which is what keeps it clear of the sibling
 * [requestId] route one level up - `/r/{token}/new` would sit next to a dynamic
 * segment and rely on Next resolving static first. This does not rely on
 * anything.
 */
export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const client = await PublicRequestsService.resolveClientByToken(token)

  if (!client) return <InvalidToken />

  const projects = await listClientProjects(token)

  return (
    <div className="flex flex-col gap-7">
      <PortalBack href={`/r/${token}`}>חזרה</PortalBack>

      <header className="flex flex-col gap-1.5">
        <PortalTitle>מה קרה?</PortalTitle>
        <p className="text-portal-sm text-content-muted">
          נחזור אליך בוואטסאפ, בדרך כלל באותו יום.
        </p>
      </header>

      <NewRequestForm
        token={token}
        clientName={client.name}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  )
}
