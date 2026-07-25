import { prisma } from '@/lib/db/prisma'
import { GitHubService } from './github.service'
import { Prisma } from '@prisma/client'

/**
 * The screens of a project, in words a client would use.
 *
 * "איפה זה קורה" is the most useful thing a ticket can carry and the hardest
 * thing to get by asking, because a client on a phone cannot copy a URL and does
 * not know what you call the page. Offering the real list turns it into a choice.
 *
 * Derived from the repository once and cached on the project's agent config, so
 * a conversation never pays for a GitHub round trip.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Route segments that are not places a client visits. */
const IGNORED_SEGMENTS = new Set(['api', 'app', 'src', 'pages'])

/** Hebrew names for the segments that keep recurring across these projects. */
const SEGMENT_NAMES: Record<string, string> = {
  '': 'עמוד הבית',
  about: 'אודות',
  contact: 'צור קשר',
  services: 'שירותים',
  projects: 'פרויקטים',
  portfolio: 'תיק עבודות',
  blog: 'בלוג',
  pricing: 'מחירים',
  faq: 'שאלות נפוצות',
  login: 'התחברות',
  register: 'הרשמה',
  dashboard: 'דשבורד',
  profile: 'פרופיל',
  settings: 'הגדרות',
  cart: 'עגלת קניות',
  checkout: 'תשלום',
  shop: 'חנות',
  products: 'מוצרים',
  orders: 'הזמנות',
  clients: 'לקוחות',
  contacts: 'אנשי קשר',
  tasks: 'משימות',
  requests: 'פניות',
}

interface ScreenCache {
  screens: string[]
  derivedAt: string
}

/**
 * Never throws and never blocks a conversation: no repo, no token, or a GitHub
 * outage all just mean an empty list, and the agent asks openly instead.
 */
export async function projectScreens(projectId: string): Promise<string[]> {
  const config = await prisma.agentProjectConfig.findUnique({
    where: { projectId },
    select: {
      githubOwner: true,
      githubRepo: true,
      githubBranch: true,
      ingestionConfig: true,
    },
  })

  if (!config) return []

  const cached = readCache(config.ingestionConfig)
  if (cached) return cached

  const result = await GitHubService.listRoutes({
    owner: config.githubOwner,
    repo: config.githubRepo,
    branch: config.githubBranch,
  })

  if (!result.ok) {
    console.warn(`Could not derive screens for project ${projectId}: ${result.error}`)
    return []
  }

  const screens = toScreenNames(result.data.routes)
  await writeCache(projectId, config.ingestionConfig, screens)

  return screens
}

/** Route file paths to client-facing names, deduplicated and ordered. */
export function toScreenNames(routes: string[]): string[] {
  const names = new Set<string>()

  for (const route of routes) {
    const name = routeToName(route)
    if (name) names.add(name)
  }

  return [...names]
}

function routeToName(route: string): string | null {
  const segments = route
    .replace(/\/page\.(tsx|ts|jsx|js)$/, '')
    .split('/')
    .filter(Boolean)
    // Route groups (auth) and parallel/private folders are not places.
    .filter((segment) => !segment.startsWith('(') && !segment.startsWith('_'))
    .filter((segment) => !IGNORED_SEGMENTS.has(segment))

  // A dynamic segment on its own ("[id]") is a detail view of its parent, which
  // the parent already covers.
  const meaningful = segments.filter((segment) => !segment.startsWith('['))

  if (meaningful.length === 0) return SEGMENT_NAMES['']

  const last = meaningful[meaningful.length - 1].toLowerCase()
  return SEGMENT_NAMES[last] ?? humanize(last)
}

function humanize(segment: string): string {
  return segment.replace(/[-_]/g, ' ')
}

function readCache(value: Prisma.JsonValue | null): string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const cache = (value as Record<string, unknown>).screenCache as ScreenCache | undefined
  if (!cache || !Array.isArray(cache.screens) || !cache.derivedAt) return null

  const age = Date.now() - new Date(cache.derivedAt).getTime()
  if (!Number.isFinite(age) || age > CACHE_TTL_MS) return null

  return cache.screens
}

async function writeCache(
  projectId: string,
  existing: Prisma.JsonValue | null,
  screens: string[]
) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}

  await prisma.agentProjectConfig.update({
    where: { projectId },
    data: {
      ingestionConfig: {
        ...base,
        screenCache: { screens, derivedAt: new Date().toISOString() },
      } as Prisma.InputJsonValue,
    },
  })
}
