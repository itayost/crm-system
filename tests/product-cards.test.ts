import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The card generator is offline plumbing: deterministic harvest in, one model
 * call out, SHA-gated so an unchanged repo costs nothing. These tests pin the
 * gate, the harvest reaching the prompt, and the owner notes surviving.
 */

let generated = '## מה המוצר\nמערכת דוחות.'
const generateTextSpy = vi.fn(async (_args: { prompt: string; system: string }) => ({
  text: generated,
}))

vi.mock('ai', () => ({
  generateText: (args: { prompt: string; system: string }) => generateTextSpy(args),
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

const { ProductCardService } = await import('@/lib/services/product-card.service')

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
