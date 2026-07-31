import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { GitHubService, type RepoRef } from './github.service'
import { SupportConversationService } from './support-conversation.service'
import type { SupportToolContext } from './support-tools'

/**
 * Read-only repository tools for the support agent.
 *
 * Available only for projects that belong to the writing client and have an
 * agent configuration; the model names a project, never a repository. Findings
 * are internal: they sharpen the agent's questions and land on the ticket's note
 * for Itay, and the persona forbids repeating any of it to the client.
 */

const INTERNAL_ONLY =
  'מידע פנימי בלבד. אל תזכיר ללקוח שמות קבצים, נתיבים, קוד או מונחים טכניים - השתמש בזה רק כדי לשאול שאלה ממוקדת יותר.'

interface ConfiguredProject {
  id: string
  name: string
  repo: RepoRef
}

/** The writing client's own projects that have a repository configured. */
export async function configuredProjects(
  context: Pick<SupportToolContext, 'clientId' | 'userId'>
): Promise<ConfiguredProject[]> {
  const projects = await prisma.project.findMany({
    where: {
      clientId: context.clientId,
      userId: context.userId,
      agentConfig: { isNot: null },
    },
    select: {
      id: true,
      name: true,
      agentConfig: { select: { githubOwner: true, githubRepo: true, githubBranch: true } },
    },
  })

  return projects.flatMap((project) =>
    project.agentConfig
      ? [
          {
            id: project.id,
            name: project.name,
            repo: {
              owner: project.agentConfig.githubOwner,
              repo: project.agentConfig.githubRepo,
              branch: project.agentConfig.githubBranch,
            },
          },
        ]
      : []
  )
}

export function createRepoTools(
  context: SupportToolContext,
  projects: ConfiguredProject[],
  /** Set when any repo tool runs this turn; the caller uses it to decide
   *  whether findings on the conversation are fresh or leftovers. */
  activity?: { fired: boolean }
) {
  /** Exact name, or a single unambiguous partial match. Never a guess. */
  const byName = (projectName: string) => {
    const needle = projectName.trim().toLowerCase()
    if (!needle) return null

    const exact = projects.filter((project) => project.name.toLowerCase() === needle)
    if (exact.length === 1) return exact[0]

    const partial = projects.filter((project) => project.name.toLowerCase().includes(needle))
    return partial.length === 1 ? partial[0] : null
  }

  const unknownProject = {
    success: false as const,
    reason: 'unknown_project',
    message: 'אין לי גישה לקוד של הפרויקט הזה.',
    projects: projects.map((project) => project.name),
  }

  const remember = async (finding: string) => {
    if (activity) activity.fired = true
    await SupportConversationService.addRepoFinding(context, finding)
  }

  return {
    listProjectFiles: tool({
      description: `Internal: list files in a project's repository, to orient yourself before asking the client a sharper question. ${INTERNAL_ONLY}`,
      inputSchema: z.object({
        projectName: z.string().describe('Project name as listed by listMyProjects'),
        pathPrefix: z.string().optional().describe('Optional folder to narrow the listing'),
      }),
      execute: async ({ projectName, pathPrefix }) => {
        const project = byName(projectName)
        if (!project) return unknownProject

        const result = await GitHubService.listTree(project.repo, pathPrefix)
        if (!result.ok) return degraded(result.error)

        await remember(
          `נסרקו ${result.data.entries.length} קבצים ב-${project.name}${
            pathPrefix ? ` תחת ${pathPrefix}` : ''
          }`
        )

        return {
          success: true,
          note: INTERNAL_ONLY,
          truncated: result.data.truncated,
          files: result.data.entries.map((entry) => entry.path),
        }
      },
    }),

    searchProjectCode: tool({
      description: `Internal: search a project's repository for a term the client mentioned (a button label, a page name, an error string). ${INTERNAL_ONLY}`,
      inputSchema: z.object({
        projectName: z.string(),
        query: z.string().min(2).describe('What to look for, e.g. a visible label or error text'),
        purpose: z
          .string()
          .max(120)
          .optional()
          .describe('One short Hebrew line: what you are trying to establish with this search'),
      }),
      execute: async ({ projectName, query, purpose }) => {
        const project = byName(projectName)
        if (!project) return unknownProject

        const result = await GitHubService.searchCode(project.repo, query)
        if (!result.ok) return degraded(result.error)

        await remember(
          `חיפוש "${query}" ב-${project.name}: ${result.data.total} תוצאות${
            result.data.paths.length ? ` (${result.data.paths.slice(0, 3).join(', ')})` : ''
          }${purpose ? ` — ${purpose}` : ''}`
        )

        return {
          success: true,
          note: INTERNAL_ONLY,
          total: result.data.total,
          paths: result.data.paths,
        }
      },
    }),

    readProjectFile: tool({
      description: `Internal: read one file from a project's repository, truncated. ${INTERNAL_ONLY}`,
      inputSchema: z.object({
        projectName: z.string(),
        path: z.string().describe('Repository-relative file path, as returned by the other tools'),
        conclusion: z
          .string()
          .max(160)
          .optional()
          .describe(
            'One short Hebrew line for Itay: what this file told you about the client issue. Fill it whenever the read taught you something.'
          ),
      }),
      execute: async ({ projectName, path, conclusion }) => {
        const project = byName(projectName)
        if (!project) return unknownProject

        const result = await GitHubService.readFile(project.repo, path)
        if (!result.ok) return degraded(result.error)

        // The finding used to record only the act ("נקרא path") - what the
        // model concluded from the file died with the turn. The conclusion is
        // what reaches Itay on the ticket.
        await remember(`נקרא ${path} ב-${project.name}${conclusion ? ` — ${conclusion}` : ''}`)

        return {
          success: true,
          note: INTERNAL_ONLY,
          path: result.data.path,
          truncated: result.data.truncated,
          content: result.data.content,
        }
      },
    }),
  }
}

/** A GitHub problem is never the client's problem: say so internally and move on. */
function degraded(error: string) {
  return {
    success: false as const,
    reason: 'repo_unavailable',
    message: `לא הצלחתי לבדוק את הקוד (${error}). המשך בשיחה רגילה בלי להזכיר את זה ללקוח.`,
  }
}
