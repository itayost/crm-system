import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { GitHubService, MAX_FILE_CHARS } = await import('@/lib/services/github.service')

const REPO = { owner: 'itayost', repo: 'garden-site', branch: 'main' }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('read-only GitHub access', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'gh-token'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists blobs only, and never uses a write method', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        tree: [
          { path: 'src', type: 'tree' },
          { path: 'src/app/page.tsx', type: 'blob' },
        ],
        truncated: false,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await GitHubService.listTree(REPO)

    expect(result).toEqual({
      ok: true,
      data: { entries: [{ path: 'src/app/page.tsx', type: 'blob' }], truncated: false },
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/repos/itayost/garden-site/git/trees/main')
    expect(init.method ?? 'GET').toBe('GET')
  })

  it('narrows the listing to a folder when asked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          tree: [
            { path: 'src/app/page.tsx', type: 'blob' },
            { path: 'docs/readme.md', type: 'blob' },
          ],
          truncated: false,
        })
      )
    )

    const result = await GitHubService.listTree(REPO, 'src/')

    expect(result.ok && result.data.entries).toEqual([{ path: 'src/app/page.tsx', type: 'blob' }])
  })

  it('truncates a long file at the cap', async () => {
    const long = 'a'.repeat(MAX_FILE_CHARS + 100)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from(long).toString('base64'),
        })
      )
    )

    const result = await GitHubService.readFile(REPO, 'src/app/page.tsx')

    expect(result.ok && result.data.content).toHaveLength(MAX_FILE_CHARS)
    expect(result.ok && result.data.truncated).toBe(true)
  })

  it('refuses a path that tries to walk out of the repository', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    for (const path of [
      '../../../otherowner/private-repo/contents/.env',
      '/etc/passwd',
      'src/../../secrets.ts',
      'src\\..\\secrets.ts',
      '',
    ]) {
      await expect(GitHubService.readFile(REPO, path)).resolves.toEqual({
        ok: false,
        error: 'Invalid file path',
      })
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('strips search qualifiers so a search cannot leave the repository', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ total_count: 0, items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await GitHubService.searchCode(REPO, 'checkout repo:someone/private org:acme')

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    const query = decodeURIComponent(new URL(url).searchParams.get('q') ?? '')
    expect(query).toBe('checkout repo:itayost/garden-site')
  })

  it('refuses a binary file rather than filling the prompt with noise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from([0x89, 0x50, 0x00, 0x4e]).toString('base64'),
        })
      )
    )

    await expect(GitHubService.readFile(REPO, 'public/logo.png')).resolves.toEqual({
      ok: false,
      error: 'Not a text file',
    })
  })

  it('reports a rate limit rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'rate limited' }, 403)))

    await expect(GitHubService.searchCode(REPO, 'checkout')).resolves.toEqual({
      ok: false,
      error: 'GitHub rate limit reached',
    })
  })

  it('reports a network failure rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )

    await expect(GitHubService.listTree(REPO)).resolves.toMatchObject({ ok: false })
  })

  it('does nothing without a configured token', async () => {
    delete process.env.GITHUB_TOKEN
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(GitHubService.readFile(REPO, 'src/app/page.tsx')).resolves.toEqual({
      ok: false,
      error: 'GitHub token is not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
