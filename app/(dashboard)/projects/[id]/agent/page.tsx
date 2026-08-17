import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/auth'
import { AgentConfigForm } from './_components/AgentConfigForm'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * ניטור - the support agent's configuration for one project.
 *
 * This page was in English inside a Hebrew RTL product, used its own
 * `container mx-auto max-w-3xl` chrome rather than the app's, and was reachable
 * only by typing the URL: nothing linked to it, while it linked back. It is now
 * linked from the project page and wears the same header as every other detail
 * screen.
 */
export default async function AgentConfigPage({ params }: PageProps) {
  const { id } = await params

  // This page serializes the whole agent config (GitHub, Vercel and Supabase
  // identifiers) into the client payload, so the lookup has to be scoped to the
  // signed-in owner rather than trusting the id in the URL.
  const user = await getCurrentUser()
  if (!user?.id) redirect('/login')

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { agentConfig: true },
  })
  if (!project) notFound()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={`/projects/${id}`}
          aria-label="חזרה לפרויקט"
          className="rounded-md p-1 text-content-faint transition-colors duration-fast hover:text-content-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight aria-hidden className="size-4" />
        </Link>
        <span className="text-ui-xs text-content-subtle">{project.name} /</span>
        <h1 className="text-ui-lg font-semibold text-content-strong">ניטור</h1>
      </div>

      <p className="max-w-prose text-ui-sm text-content-subtle">
        מה הסוכן רשאי לדעת על המוצר הזה, ומאיפה. הגדרות אלו נקראות רק בצד השרת.
      </p>

      <div className="max-w-3xl">
        <AgentConfigForm projectId={id} initial={project.agentConfig} />
      </div>
    </div>
  )
}
