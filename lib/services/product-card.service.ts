import { generateText, stepCountIs, tool } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { GitHubService } from './github.service'

/**
 * ProductCards: what each delivered product *is*, precomputed.
 *
 * The support agent used to learn about a product by live-searching GitHub
 * mid-conversation - and in practice never did (zero repo-tool uses across
 * every production conversation). Product-level facts are not strings in the
 * code anyway; "אפשר לייצא דוח?" has no grep answer. So the knowledge is built
 * here, offline, once per repo change, and injected whole into the support
 * prompt, where it is cacheable and cannot fail to be retrieved.
 *
 * v2 reads the whole repo, not its surface. Measured against the client
 * clones, ~75% of the visible Hebrew product text lives in component files
 * the v1 harvest never opened, every repo has a schema naming the domain,
 * and every repo carries docs written precisely to describe the product.
 */

const MODEL = process.env.PRODUCT_CARD_MODEL ?? 'anthropic/claude-sonnet-4.6'

/** How many route files the harvester will read (Masob has 111). */
const PAGE_READ_CAP = 120
/** How many non-page component/layout files it will read. */
const COMPONENT_READ_CAP = 80
/** Visible strings kept per file - enough vocabulary, not the whole UI. */
const STRINGS_PER_FILE = 12
/** Total component-string lines across the repo, so the prompt stays bounded. */
const COMPONENT_STRING_LINE_CAP = 700
const README_CHARS = 4_000
const I18N_CHARS = 4_000
const SCHEMA_CHARS = 4_000
const ANDROID_CHARS = 4_000
const DOC_CHARS = 3_000
const DOCS_CAP = 6
/** Extra files the writer may read beyond the harvest. ~10 reads + the write. */
const WRITER_STEP_CAP = 12

/** Hebrew-bearing string literals in JSX/TSX source: the client's vocabulary. */
const HEBREW_STRING = /["'`]([^"'`\n]*[֐-׿][^"'`\n]*)["'`]/g

const I18N_FILE = /(^|\/)(messages|locales|i18n)\/(he|he-IL)\.json$/
const README_FILE = /^readme\.md$/i
const COMPONENT_FILE = /\.(tsx|jsx)$/
const PAGE_OR_ROUTE = /(^|\/)(page|route)\.(tsx|ts|jsx|js)$/
const LAYOUT_FILE = /(^|\/)layout\.(tsx|jsx)$/
const SCHEMA_FILE = /(^|\/)prisma\/schema\.prisma$/
const MIGRATION_FILE = /(^|\/)(supabase\/)?migrations\/.*\.sql$/
const API_ROUTE = /(^|\/)(app|src\/app)\/api\/.*\/route\.(ts|js)$/
const ANDROID_STRINGS = /(^|\/)res\/values(-he)?\/strings\.xml$/

/**
 * Docs that describe the product, tiered. Dated planning docs are excluded on
 * purpose: a plan describes intent at a point in time, and a card asserting a
 * feature from a plan that never shipped is the "כבר נקלטה" bug in reverse.
 */
const DOC_TIER1 = /(^|\/)(CLAUDE|CONTEXT|AGENTS)\.md$/
/** Graphify's architecture summary, committed by the pilot repos' workflow.
 *  Read wherever it lives - it is the densest single doc a repo can offer. */
