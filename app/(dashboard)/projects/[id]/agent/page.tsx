import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/auth'
import { AgentConfigForm } from './_components/AgentConfigForm'

interface PageProps {
  params: Promise<{ id: string }>
}

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
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-4">
        <a href={`/projects/${id}`} className="text-sm text-link hover:underline">
          &larr; back to project
        </a>
      </div>
      <h1 className="text-2xl font-bold mb-6">
        {project.name} <span className="text-content-subtle">&rsaquo;</span> Agent Monitoring
      </h1>

      <AgentConfigForm projectId={id} initial={project.agentConfig} />
    </div>
  )
}
