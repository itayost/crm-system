import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The card generator is offline plumbing: deterministic harvest in, one model
 * call out, SHA-gated so an unchanged repo costs nothing. These tests pin the
 * gate, the harvest reaching the prompt, and the owner notes surviving.
 */

let generated = '## מה המוצר\nמערכת דוחות.'
type GenArgs = {
  prompt: string
  system: string
  tools?: Record<string, { execute: (input: { path: string }) => Promise<unknown> }>
}
const generateTextSpy = vi.fn(async (_args: GenArgs) => ({ text: generated }))

vi.mock('ai', () => ({
  generateText: (args: GenArgs) => generateTextSpy(args),
  stepCountIs: (n: number) => n,
  tool: <T>(definition: T) => definition,
}))
vi.mock('@ai-sdk/gateway', () => ({ gateway: (id: string) => id }))

const githubMock = {
  getBranchHead: vi.fn(),
  listAllPaths: vi.fn(),
  listRoutes: vi.fn(),
  readFile: vi.fn(),
}

vi.mock('@/lib/services/github.service', () => ({ GitHubService: githubMock }))

const prismaMock = {
  project: { findMany: vi.fn() },
  productCard: { findUnique: vi.fn(), upsert: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { ProductCardService, selectDocs } = await import('@/lib/services/product-card.service')

const CONFIGURED = [
  {
    id: 'project-1',
    name: 'מערכת דוחות',
    agentConfig: { githubOwner: 'itayost', githubRepo: 'reports', githubBranch: 'main' },
  },
]

describe('product card generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generated = '## מה המוצר\nמערכת דוחות.'
    prismaMock.project.findMany.mockResolvedValue(CONFIGURED)
    prismaMock.productCard.findUnique.mockResolvedValue(null)
    prismaMock.productCard.upsert.mockResolvedValue({ id: 'card-1' })
    githubMock.getBranchHead.mockResolvedValue({ ok: true, data: { sha: 'sha-new' } })
    githubMock.listAllPaths.mockResolvedValue({
      ok: true,
      data: { paths: ['README.md', 'package.json', 'app/reports/page.tsx'], truncated: false },
    })
    githubMock.listRoutes.mockResolvedValue({
      ok: true,
      data: { routes: ['app/reports/page.tsx'], truncated: false },
    })
    githubMock.readFile.mockImplementation(async (_repo: unknown, path: string) => ({
      ok: true,
      data: {
        path,
        truncated: false,
        content:
          path === 'README.md'
            ? 'Monthly reports system'
            : path === 'package.json'
              ? '{"dependencies":{"next":"15"}}'
              : '<h1>{"דוחות חודשיים"}</h1><Button>{"הפקת דוח"}</Button>',
      },
    }))
  })

  it('skips a repo whose HEAD has not moved', async () => {
    prismaMock.productCard.findUnique.mockResolvedValue({ commitSha: 'sha-new' })

    const outcome = await ProductCardService.refreshProject('user-1', 'project-1')

    expect(outcome).toBe('unchanged')
    expect(generateTextSpy).not.toHaveBeenCalled()
    expect(prismaMock.productCard.upsert).not.toHaveBeenCalled()
  })

  it('regenerates on force even when the HEAD is unchanged', async () => {
    prismaMock.productCard.findUnique.mockResolvedValue({ commitSha: 'sha-new' })

    const outcome = await ProductCardService.refreshProject('user-1', 'project-1', { force: true })

    expect(outcome).toBe('refreshed')
    expect(generateTextSpy).toHaveBeenCalled()
  })

  it('hands the model the routes and the Hebrew the client actually sees', async () => {
    const outcome = await ProductCardService.refreshProject('user-1', 'project-1')

    expect(outcome).toBe('refreshed')
    const { prompt } = generateTextSpy.mock.calls[0][0]
    expect(prompt).toContain('app/reports/page.tsx')
    expect(prompt).toContain('דוחות חודשיים')
    expect(prompt).toContain('הפקת דוח')
    expect(prompt).toContain('Monthly reports system')

    const { create } = prismaMock.productCard.upsert.mock.calls[0][0]
    expect(create.commitSha).toBe('sha-new')
    expect(create.cardHe).toContain('מה המוצר')
  })

  it('reports no_repo for a project without a configured repository', async () => {
    prismaMock.project.findMany.mockResolvedValue([])

    const outcome = await ProductCardService.refreshProject('user-1', 'project-x')

    expect(outcome).toBe('no_repo')
    expect(githubMock.getBranchHead).not.toHaveBeenCalled()
  })

  it('does not save a card the model failed to write', async () => {
    generateTextSpy.mockRejectedValueOnce(new Error('gateway down'))

    const outcome = await ProductCardService.refreshProject('user-1', 'project-1')

    expect(outcome).toBe('failed')
    expect(prismaMock.productCard.upsert).not.toHaveBeenCalled()
  })
})

