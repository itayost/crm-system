import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { prisma } from '@/lib/db/prisma'
import { GitHubService } from './github.service'

/**
 * ProductCards: what each delivered product *is*, precomputed.
 *
 * The support agent used to learn about a product by live-searching GitHub
 * mid-conversation - and in practice never did (zero repo-tool uses across
 * every production conversation). Product-level facts are not strings in the
 * code anyway; "אפשר לייצא דוח?" has no grep answer. So the knowledge is built
 * here, offline, from the repo's deterministic surface - routes, visible
 * Hebrew strings, README - written once per repo change and injected whole
 * into the support prompt, where it is cacheable and cannot fail to be
 * retrieved.
 */

const MODEL = process.env.PRODUCT_CARD_MODEL ?? 'anthropic/claude-sonnet-4.6'

/** How many route files the harvester will read. Small repos only. */
const PAGE_READ_CAP = 40
/** Visible strings kept per page - enough vocabulary, not the whole UI. */
const STRINGS_PER_PAGE = 12
const README_CHARS = 4_000
const I18N_CHARS = 4_000

/** Hebrew-bearing string literals in JSX/TSX source: the client's vocabulary. */
const HEBREW_STRING = /["'`]([^"'`\n]*[֐-׿][^"'`\n]*)["'`]/g

const I18N_FILE = /(^|\/)(messages|locales|i18n)\/(he|he-IL)\.json$/
const README_FILE = /^readme\.md$/i

export type RefreshOutcome = 'refreshed' | 'unchanged' | 'no_repo' | 'failed'

interface ConfiguredRepo {
  projectId: string
  projectName: string
  repo: { owner: string; repo: string; branch: string }
}

export class ProductCardService {
  /**
   * The cards for one client's projects, ready for the prompt. Manual notes
   * ride after the generated body - they are the owner's corrections, so they
   * come last and win.
   */
  static async cardsForClient(context: { clientId: string; userId: string }) {
    const projects = await prisma.project.findMany({
      where: { clientId: context.clientId, userId: context.userId, productCard: { isNot: null } },
      select: {
        name: true,
        productCard: {
          select: { cardHe: true, manualNotesHe: true, generatedAt: true },
        },
      },
    })

    return projects
      .filter((p) => p.productCard && (p.productCard.cardHe || p.productCard.manualNotesHe))
      .map((p) => ({
        projectName: p.name,
        body: [p.productCard!.cardHe, p.productCard!.manualNotesHe]
          .filter((part): part is string => !!part?.trim())
          .join('\n\n'),
        generatedAt: p.productCard!.generatedAt,
      }))
  }

  /** Every repo-configured project for the owner, shaped for refresh. */
  static async configuredRepos(userId: string): Promise<ConfiguredRepo[]> {
    const projects = await prisma.project.findMany({
      where: { userId, agentConfig: { isNot: null } },
      select: {
        id: true,
        name: true,
        agentConfig: { select: { githubOwner: true, githubRepo: true, githubBranch: true } },
      },
    })

    return projects
      .filter((p) => p.agentConfig)
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        repo: {
          owner: p.agentConfig!.githubOwner,
          repo: p.agentConfig!.githubRepo,
          branch: p.agentConfig!.githubBranch,
        },
      }))
  }

  /**
   * SHA-gated refresh for one project. `force` regenerates even on an
   * unchanged HEAD - for right after editing the generator or the manual notes.
   */
  static async refreshProject(
    userId: string,
    projectId: string,
    { force = false }: { force?: boolean } = {}
  ): Promise<RefreshOutcome> {
    const [configured] = (await this.configuredRepos(userId)).filter(
      (entry) => entry.projectId === projectId
    )
    if (!configured) return 'no_repo'

    const head = await GitHubService.getBranchHead(configured.repo)
    if (!head.ok) {
      console.error(`Card refresh: no HEAD for ${configured.projectName}: ${head.error}`)
      return 'failed'
    }

    if (!force) {
      const existing = await prisma.productCard.findUnique({
        where: { projectId },
        select: { commitSha: true },
      })
      if (existing?.commitSha === head.data.sha) return 'unchanged'
    }

    const harvest = await harvestRepo(configured)
    if (!harvest) return 'failed'

    const cardHe = await writeCard(configured.projectName, harvest)
    if (!cardHe) return 'failed'

    await prisma.productCard.upsert({
      where: { projectId },
      create: {
        projectId,
        cardHe,
        commitSha: head.data.sha,
        generatedAt: new Date(),
        sourceNote: harvest.sourceNote,
      },
      update: {
        cardHe,
        commitSha: head.data.sha,
        generatedAt: new Date(),
        sourceNote: harvest.sourceNote,
      },
    })

    return 'refreshed'
  }

  /** The nightly pass: skip every repo whose HEAD has not moved. */
  static async refreshAll(userId: string) {
    const outcomes: Record<string, RefreshOutcome> = {}

    // Sequential on purpose: this is a cron with the night to itself, and one
    // repo's generation should not compete with another's GitHub reads.
    for (const entry of await this.configuredRepos(userId)) {
      outcomes[entry.projectName] = await this.refreshProject(userId, entry.projectId)
    }

    return outcomes
  }
}

interface Harvest {
  routes: string[]
  pageStrings: Array<{ route: string; strings: string[] }>
  readme: string | null
  i18n: string | null
  dependencies: string[]
  sourceNote: string
}

