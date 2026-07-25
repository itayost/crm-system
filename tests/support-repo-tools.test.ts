import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  project: { findMany: vi.fn() },
  $executeRaw: vi.fn(),
}

const githubMock = {
  listTree: vi.fn(),
  searchCode: vi.fn(),
  readFile: vi.fn(),
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/github.service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/github.service')>(
    '@/lib/services/github.service'
  )
  return { ...actual, GitHubService: githubMock }
})
vi.mock('ai', () => ({ tool: <T>(definition: T) => definition }))

const { configuredProjects, createRepoTools } = await import(
  '@/lib/services/support-repo-tools'
)

const context = {
  userId: 'user-1',
  clientId: 'client-1',
  clientName: 'מסעדת הגן',
  contactId: 'contact-1',
  contactName: 'דנה',
  chatId: 'client-chat@lid',
  sourceMessageId: 'msg-1',
}

const PROJECTS = [
  {
    id: 'project-1',
    name: 'האתר',
    repo: { owner: 'itayost', repo: 'garden-site', branch: 'main' },
  },
]

describe('configuredProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([])
  })

  it('asks only for this client and owner, and only for configured projects', async () => {
    await configuredProjects(context)

    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'client-1',
          userId: 'user-1',
          agentConfig: { isNot: null },
        },
      })
    )
  })

  it('maps a configured project to its repository', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: 'project-1',
        name: 'האתר',
        agentConfig: { githubOwner: 'itayost', githubRepo: 'garden-site', githubBranch: 'main' },
      },
    ])

    await expect(configuredProjects(context)).resolves.toEqual(PROJECTS)
  })
})

/** The mocked `tool()` returns the definition as-is, so execute is always present. */
function repoTools() {
  return createRepoTools(context, PROJECTS) as unknown as Record<
    string,
    { execute: (input: unknown) => Promise<unknown> }
  >
}

describe('repo tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$executeRaw.mockResolvedValue(1)
  })

  it('lists files for the client own project', async () => {
    githubMock.listTree.mockResolvedValue({
      ok: true,
      data: { entries: [{ path: 'src/app/page.tsx', type: 'blob' }], truncated: false },
    })

    const tools = repoTools()
    const result = await tools.listProjectFiles.execute({ projectName: 'האתר' })

    expect(githubMock.listTree).toHaveBeenCalledWith(PROJECTS[0].repo, undefined)
    expect(result).toMatchObject({ success: true, files: ['src/app/page.tsx'] })
  })

  it('refuses a project that is not in the client configured list', async () => {
    const tools = repoTools()

    const result = await tools.searchProjectCode.execute({
      projectName: 'האתר של לקוח אחר',
      query: 'checkout',
    })

    expect(result).toMatchObject({ success: false, reason: 'unknown_project' })
    expect(githubMock.searchCode).not.toHaveBeenCalled()
  })

  it('remembers a search as an internal finding for the ticket note', async () => {
    githubMock.searchCode.mockResolvedValue({
      ok: true,
      data: { paths: ['src/app/checkout/page.tsx'], total: 3 },
    })

    const tools = repoTools()
    await tools.searchProjectCode.execute({ projectName: 'האתר', query: 'שליחת הזמנה' })

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1)
    const finding = prismaMock.$executeRaw.mock.calls[0][1] as string
    expect(finding).toContain('שליחת הזמנה')
    expect(finding).toContain('src/app/checkout/page.tsx')
  })

  it('degrades to a normal conversation when GitHub is rate limited', async () => {
    githubMock.searchCode.mockResolvedValue({ ok: false, error: 'GitHub rate limit reached' })

    const tools = repoTools()
    const result = await tools.searchProjectCode.execute({
      projectName: 'האתר',
      query: 'checkout',
    })

    expect(result).toMatchObject({ success: false, reason: 'repo_unavailable' })
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
  })

  it('marks every repo tool result as internal only', async () => {
    githubMock.readFile.mockResolvedValue({
      ok: true,
      data: { path: 'src/app/page.tsx', content: 'export default function Page() {}', truncated: false },
    })

    const tools = repoTools()
    const result = (await tools.readProjectFile.execute({
      projectName: 'האתר',
      path: 'src/app/page.tsx',
    })) as { note: string }

    expect(result.note).toContain('אל תזכיר ללקוח')
  })
})