/**
 * A repo shaped like the real client repos: components carrying most of the
 * Hebrew, a schema, API routes, Android strings, tiered docs. The v2 harvest
 * must put all of it in front of the writer - and account for it.
 */
const FULL_TREE = [
  'README.md',
  'package.json',
  'CLAUDE.md',
  'docs/GRAPH_REPORT.md',
  'docs/2026-01-01-plan.md',
  'prisma/schema.prisma',
  'app/api/reports/route.ts',
  'app/reports/page.tsx',
  'app/layout.tsx',
  'components/reports/ReportsTable.tsx',
  'app/src/main/res/values-he/strings.xml',
]

const FULL_CONTENTS: Record<string, string> = {
  'README.md': 'Monthly reports system',
  'package.json': '{"dependencies":{"next":"15","resend":"3"}}',
  'CLAUDE.md': 'מערכת דוחות לחשבונאות',
  'docs/GRAPH_REPORT.md': 'Graph summary of modules',
  'docs/2026-01-01-plan.md': 'תוכנית ישנה שלא יושמה',
  'prisma/schema.prisma': 'model Report { id String }',
  'app/reports/page.tsx': '<h1>{"דוחות חודשיים"}</h1>',
  'app/layout.tsx': '<nav>{"תפריט ראשי"}</nav>',
  'components/reports/ReportsTable.tsx': '<caption>{"טבלת דוחות"}</caption>',
  'app/src/main/res/values-he/strings.xml': '<string name="home">מסך הבית</string>',
}

describe('the v2 harvest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generated = '## מה המוצר\nמערכת דוחות.'
    prismaMock.project.findMany.mockResolvedValue(CONFIGURED)
    prismaMock.productCard.findUnique.mockResolvedValue(null)
    prismaMock.productCard.upsert.mockResolvedValue({ id: 'card-1' })
    githubMock.getBranchHead.mockResolvedValue({ ok: true, data: { sha: 'sha-new' } })
    githubMock.listAllPaths.mockResolvedValue({
      ok: true,
      data: { paths: FULL_TREE, truncated: false },
    })
    githubMock.listRoutes.mockResolvedValue({
      ok: true,
      data: { routes: ['app/reports/page.tsx'], truncated: false },
    })
    githubMock.readFile.mockImplementation(async (_repo: unknown, path: string) => {
      const content = FULL_CONTENTS[path]
      return content !== undefined
        ? { ok: true, data: { path, truncated: false, content } }
        : { ok: false, error: 'not found' }
    })
  })

  it('feeds the writer components, schema, API paths, Android strings and docs', async () => {
    const outcome = await ProductCardService.refreshProject('user-1', 'project-1')

    expect(outcome).toBe('refreshed')
    const { prompt } = generateTextSpy.mock.calls[0][0]

    // Component Hebrew, grouped by folder, layouts included.
    expect(prompt).toContain('- components/reports: טבלת דוחות')
    expect(prompt).toContain('תפריט ראשי')
    // Domain nouns and capability hints.
    expect(prompt).toContain('model Report { id String }')
    expect(prompt).toContain('- app/api/reports/route.ts')
    // The mobile app's screens.
    expect(prompt).toContain('מסך הבית')
    // Docs by tier - the dated plan stays out.
    expect(prompt).toContain('--- מסמך: docs/GRAPH_REPORT.md ---')
    expect(prompt).toContain('מערכת דוחות לחשבונאות')
    expect(prompt).not.toContain('תוכנית ישנה')
  })

  it('accounts for its coverage in the sourceNote', async () => {
    await ProductCardService.refreshProject('user-1', 'project-1')

    const { create } = prismaMock.productCard.upsert.mock.calls[0][0]
    expect(create.sourceNote).toContain('routes=1/1')
    expect(create.sourceNote).toContain('components=2/2')
    expect(create.sourceNote).toContain('docs=2(docs/GRAPH_REPORT.md,CLAUDE.md)')
    expect(create.sourceNote).toContain('schema=prisma/schema.prisma')
    expect(create.sourceNote).toContain('explorerReads=0')
  })

  it('lets the writer chase missing files, but only paths that exist in the tree', async () => {
    generateTextSpy.mockImplementationOnce(async (args: GenArgs) => {
      const readRepoFile = args.tools!.readRepoFile
      const outside = await readRepoFile.execute({ path: 'lib/secrets.ts' })
      expect(outside).toMatchObject({ success: false })
      const inside = await readRepoFile.execute({ path: 'components/reports/ReportsTable.tsx' })
      expect(inside).toMatchObject({ success: true, content: FULL_CONTENTS['components/reports/ReportsTable.tsx'] })
      return { text: generated }
    })

    await ProductCardService.refreshProject('user-1', 'project-1')

    // The rejected path never counts; the real read does.
    const { create } = prismaMock.productCard.upsert.mock.calls[0][0]
    expect(create.sourceNote).toContain('explorerReads=1')
  })
})

