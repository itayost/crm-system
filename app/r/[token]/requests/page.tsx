import { PortalNav } from '@/components/portal/portal-nav'
import { PortalRequestList } from '@/components/portal/request-list'
import { PublicRequestsService } from '@/lib/services/public-requests.service'
import { listClientRequests } from '@/lib/services/client-view'

export const dynamic = 'force-dynamic'

/**
 * The full request list, moved off the home page.
 *
 * Static segment, so it wins over the sibling [requestId] route - a cuid never
 * spells "requests".
 */
export default async function PortalRequestsPage({
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

  const requests = await listClientRequests(token)
  const awaiting = requests.filter((r) => r.awaitingDecision).length

  return (
    <>
      <PortalNav token={token} active="requests" awaiting={awaiting} />

      <h1 className="mb-1 text-2xl font-bold text-content-strong">הפניות שלך</h1>
      <p className="mb-6 text-sm text-content-muted">
        כל מה שביקשת, והמצב של כל אחד. לפתיחת פנייה חדשה חזרו לעמוד הראשי.
      </p>

      <PortalRequestList token={token} requests={requests} />
    </>
  )
}
