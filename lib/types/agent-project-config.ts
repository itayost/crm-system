// Shared response shape for GET /api/v1/agent/projects.
// Mirrored on the agent side at src/core/config/crm-types.ts.

export type AgentProjectStatus = 'active' | 'paused' | 'disabled'

export interface AgentProjectClientView {
  id: string
  name: string
  phone: string
  email: string | null
  isInternal: boolean
}

export interface AgentProjectView {
  agentSlug: string
  displayName: string
  status: AgentProjectStatus
  github: { owner: string; repo: string; branch: string }
  vercel: { teamId: string; projectId: string }
  supabase: { projectRef: string } | null
  smoke: { url: string } | null
  domains: string[]
  safety: Record<string, unknown>
  morningReport: { include: boolean }
  ingestion: Record<string, unknown> | null
  client: AgentProjectClientView
}

export interface AgentProjectsResponse {
  projects: AgentProjectView[]
  fetchedAt: string
}