describe('doc selection', () => {
  it('orders GRAPH_REPORT first, then agent docs, then product docs', () => {
    const picked = selectDocs(['docs/design.md', 'CLAUDE.md', 'docs/GRAPH_REPORT.md'])

    expect(picked).toEqual(['docs/GRAPH_REPORT.md', 'CLAUDE.md', 'docs/design.md'])
  })

  it('excludes dated plans, audits, ADRs and the README', () => {
    const picked = selectDocs([
      'README.md',
      'docs/2026-01-01-plan.md',
      'docs/plans/roadmap.md',
      'docs/adr/0001-cards.md',
      'docs/audits/a.md',
      'CONTEXT.md',
      'docs/תהליך-הזמנה.md',
    ])

    expect(picked).toEqual(['CONTEXT.md', 'docs/תהליך-הזמנה.md'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => `docs/guide-${i}.md`)

    expect(selectDocs(many)).toHaveLength(6)
  })
})

describe('cards for the prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends the owner manual notes after the generated body', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      {
        name: 'מערכת דוחות',
        productCard: {
          cardHe: '## מה המוצר\nמערכת דוחות.',
          manualNotesHe: 'יש גם אפליקציית אנדרואיד עם מסך שאלונים.',
          generatedAt: new Date('2026-07-30'),
        },
      },
    ])

    const cards = await ProductCardService.cardsForClient({ clientId: 'c1', userId: 'u1' })

    expect(cards).toHaveLength(1)
    expect(cards[0].body).toContain('מערכת דוחות.')
    expect(cards[0].body.indexOf('אנדרואיד')).toBeGreaterThan(cards[0].body.indexOf('מה המוצר'))
  })

  it('serves a manual-only card for a project the generator never touched', async () => {
    // A product without a repo config - a consultation, a hosted landing page -
    // can still be described: the owner's notes are the card.
    prismaMock.project.findMany.mockResolvedValue([
      {
        name: 'דף נחיתה',
        productCard: { cardHe: '', manualNotesHe: 'דף נחיתה סטטי, אין אזור אישי.', generatedAt: null },
      },
    ])

    const cards = await ProductCardService.cardsForClient({ clientId: 'c1', userId: 'u1' })

    expect(cards).toHaveLength(1)
    expect(cards[0].body).toBe('דף נחיתה סטטי, אין אזור אישי.')
  })
})
