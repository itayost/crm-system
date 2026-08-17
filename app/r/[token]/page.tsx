import Link from 'next/link'

import { InvalidToken } from '@/components/portal/invalid-token'
import { JourneyRail, phaseSteps } from '@/components/portal/journey-rail'
import { PortalNav } from '@/components/portal/portal-nav'
import { portalButton } from '@/components/portal/portal-button'
import { PortalAnswer, PortalCard, PortalSection } from '@/components/portal/portal-page'
import { CLIENT_PHASE_STATUS_LABELS } from '@/lib/design/labels'
import {
  listClientProjects,
  listClientRequests,
  type ClientProjectView,
  type ClientRequestView,
} from '@/lib/services/client-view'
import { PublicRequestsService } from '@/lib/services/public-requests.service'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * The client's home, which is one sentence and then the evidence for it.
 *
 * It used to open with three counters - requests, in development, to pay - that
 * all read zero on a healthy account, and then a six-field form. So the first
 * thing a client saw about their own work was three zeros and a wall of inputs.
 *
 * The answer comes first now, in a sentence, because they arrive holding
 * exactly one question and should not have to assemble the answer out of
 * numbers. Everything below it is the evidence: what is moving, and what moved
 * last. The form has its own route.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const client = await PublicRequestsService.resolveClientByToken(token)

  // A client whose token was rotated is a client who needs to reach a human
  // right now. This used to be a dead end with nothing to click.
  if (!client) return <InvalidToken />

  const [requests, projects] = await Promise.all([
    listClientRequests(token),
    listClientProjects(token),
  ])

  const awaiting = requests.filter((r) => r.awaitingDecision)
  const active = projects.filter((p) => !p.completedAt)

  return (
    <div className="flex flex-col gap-8">
      <PortalNav token={token} active="home" awaiting={awaiting.length} />

      <header className="flex flex-col gap-2">
        {/* The client's own name is context, not the page's identity - the
            header above says whose system this is. */}
        <p className="text-portal-2xs text-content-muted">עבור {client.name}</p>
        <PortalAnswer>{answer(awaiting, requests, active)}</PortalAnswer>
      </header>

      {awaiting.length > 0 && (
        <PortalSection>
          <div className="flex flex-col gap-3 rounded-lg border border-tone-caution-mark/45 bg-tone-caution-surface/50 p-4">
            {awaiting.map((request) => (
              <div key={request.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-portal-base font-semibold text-content-strong">
                      {request.title}
                    </span>
                    {request.estimateHours != null && (
                      <span className="text-portal-2xs text-content-muted">
                        היקף משוער: <bdi className="font-mono tabular-nums">{request.estimateHours}</bdi>{' '}
                        שעות
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 font-display text-portal-title font-medium leading-none tabular-nums text-content-strong">
                    <bdi>{formatCurrency(request.quotedPrice)}</bdi>
                  </span>
                </div>
                <Link href={`/r/${token}/${request.id}`} className={portalButton('ink', 'w-full')}>
                  לצפייה ואישור
                </Link>
              </div>
            ))}
            <p className="text-portal-2xs text-tone-caution-foreground">
              לא מתחילים לעבוד על זה לפני שתאשרו.
            </p>
          </div>
        </PortalSection>
      )}

      {active.map((project) => (
        <PulseSection key={project.id} token={token} project={project} />
      ))}

      <LastMovement requests={requests} />

      <Link href={`/r/${token}/requests/new`} className={portalButton('quiet', 'w-full')}>
        פנייה חדשה
      </Link>
    </div>
  )
}

/**
 * The sentence.
 *
 * Ordered by what the client can act on: something waiting on them beats work
 * in flight, which beats nothing at all. The last case is not an error state -
 * a client with no open requests and no live project is a client whose things
 * are all done, and the page should say so rather than showing an empty list.
 */
function answer(
  awaiting: ClientRequestView[],
  requests: ClientRequestView[],
  active: ClientProjectView[],
): string {
  if (awaiting.length === 1) return 'יש הצעת מחיר אחת שממתינה לך.'
  if (awaiting.length > 1) return `יש ${awaiting.length} הצעות מחיר שממתינות לך.`

  const live = requests.some(
    (r) => r.clientStatus === 'IN_PROGRESS' || r.clientStatus === 'SCHEDULED',
  )
  if (live || active.length > 0) return 'הכול בתנועה. אין שום דבר שממתין לך.'

  return 'הכול מטופל. אין שום דבר פתוח כרגע.'
}

/** Where the work is, as the three steps around the current one. */
function PulseSection({ token, project }: { token: string; project: ClientProjectView }) {
  // No advance here: the glance version is about where the *work* is, and an
  // unpaid advance would present itself as the current step of the project.
  const steps = phaseSteps(project.phases, CLIENT_PHASE_STATUS_LABELS)
  const current = steps.findIndex((s) => s.state === 'now')
  if (current < 0) return null

  // One step behind and one ahead is enough to read as motion. The whole rail
  // lives on the project page; this is the glance version.
  const window = steps.slice(Math.max(0, current - 1), current + 2)

  return (
    <PortalSection
      heading="מה בתנועה"
      aside={
        <>
          שלב <bdi className="font-mono tabular-nums">{current + 1}</bdi> מתוך{' '}
          <bdi className="font-mono tabular-nums">{project.phases.length}</bdi>
        </>
      }
    >
      <PortalCard className="flex flex-col gap-3.5">
        <Link
          href={`/r/${token}/projects`}
          className="flex flex-col gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-portal-base font-semibold text-content-strong">{project.name}</span>
          <span className="text-portal-2xs text-content-muted">{steps[current].title}</span>
        </Link>
        <JourneyRail steps={window} />
      </PortalCard>
    </PortalSection>
  )
}

/**
 * The most recent thing that actually happened.
 *
 * Recency is the reassurance: "we resolved this on Tuesday" answers "is anyone
 * working on my account" better than any status chip can. Picks the newest of
 * the dates the data can prove, and renders nothing when there is none.
 */
function LastMovement({ requests }: { requests: ClientRequestView[] }) {
  const moved = requests
    .map((r) => ({
      request: r,
      at: r.resolvedAt ?? r.decidedAt ?? r.quotedAt,
      what: r.resolvedAt ? 'הושלמה' : r.decidedAt ? 'קיבלה תשובה' : 'קיבלה הצעת מחיר',
    }))
    .filter((m): m is { request: ClientRequestView; at: string; what: string } => m.at !== null)
    .sort((a, b) => b.at.localeCompare(a.at))

  const latest = moved[0]
  if (!latest) return null

  return (
    <PortalSection heading="מה קרה לאחרונה">
      <div className="flex flex-col gap-1 rounded-lg border p-4">
        <span className="text-portal-sm text-content-body">
          הפנייה{' '}
          <span className="font-semibold text-content-strong">{latest.request.title}</span>{' '}
          {latest.what}
        </span>
        <span className="text-portal-2xs text-content-faint">
          <bdi>{formatDate(latest.at)}</bdi>
        </span>
      </div>
    </PortalSection>
  )
}
