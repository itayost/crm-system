/**
 * Read-only GitHub access for the support agent.
 *
 * Strictly read paths (trees, code search, file contents) so the configured
 * token never needs a write scope. Nothing here throws: a missing token, a rate
 * limit, or a deleted repo comes back as a failed result, because the client is
 * mid-conversation and the agent has to keep talking either way.
 */

const API_ROOT = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 10_000

export const MAX_TREE_ENTRIES = 300
export const MAX_ROUTE_FILES = 200

/** Next.js App Router pages, and the Pages Router layout as a fallback. */
const ROUTE_FILE = /(^|\/)page\.(tsx|ts|jsx|js)$|^(src\/)?pages\/(?!api\/)[^/]+.*\.(tsx|jsx)$/
export const MAX_SEARCH_RESULTS = 20
export const MAX_FILE_CHARS = 8_000

export interface RepoRef {
  owner: string
  repo: string
  branch: string
}

export type RepoResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface TreeEntry {
  path: string
  type: string
  size?: number
}

/**
 * Paths come from the model, so they are checked before they touch a URL: a
 * `..` segment survives percent-encoding and would be normalized away by the URL
 * parser, walking out of the repo the client is entitled to.
 */
export function isSafeRepoPath(filePath: string): boolean {
  if (!filePath || filePath.startsWith('/') || filePath.includes('\\')) return false

  return filePath
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

/**
 * GitHub search qualifiers ("repo:", "org:", "user:", "path:") would let the
 * model widen a search beyond the repository we scoped it to.
 */
export function stripSearchQualifiers(query: string): string {
  return query
    .split(/\s+/)
    .filter((term) => term && !/^-?[a-z_]+:/i.test(term))
    .join(' ')
    .trim()
}

async function request<T>(path: string): Promise<RepoResult<T>> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { ok: false, error: 'GitHub token is not configured' }

  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (response.status === 403 || response.status === 429) {
      return { ok: false, error: 'GitHub rate limit reached' }
    }
    if (!response.ok) {
      return { ok: false, error: `GitHub responded ${response.status}` }
    }

    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    console.error('GitHub request failed:', error)
    return { ok: false, error: 'GitHub is unreachable' }
  }
}

export class GitHubService {
  /** Files in the repository, capped so a large monorepo cannot flood the model. */
  static async listTree(
    { owner, repo, branch }: RepoRef,
    pathPrefix?: string
  ): Promise<RepoResult<{ entries: TreeEntry[]; truncated: boolean }>> {
    const result = await request<{ tree: TreeEntry[]; truncated: boolean }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    )

    if (!result.ok) return result

    const files = result.data.tree.filter((entry) => entry.type === 'blob')
    const matching = pathPrefix
      ? files.filter((entry) => entry.path.startsWith(pathPrefix))
      : files

    return {
      ok: true,
      data: {
        entries: matching.slice(0, MAX_TREE_ENTRIES),
        truncated: result.data.truncated || matching.length > MAX_TREE_ENTRIES,
      },
    }
  }

  /**
   * The repository's user-facing routes.
   *
   * Deliberately not built on listTree: that caps at MAX_TREE_ENTRIES *before*
   * anything is filtered, so in a repo of any size the route files fall outside
   * the window and the answer is silently empty. Here the filter runs first.
   */
  static async listRoutes({
    owner,
    repo,
    branch,
  }: RepoRef): Promise<RepoResult<{ routes: string[]; truncated: boolean }>> {
    const result = await request<{ tree: TreeEntry[]; truncated: boolean }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    )

    if (!result.ok) return result

    const routes = result.data.tree
      .filter((entry) => entry.type === 'blob' && ROUTE_FILE.test(entry.path))
      .map((entry) => entry.path)
      .slice(0, MAX_ROUTE_FILES)

    return { ok: true, data: { routes, truncated: result.data.truncated } }
  }

  static async searchCode(
    { owner, repo }: RepoRef,
    query: string
  ): Promise<RepoResult<{ paths: string[]; total: number }>> {
    const terms = stripSearchQualifiers(query)
    if (!terms) return { ok: false, error: 'Empty search query' }

    const q = encodeURIComponent(`${terms} repo:${owner}/${repo}`)
    const result = await request<{ total_count: number; items: Array<{ path: string }> }>(
      `/search/code?q=${q}&per_page=${MAX_SEARCH_RESULTS}`
    )

    if (!result.ok) return result

    return {
      ok: true,
      data: {
        paths: result.data.items.map((item) => item.path).slice(0, MAX_SEARCH_RESULTS),
        total: result.data.total_count,
      },
    }
  }

  static async readFile(
    { owner, repo, branch }: RepoRef,
    filePath: string
  ): Promise<RepoResult<{ path: string; content: string; truncated: boolean }>> {
    if (!isSafeRepoPath(filePath)) {
      return { ok: false, error: 'Invalid file path' }
    }

    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
    const result = await request<{ content?: string; encoding?: string; type?: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    )

    if (!result.ok) return result
    if (result.data.type !== 'file' || !result.data.content) {
      return { ok: false, error: 'Not a readable file' }
    }

    const decoded = Buffer.from(result.data.content, 'base64').toString('utf8')
    // A NUL byte means binary: 8k characters of noise in the prompt helps nobody.
    if (decoded.includes('\u0000')) {
      return { ok: false, error: 'Not a text file' }
    }

    return {
      ok: true,
      data: {
        path: filePath,
        content: decoded.slice(0, MAX_FILE_CHARS),
        truncated: decoded.length > MAX_FILE_CHARS,
      },
    }
  }
}
