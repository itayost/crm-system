import { NextRequest, NextResponse } from 'next/server'
import { validateAgentBearer } from '../_lib/auth'
import { prisma } from '@/lib/db/prisma'
import type {
  AgentProjectsResponse,
  AgentProjectView,
} from '@/lib/types/agent-project-config'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = validateAgentBearer(req)
  if (authError) return authError

  try {
    const rows = await prisma.agentProjectConfig.findMany({
      where: { status: 'ACTIVE' },
      include: {
        project: {
          include: {
            client: { include: { contacts: true } },
            primaryContact: true,
          },
        },
      },
      orderBy: { agentSlug: 'asc' },
    })

    const projects: AgentProjectView[] = rows.map((r) => {
      const client = r.project.client
      // A business has no single phone/email — source them from the project's
      // point of contact, falling back to the client's primary contact.
      const poc =
        r.project.primaryContact ??
        client.contacts.find((c) => c.isPrimary) ??
        client.contacts[0] ??
        null

      return {
        agentSlug: r.agentSlug,
        displayName: r.project.name,
        status: r.status.toLowerCase() as 'active',
        github: { owner: r.githubOwner, repo: r.githubRepo, branch: r.githubBranch },
        vercel: { teamId: r.vercelTeamId, projectId: r.vercelProjectId },
        supabase: r.supabaseProjectRef ? { projectRef: r.supabaseProjectRef } : null,
        smoke: r.smokeUrl ? { url: r.smokeUrl } : null,
        domains: r.domains,
        safety: r.safetyConfig as Record<string, unknown>,
        morningReport: { include: r.morningReportInclude },
        ingestion: r.ingestionConfig as Record<string, unknown> | null,
        client: {
          id: client.id,
          name: client.name,
          phone: poc?.phone ?? '',
          email: poc?.email ?? null,
          isInternal: client.isInternal,
        },
      }
    })

    const body: AgentProjectsResponse = {
      projects,
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (err) {
    // Phase B agent must receive structured JSON on errors (not HTML 500)
    // so its error handler can distinguish a CrmFetchError from a parse error.
    console.error('[GET /api/v1/agent/projects] DB error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