/** The deterministic inputs: routes, visible Hebrew strings, README, i18n. */
async function harvestRepo(configured: ConfiguredRepo): Promise<Harvest | null> {
  const tree = await GitHubService.listAllPaths(configured.repo)
  if (!tree.ok) {
    console.error(`Card refresh: no tree for ${configured.projectName}: ${tree.error}`)
    return null
  }

  const routesResult = await GitHubService.listRoutes(configured.repo)
  const routes = routesResult.ok ? routesResult.data.routes : []

  const readmePath = tree.data.paths.find((p) => README_FILE.test(p))
  const i18nPath = tree.data.paths.find((p) => I18N_FILE.test(p))
  const packagePath = tree.data.paths.find((p) => p === 'package.json')

  const readFile = async (path: string | undefined, cap: number) => {
    if (!path) return null
    const result = await GitHubService.readFile(configured.repo, path)
    return result.ok ? result.data.content.slice(0, cap) : null
  }

  const [readme, i18n, packageJson] = await Promise.all([
    readFile(readmePath, README_CHARS),
    readFile(i18nPath, I18N_CHARS),
    readFile(packagePath, 2_000),
  ])

  let dependencies: string[] = []
  try {
    const parsed = JSON.parse(packageJson ?? '{}') as { dependencies?: Record<string, string> }
    dependencies = Object.keys(parsed.dependencies ?? {})
  } catch {
    // A truncated package.json is fine - dependencies are a hint, not a need.
  }

  // The Hebrew the client actually sees, page by page. Read in small parallel
  // batches: the cron has time, the GitHub quota does not need spikes.
  const pagesToRead = routes.slice(0, PAGE_READ_CAP)
  const pageStrings: Array<{ route: string; strings: string[] }> = []
  const BATCH = 8
  for (let i = 0; i < pagesToRead.length; i += BATCH) {
    const batch = await Promise.all(
      pagesToRead.slice(i, i + BATCH).map(async (route) => {
        const result = await GitHubService.readFile(configured.repo, route)
        if (!result.ok) return { route, strings: [] }
        const strings = [...result.data.content.matchAll(HEBREW_STRING)]
          .map((match) => match[1].trim())
          .filter((value) => value.length > 1)
        return { route, strings: [...new Set(strings)].slice(0, STRINGS_PER_PAGE) }
      })
    )
    pageStrings.push(...batch)
  }

  return {
    routes,
    pageStrings,
    readme,
    i18n,
    dependencies,
    sourceNote: `routes=${routes.length} pagesRead=${pagesToRead.length} readme=${readme ? 'yes' : 'no'} i18n=${i18nPath ?? 'none'}`,
  }
}

const CARD_SYSTEM_PROMPT = `אתה כותב "כרטיס מוצר" עבור בוט תמיכה בוואטסאפ: תיאור סמכותי של מוצר שנבנה עבור לקוח, שיוזרק לפרומפט של הבוט בכל שיחה.

הקהל: הבוט מדבר עם הלקוח - אדם לא טכני שמשתמש במוצר יום-יום בעברית. כתוב עברית טבעית; השאר נתיבים ומזהים באנגלית.

מבנה קבוע (השתמש בכותרות האלה בדיוק):

## מה המוצר
פסקה אחת: מה המערכת עושה ולמי, במילים שהלקוח היה משתמש בהן.

## מסכים
לכל מסך משמעותי שורה: הנתיב -> שם עברי טבעי -> מה עושים בו. השתמש במחרוזות העבריות שנקצרו מהקוד כדי לקרוא למסכים בשמות שהלקוח באמת רואה. דלג על מסכי עזר חסרי תוכן.

## תהליכים מרכזיים
2-5 תהליכים שהלקוח מבצע (הרשמה, הזנת נתונים, הפקת דוח...), כל אחד כרצף צעדים קצר בין מסכים.

## מילון
טבלת מונחים: המילה שעל המסך -> איפה זה חי (נתיב/מסך). רק מונחים שהופיעו בפועל במחרוזות שנקצרו.

## אינטגרציות
רק מה שמעיד עליו הקוד (תלויות, מחרוזות): תשלומים, וואטסאפ, מייל, אחסון וכו'. אם אין - כתוב "אין אינטגרציות חיצוניות מוכרות".

## מה לא קיים
רשימה קצרה של דברים שלקוחות נוטים לבקש והמוצר הזה לא עושה - הסק מהיעדרם מהמסכים והתלויות. נסח בזהירות: "לא נמצא במוצר", לא "בלתי אפשרי".

כללים:
- אל תמציא מסך, תהליך או יכולת שאין להם עדות בקלט. עדיף כרטיס קצר ונכון מארוך ומנחש.
- בלי שמות קבצים של קוד פנימי מחוץ לעמודת הנתיבים, בלי שמות פונקציות, בלי טכנולוגיות בגוף הטקסט.
- אורך יעד: 1,500-3,000 מילים עבריות לכל היותר; פחות זה בסדר.`

async function writeCard(projectName: string, harvest: Harvest): Promise<string | null> {
  const routeLines = harvest.pageStrings
    .map((page) => `- ${page.route}${page.strings.length ? ` | מחרוזות: ${page.strings.join(' · ')}` : ''}`)
    .join('\n')

  const prompt = [
    `שם הפרויקט: ${projectName}`,
    ``,
    `נתיבי המסכים והמחרוזות העבריות שנמצאו בכל אחד:`,
    routeLines || '(לא נמצאו נתיבי מסכים)',
    ``,
    harvest.i18n ? `קובץ תרגומים (he.json, קטוע):\n${harvest.i18n}` : null,
    harvest.readme ? `README (קטוע):\n${harvest.readme}` : null,
    harvest.dependencies.length ? `תלויות: ${harvest.dependencies.join(', ')}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n')

  try {
    const result = await generateText({
      model: gateway(MODEL),
      system: CARD_SYSTEM_PROMPT,
      prompt,
    })
    return result.text.trim() || null
  } catch (error) {
    console.error(`Card generation failed for ${projectName}:`, error)
    return null
  }
}