const DOC_GRAPH_REPORT = /(^|\/)GRAPH_REPORT\.md$/
const DOC_TIER2 = /^(docs\/[^/]+\.md|\.planning\/(PROJECT|REQUIREMENTS)\.md)$/
const DOC_HEBREW_NAME = /[֐-׿][^/]*\.md$/
const DOC_EXCLUDED = /(\d{4}-\d{2}-\d{2}|(^|\/)plans\/|(^|\/)audits?\/|(^|\/)adr\/)/i

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

    const written = await writeCard(configured, harvest)
    if (!written) return 'failed'

    const sourceNote = `${harvest.sourceNote} explorerReads=${written.explorerReads}`

    await prisma.productCard.upsert({
      where: { projectId },
      create: {
        projectId,
        cardHe: written.cardHe,
        commitSha: head.data.sha,
        generatedAt: new Date(),
        sourceNote,
      },
      update: {
        cardHe: written.cardHe,
        commitSha: head.data.sha,
        generatedAt: new Date(),
        sourceNote,
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
  allPaths: string[]
  pageStrings: Array<{ route: string; strings: string[] }>
  componentStrings: Array<{ folder: string; strings: string[] }>
  docs: Array<{ path: string; content: string }>
  schema: { path: string; content: string } | null
  apiPaths: string[]
  androidStrings: string | null
  readme: string | null
  i18n: string | null
  dependencies: string[]
  sourceNote: string
}

/** Two path segments are enough to say where vocabulary lives. */
function folderOf(path: string): string {
  const dir = path.split('/').slice(0, -1)
  return dir.slice(0, 2).join('/') || '(root)'
}

function extractHebrewStrings(content: string): string[] {
  const strings = [...content.matchAll(HEBREW_STRING)]
    .map((match) => match[1].trim())
    .filter((value) => value.length > 1)
  return [...new Set(strings)]
}

/**
 * Which docs the card may read, in priority order. Tier 1 is written for
 * agents and glossaries (CLAUDE.md, CONTEXT.md, AGENTS.md); tier 2 is
 * product/design docs and the durable planning files; Hebrew-named docs are
 * usually screen-flow descriptions. Dated plans and audits never qualify.
 */
export function selectDocs(paths: string[]): string[] {
  const eligible = paths.filter((p) => p.endsWith('.md') && !DOC_EXCLUDED.test(p) && !README_FILE.test(p))
  const graphReport = eligible.filter((p) => DOC_GRAPH_REPORT.test(p))
  const tier1 = eligible.filter((p) => !DOC_GRAPH_REPORT.test(p) && DOC_TIER1.test(p))
  const tier2 = eligible.filter(
    (p) => !DOC_GRAPH_REPORT.test(p) && !DOC_TIER1.test(p) && (DOC_TIER2.test(p) || DOC_HEBREW_NAME.test(p))
  )
  return [...graphReport, ...tier1, ...tier2].slice(0, DOCS_CAP)
}

/** The deterministic inputs. Everything else the writer may chase itself. */
async function harvestRepo(configured: ConfiguredRepo): Promise<Harvest | null> {
  const tree = await GitHubService.listAllPaths(configured.repo)
  if (!tree.ok) {
    console.error(`Card refresh: no tree for ${configured.projectName}: ${tree.error}`)
    return null
  }
  const paths = tree.data.paths

  const routesResult = await GitHubService.listRoutes(configured.repo)
  const routes = routesResult.ok ? routesResult.data.routes : []

  const readCapped = async (path: string | undefined | null, cap: number) => {
    if (!path) return null
    const result = await GitHubService.readFile(configured.repo, path)
    return result.ok ? result.data.content.slice(0, cap) : null
  }

  // Single scalar files.
  const readmePath = paths.find((p) => README_FILE.test(p))
  const i18nPath = paths.find((p) => I18N_FILE.test(p))
  const schemaPath = paths.find((p) => SCHEMA_FILE.test(p)) ?? paths.filter((p) => MIGRATION_FILE.test(p)).sort()[0]
  const androidPath =
    paths.find((p) => /values-he\/strings\.xml$/.test(p)) ?? paths.find((p) => ANDROID_STRINGS.test(p))

  const [readme, i18n, schemaContent, androidStrings, packageJson] = await Promise.all([
    readCapped(readmePath, README_CHARS),
    readCapped(i18nPath, I18N_CHARS),
    readCapped(schemaPath, SCHEMA_CHARS),
    readCapped(androidPath, ANDROID_CHARS),
    readCapped('package.json', 2_000),
  ])

  let dependencies: string[] = []
  try {
    const parsed = JSON.parse(packageJson ?? '{}') as { dependencies?: Record<string, string> }
    dependencies = Object.keys(parsed.dependencies ?? {})
  } catch {
    // A truncated package.json is fine - dependencies are a hint, not a need.
  }

  // Docs, tiered and capped.
  const docPaths = selectDocs(paths)
  const docs: Array<{ path: string; content: string }> = []
  for (const path of docPaths) {
    const content = await readCapped(path, DOC_CHARS)
    if (content) docs.push({ path, content })
  }

  // API capability hints come from the tree alone - zero reads.
  const apiPaths = paths.filter((p) => API_ROUTE.test(p))

  const BATCH = 8
  const readMany = async <T>(
    files: string[],
    toResult: (path: string, content: string) => T
  ): Promise<T[]> => {
    const out: T[] = []
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = await Promise.all(
        files.slice(i, i + BATCH).map(async (path) => {
          const result = await GitHubService.readFile(configured.repo, path)
          return result.ok ? toResult(path, result.data.content) : null
        })
      )
      out.push(...batch.filter((entry): entry is Awaited<T> => entry !== null))
    }
    return out
  }

  // The Hebrew the client actually sees, page by page.
  const pagesToRead = routes.slice(0, PAGE_READ_CAP)
  const pageStrings = await readMany(pagesToRead, (route, content) => ({
    route,
    strings: extractHebrewStrings(content).slice(0, STRINGS_PER_FILE),
  }))

  // ...and component by component, where ~75% of it lives. Layouts first
  // (navigation labels), then components/, then any remaining UI files.
  const nonPageUi = paths.filter(
    (p) => COMPONENT_FILE.test(p) && !PAGE_OR_ROUTE.test(p)
  )
  const componentOrder = [
    ...nonPageUi.filter((p) => LAYOUT_FILE.test(p)),
    ...nonPageUi.filter((p) => !LAYOUT_FILE.test(p) && /(^|\/)components\//.test(p)),
    ...nonPageUi.filter((p) => !LAYOUT_FILE.test(p) && !/(^|\/)components\//.test(p)),
  ].slice(0, COMPONENT_READ_CAP)

  const perFile = await readMany(componentOrder, (path, content) => ({
    folder: folderOf(path),
    strings: extractHebrewStrings(content).slice(0, STRINGS_PER_FILE),
  }))

  // Group by folder and bound the total line count.
  const byFolder = new Map<string, string[]>()
  let stringBudget = COMPONENT_STRING_LINE_CAP
  for (const entry of perFile) {
    if (stringBudget <= 0) break
    if (!entry.strings.length) continue
    const kept = entry.strings.slice(0, stringBudget)
    stringBudget -= kept.length
    byFolder.set(entry.folder, [...new Set([...(byFolder.get(entry.folder) ?? []), ...kept])])
  }
  const componentStrings = [...byFolder.entries()].map(([folder, strings]) => ({ folder, strings }))

  return {
    allPaths: paths,
    pageStrings,
    componentStrings,
    docs,
    schema: schemaPath && schemaContent ? { path: schemaPath, content: schemaContent } : null,
    apiPaths,
    androidStrings,
    readme,
    i18n,
    dependencies,
    sourceNote:
      `routes=${pagesToRead.length}/${routes.length} ` +
      `components=${componentOrder.length}/${nonPageUi.length} ` +
      `docs=${docs.length}(${docs.map((d) => d.path).join(',')}) ` +
      `schema=${schemaPath ?? 'none'} api=${apiPaths.length} ` +
      `android=${androidPath ?? 'none'} i18n=${i18nPath ?? 'none'}`,
  }
}

const CARD_SYSTEM_PROMPT = `אתה כותב "כרטיס מוצר" עבור בוט תמיכה בוואטסאפ: תיאור סמכותי של מוצר שנבנה עבור לקוח, שיוזרק לפרומפט של הבוט בכל שיחה.

הקהל: הבוט מדבר עם הלקוח - אדם לא טכני שמשתמש במוצר יום-יום בעברית. כתוב עברית טבעית; השאר נתיבים ומזהים באנגלית.

מקורות הקלט ואיך להשתמש בהם:
- נתיבי מסכים ומחרוזות מהקוד - המציאות. שמות המסכים והמילון נבנים מהם.
- מחרוזות מרכיבי UI (לפי תיקייה) - רוב הטקסט שהלקוח רואה חי שם, לא בדפי הנתיב.
- מסמכי הפרויקט (CLAUDE/CONTEXT/עיצוב) - כוונה והקשר. מסמך מתאר כוונה; הקוד הוא המציאות. יכולת שמופיעה רק במסמך נכנסת בניסוח מסויג ("לפי התיעוד..."), ולעולם לא סותרת את "מה לא קיים" שנגזר מהקוד.
- סכמת הנתונים - שמות הישויות של התחום (הטבלאות והשדות הם המילים של המוצר).
- נתיבי API - רמזים ליכולות ולאינטגרציות בלבד, לא רשימת מסכים.
- strings.xml (אנדרואיד) - מסכי האפליקציה המובייל, כשקיימת.

יש לך כלי readRepoFile: הקלט שקיבלת הוא הבסיס; קרא קבצים נוספים רק כשמסך או תהליך נשארים לא ברורים ("העמוד מייבא ReportsTable - אקרא אותו"). עד ${'$'}{cap} קריאות.

מבנה קבוע (השתמש בכותרות האלה בדיוק):

## מה המוצר
פסקה אחת: מה המערכת עושה ולמי, במילים שהלקוח היה משתמש בהן.

## מסכים
לכל מסך משמעותי שורה: הנתיב -> שם עברי טבעי -> מה עושים בו. השתמש במחרוזות שנקצרו כדי לקרוא למסכים בשמות שהלקוח באמת רואה. דלג על מסכי עזר חסרי תוכן. אם יש אפליקציית מובייל - סעיף משנה למסכיה.

## תהליכים מרכזיים
2-5 תהליכים שהלקוח מבצע (הרשמה, הזנת נתונים, הפקת דוח...), כל אחד כרצף צעדים קצר בין מסכים.

## מילון
טבלת מונחים: המילה שעל המסך או שם ישות מהסכמה -> איפה זה חי (נתיב/מסך). רק מונחים שהופיעו בפועל בקלט.

## אינטגרציות
רק מה שמעיד עליו הקוד (תלויות, נתיבי API, מחרוזות): תשלומים, וואטסאפ, מייל, אחסון וכו'. אם אין - כתוב "אין אינטגרציות חיצוניות מוכרות".

## מה לא קיים
רשימה קצרה של דברים שלקוחות נוטים לבקש והמוצר הזה לא עושה - הסק מהיעדרם מהמסכים, מהסכמה ומהתלויות. נסח בזהירות: "לא נמצא במוצר", לא "בלתי אפשרי". סעיף זה נגזר מהקוד בלבד - מסמך שמבטיח יכולת שאין לה עדות בקוד אינו מבטל שורה כאן.

כללים:
- אל תמציא מסך, תהליך או יכולת שאין להם עדות בקלט. עדיף כרטיס קצר ונכון מארוך ומנחש.
- בלי שמות קבצים של קוד פנימי מחוץ לעמודת הנתיבים, בלי שמות פונקציות, בלי טכנולוגיות בגוף הטקסט.
- אורך יעד: 1,500-3,000 מילים עבריות לכל היותר; פחות זה בסדר.`

interface WrittenCard {
  cardHe: string
  explorerReads: number
}

async function writeCard(
  configured: ConfiguredRepo,
  harvest: Harvest
): Promise<WrittenCard | null> {
  const routeLines = harvest.pageStrings
    .map((page) => `- ${page.route}${page.strings.length ? ` | ${page.strings.join(' · ')}` : ''}`)
    .join('\n')

  const componentLines = harvest.componentStrings
    .map((group) => `- ${group.folder}: ${group.strings.join(' · ')}`)
    .join('\n')

  const docBlocks = harvest.docs
    .map((doc) => `--- מסמך: ${doc.path} ---\n${doc.content}`)
    .join('\n\n')

  const prompt = [
    `שם הפרויקט: ${configured.projectName}`,
    `נתיבי המסכים והמחרוזות העבריות שנמצאו בכל אחד:`,
    routeLines || '(לא נמצאו נתיבי מסכים)',
    componentLines ? `מחרוזות מרכיבי UI לפי תיקייה:\n${componentLines}` : null,
    harvest.schema ? `סכמת הנתונים (${harvest.schema.path}, קטוע):\n${harvest.schema.content}` : null,
    harvest.apiPaths.length ? `נתיבי API:\n${harvest.apiPaths.map((p) => `- ${p}`).join('\n')}` : null,
    harvest.androidStrings ? `strings.xml של אפליקציית האנדרואיד (קטוע):\n${harvest.androidStrings}` : null,
    harvest.i18n ? `קובץ תרגומים (he.json, קטוע):\n${harvest.i18n}` : null,
    docBlocks || null,
    harvest.readme ? `README (קטוע):\n${harvest.readme}` : null,
    harvest.dependencies.length ? `תלויות: ${harvest.dependencies.join(', ')}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n')

  // The writer's bounded exploration: the harvest is the guaranteed baseline,
  // and the model may chase what it decides is missing. Offline and nightly,
  // so the latency is free; the path check keeps it inside this repo's tree.
  const knownPaths = new Set(harvest.allPaths)
  let explorerReads = 0

  const readRepoFile = tool({
    description:
      'קרא קובץ מהריפו כשמסך או תהליך נשארים לא ברורים מהקלט. הקלט שקיבלת הוא הבסיס - קרא רק מה שחסר.',
    inputSchema: z.object({ path: z.string().describe('נתיב מדויק מתוך עץ הקבצים') }),
    execute: async ({ path }) => {
      if (!knownPaths.has(path)) {
        return { success: false, message: 'הנתיב לא קיים בריפו הזה.' }
      }
      const result = await GitHubService.readFile(configured.repo, path)
      if (!result.ok) return { success: false, message: result.error }
      explorerReads += 1
      return { success: true, path, content: result.data.content }
    },
  })

  try {
    const result = await generateText({
      model: gateway(MODEL),
      system: CARD_SYSTEM_PROMPT.replace('${cap}', String(WRITER_STEP_CAP - 2)),
      prompt,
      tools: { readRepoFile },
      stopWhen: stepCountIs(WRITER_STEP_CAP),
    })
    const cardHe = result.text.trim()
    return cardHe ? { cardHe, explorerReads } : null
  } catch (error) {
    console.error(`Card generation failed for ${configured.projectName}:`, error)
    return null
  }
}
