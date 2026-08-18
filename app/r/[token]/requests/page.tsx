import Link from 'next/link'

import { InvalidToken } from '@/components/portal/invalid-token'
import { PortalNav } from '@/components/portal/portal-nav'
import { portalButton } from '@/components/portal/portal-button'
import { PortalTitle } from '@/components/portal/portal-page'
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

  if (!client) return <InvalidToken />

  const requests = await listClientRequests(token)
  const awaiting = requests.filter((r) => r.awaitingDecision).length

  return (
    <div className="flex flex-col gap-7">
      <PortalNav token={token} active="requests" awaiting={awaiting} />

      <PortalTitle>הפניות שלך</PortalTitle>

      <PortalRequestList token={token} requests={requests} />

      <Link href={`/r/${token}/requests/new`} className={portalButton('quiet', 'w-full')}>
        פנייה חדשה
      </Link>
    </div>
  )
}
