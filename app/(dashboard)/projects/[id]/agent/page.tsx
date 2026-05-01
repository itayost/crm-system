import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { AgentConfigForm } from './_components/AgentConfigForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AgentConfigPage({ params }: PageProps) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { agentConfig: true },
  })
  if (!project) notFound()

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-4">
        <a href={`/projects/${id}`} className="text-sm text-blue-600 hover:underline">
          &larr; back to project
        </a>
      </div>
      <h1 className="text-2xl font-bold mb-6">
        {project.name} <span className="text-gray-500">&rsaquo;</span> Agent Monitoring
      </h1>

      <AgentConfigForm projectId={id} initial={project.agentConfig} />
    </div>
  )
}
