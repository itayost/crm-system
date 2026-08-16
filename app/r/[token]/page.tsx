import Link from 'next/link'

import { PublicRequestForm } from '@/components/forms/public-request-form'
import { PortalNav } from '@/components/portal/portal-nav'
import { PublicRequestsService } from '@/lib/services/public-requests.service'
import { listClientProjects, listClientRequests } from '@/lib/services/client-view'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * The client's home.
 *
 * This page used to drop them straight into a list of sixteen requests, which
 * answers everything except the question they actually arrived with: is
 * anything waiting on me. That answer is now the first thing on the page, and
 * the list moved to its own tab.
 *
 * Every read goes through client-view.ts. The project list here used to reach
 * for Prisma directly, which made it the one query on the portal outside the
 * whitelist discipline; listClientProjects now covers it.
 *
 * The submit form stays here rather than moving with the list: it is what a
 * client comes to do, and e2e/public-request.spec.ts asserts both it and its
 * heading at this exact URL.
 */
export default async function PortalHomePage({
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
    listClientProjects(token),
  ])

  const awaiting = requests.filter((r) => r.awaitingDecision)
  const inProgress = requests.filter((r) => r.clientStatus === 'IN_PROGRESS').length
  const owed = projects.reduce((sum, p) => sum + p.outstanding, 0)

  return (
    <>
      <PortalNav token={token} active="home" awaiting={awaiting.length} />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-content-strong">{client.name}</h1>
      </header>

      {/* The answer first. Everything below it is detail. */}
      {awaiting.length > 0 ? (
        <section className="mb-6 rounded-lg border border-tone-caution-mark/40 bg-tone-caution-surface/40 p-5">
          <h2 className="font-semibold text-content-strong">
            {awaiting.length === 1
              ? 'יש הצעת מחיר אחת שממתינה לאישורך'
              : `יש ${awaiting.length} הצעות מחיר שממתינות לאישורך`}
          </h2>
          <ul className="mt-3 space-y-2">
            {awaiting.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/r/${token}/${request.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2 hover:shadow-sm"
                >
                  <span className="font-medium text-content-strong">{request.title}</span>
                  <span className="tabular-nums text-content-muted">
                    <bdi>{formatCurrency(request.quotedPrice)}</bdi>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mb-6 rounded-lg border border-border p-5">
          <h2 className="font-semibold text-content-strong">הכל מטופל</h2>
          <p className="mt-1 text-sm text-content-muted">אין כרגע שום דבר שממתין לאישור שלך.</p>
        </section>
      )}

      <dl className="mb-10 grid grid-cols-3 gap-3">
        <Stat term="הפניות שלך" value={String(requests.length)} href={`/r/${token}/requests`} />
        <Stat term="בפיתוח" value={String(inProgress)} href={`/r/${token}/requests`} />
        <Stat
          term="לתשלום"
          value={formatCurrency(owed)}
          href={projects.length > 0 ? `/r/${token}/projects` : undefined}
        />
      </dl>

      {/* Heading asserted by e2e/public-request.spec.ts - it is the guard that
          the form stayed reachable from the one link a client is given. */}
      <section id="new-request" className="scroll-mt-6">
        <h2 className="mb-1 text-lg font-semibold text-content-strong">דיווח תקלה / בקשה</h2>
        <p className="mb-4 text-sm text-content-muted">מלאו את הטופס ונחזור אליכם בהקדם.</p>
        <PublicRequestForm
          token={token}
          clientName={client.name}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      </section>
    </>
  )
}

function Stat({ term, value, href }: { term: string; value: string; href?: string }) {
  const body = (
    <>
      <dt className="text-xs text-content-faint">{term}</dt>
      <dd className="text-xl font-bold tabular-nums text-content-strong">
        <bdi>{value}</bdi>
      </dd>
    </>
  )

  return href ? (
    <Link href={href} className="rounded-lg border border-border p-3 hover:shadow-sm">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-border p-3">{body}</div>
  )
}
