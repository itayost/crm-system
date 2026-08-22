# Collectable Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give "money owed" one module, so the badge, the היום board, `/money`, the dashboard and the portal cannot disagree.

**Architecture:** A pure, browser-safe core (`lib/money/ledger.ts`) derives a `LedgerState` per entry and owns every money predicate. A server module (`lib/money/ledger.server.ts`) owns two coarse loaders whose `where` clauses are guaranteed supersets of any predicate, so they affect only how many rows travel, never the answer. `lib/money/project.ts` keeps the three existing per-project signatures as a facade over the core.

**Tech Stack:** Next.js 15, Prisma 6, TypeScript strict, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-21-collectable-ledger-design.md`

## Global Constraints

- TypeScript strict mode. No `any`.
- All UI text Hebrew, layout RTL. Currency ILS via the existing `formatCurrency`.
- Hebrew labels only via `lib/design/labels.ts`; tones only via `lib/design/tones.ts`. Never inline a raw Tailwind palette class: `tests/design-tones.test.ts` fails the build on one.
- Every Prisma query in the new server module is scoped by `userId`.
- No new dependencies.
- `lib/money/ledger.ts` and `lib/money/project.ts` must stay dependency-free so client components can import them. No Prisma import, no `server-only`.
- Amounts arrive as Prisma `Decimal` on the server and as strings after JSON. Every entry point must accept both.
- Run `npm test` and `npm run typecheck` before every commit.

---

### Task 1: The pure core

**Files:**
- Create: `lib/money/ledger.ts`
- Test: `tests/money-ledger.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Money`, `PhaseAmount`, `LedgerKind`, `LedgerState`, `LedgerEntry`, `phaseEntry`, `advanceEntry`, `entriesOf`, `isCollectable`, `isSignedOffUnpaid`, `isAwaitingApproval`, `isPaid`, `collectable`, `signedOffUnpaid`, `awaitingApproval`, `received`, `agreed`, `receivedSince`.

- [ ] **Step 1: Write the failing test**

Create `tests/money-ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  advanceEntry,
  agreed,
  awaitingApproval,
  collectable,
  entriesOf,
  isCollectable,
  phaseEntry,
  received,
  receivedSince,
  signedOffUnpaid,
  type LedgerEntry,
} from '@/lib/money/ledger'

const phase = (status: string, paidAt: string | null = null, price = 100) =>
  phaseEntry({ price, status, paidAt })

describe('state derivation', () => {
  it('reads an unpaid advance as collectable - it is owed on signature', () => {
    expect(advanceEntry(500, null)?.state).toBe('collectable')
  })

  it('reads a paid advance as paid', () => {
    expect(advanceEntry(500, '2026-08-01T00:00:00.000Z')?.state).toBe('paid')
  })

  it('has no entry at all for a project without an advance', () => {
    expect(advanceEntry(0, null)).toBeNull()
    expect(advanceEntry(null, null)).toBeNull()
  })

  it('never gives an advance a phase status', () => {
    expect(advanceEntry(500, null)?.phaseStatus).toBeNull()
  })

  it('maps every phase status to a state', () => {
    expect(phase('NOT_STARTED').state).toBe('scheduled')
    expect(phase('IN_PROGRESS').state).toBe('inProgress')
    expect(phase('REVISIONS').state).toBe('inProgress')
    expect(phase('PENDING_APPROVAL').state).toBe('awaitingClient')
    expect(phase('APPROVED').state).toBe('collectable')
  })

  it('treats REVISIONS as the owner working, not the client waiting', () => {
    expect(phase('REVISIONS').state).toBe(phase('IN_PROGRESS').state)
  })

  it('lets payment win over any status', () => {
    expect(phase('APPROVED', '2026-08-01T00:00:00.000Z').state).toBe('paid')
    expect(phase('PENDING_APPROVAL', '2026-08-01T00:00:00.000Z').state).toBe('paid')
  })

  it('accepts the string Decimals that arrive over JSON', () => {
    expect(phaseEntry({ price: '250.00', status: 'APPROVED' }).price).toBe(250)
  })

  it('accepts a Date for paidAt and normalises it to an ISO string', () => {
    const entry = phaseEntry({ price: 1, status: 'APPROVED', paidAt: new Date('2026-08-01') })
    expect(entry.paidAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('reads an unknown status as scheduled rather than throwing', () => {
    expect(phase('WHAT_IS_THIS').state).toBe('scheduled')
  })
})

describe('the two concepts stay distinct', () => {
  const entries = entriesOf(1000, null, [
    { price: 300, status: 'APPROVED' },
    { price: 400, status: 'PENDING_APPROVAL' },
    { price: 500, status: 'APPROVED', paidAt: '2026-08-01T00:00:00.000Z' },
  ])

  it('collectable counts the unpaid advance and the approved unpaid phase', () => {
    expect(collectable(entries)).toBe(1300)
  })

  it('signedOffUnpaid counts the phase only, never the advance', () => {
    expect(signedOffUnpaid(entries)).toBe(300)
  })

  it('awaitingApproval counts what is sitting with the client', () => {
    expect(awaitingApproval(entries)).toBe(400)
  })

  it('received counts only money that arrived', () => {
    expect(received(entries)).toBe(500)
  })

  it('agreed counts everything the client signed up for', () => {
    expect(agreed(entries)).toBe(2200)
  })
})

describe('receivedSince', () => {
  it('counts payments on or after the boundary', () => {
    const entries = entriesOf(null, null, [
      { price: 100, status: 'APPROVED', paidAt: '2026-08-01T00:00:00.000Z' },
      { price: 200, status: 'APPROVED', paidAt: '2026-07-31T23:59:59.000Z' },
    ])
    expect(receivedSince(entries, new Date('2026-08-01T00:00:00.000Z'))).toBe(100)
  })
})

describe('the rule that makes a prefilter sound', () => {
  const every: LedgerEntry[] = [
    ...['NOT_STARTED', 'IN_PROGRESS', 'REVISIONS', 'PENDING_APPROVAL', 'APPROVED'].flatMap((s) => [
      phase(s, null),
      phase(s, '2026-08-01T00:00:00.000Z'),
    ]),
    advanceEntry(500, null)!,
    advanceEntry(500, '2026-08-01T00:00:00.000Z')!,
  ]

  /**
   * openLedger() prefilters to `paidAt: null`. That is only safe while nothing
   * collectable carries a payment date. If this ever fails, the badge silently
   * starts under-reporting and no other test will catch it.
   */
  it('never marks a paid entry collectable', () => {
    for (const entry of every) {
      if (isCollectable(entry)) expect(entry.paidAt).toBeNull()
    }
    expect(every.some(isCollectable)).toBe(true)
  })
})

describe('empty and absent input', () => {
  it('is zero rather than NaN throughout', () => {
    expect(collectable([])).toBe(0)
    expect(received([])).toBe(0)
    expect(agreed(entriesOf(null, null, []))).toBe(0)
    expect(agreed(entriesOf(undefined, undefined))).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/money-ledger.test.ts`
Expected: FAIL, cannot resolve `@/lib/money/ledger`.

- [ ] **Step 3: Write the implementation**

Create `lib/money/ledger.ts`:

```ts
/**
 * What is owed, what arrived, and what the client agreed to pay.
 *
 * One module, because this question used to have four implementations that
 * agreed only because a test grepped their source for matching string
 * literals - and before that test existed, the כספים badge and the /money page
 * it links to disagreed by ₪3,000 in production.
 *
 * Pure and dependency-free on purpose: six of the nine surfaces that ask these
 * questions are client components computing from JSON. Nothing here may import
 * Prisma. The server-side loaders live in ./ledger.server.
 */

/**
 * A Prisma Decimal on the server, the string JSON turned it into on the
 * client, or a plain number. Structurally typed rather than importing
 * Prisma.Decimal, so this module stays safe to import from a client component.
 */
interface DecimalLike {
  toFixed(digits?: number): string
}

export type Money = number | string | DecimalLike | null | undefined

export interface PhaseAmount {
  price: Money
  status?: string
  paidAt?: string | Date | null
}

export type LedgerKind = 'phase' | 'advance'

/**
 * Where one billable thing stands. Derived, never stored, and deliberately not
 * PhaseStatus: a מקדמה has no approval step, so it can never have one.
 */
export type LedgerState =
  | 'scheduled'
  | 'inProgress'
  | 'awaitingClient'
  | 'collectable'
  | 'paid'

export interface LedgerEntry {
  kind: LedgerKind
  state: LedgerState
  price: number
  paidAt: string | null
  /** Phases only. Null on an advance, which has no status to carry. */
  phaseStatus: string | null
}

function amount(value: Money): number {
  if (value == null) return 0
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

/**
 * REVISIONS is the owner's turn, not the client's, so it reads as work in
 * progress. The client is told the same thing by client-view.ts, and the two
 * must not diverge.
 */
const PHASE_STATE: Record<string, LedgerState> = {
  NOT_STARTED: 'scheduled',
  IN_PROGRESS: 'inProgress',
  REVISIONS: 'inProgress',
  PENDING_APPROVAL: 'awaitingClient',
  APPROVED: 'collectable',
}

export function phaseEntry(phase: PhaseAmount): LedgerEntry {
  const paidAt = iso(phase.paidAt)

  return {
    kind: 'phase',
    // Payment wins over status: an approved phase already settled is not owed.
    state: paidAt ? 'paid' : (PHASE_STATE[phase.status ?? ''] ?? 'scheduled'),
    price: amount(phase.price),
    paidAt,
    phaseStatus: phase.status ?? null,
  }
}

/**
 * A מקדמה is owed on signature rather than on sign-off, so an unpaid one is
 * collectable the moment the project exists. Returns null when there is no
 * advance, so callers never carry a zero row.
 */
export function advanceEntry(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
): LedgerEntry | null {
  const price = amount(advance)
  if (price <= 0) return null

  const paidAt = iso(advancePaidAt)

  return { kind: 'advance', state: paidAt ? 'paid' : 'collectable', price, paidAt, phaseStatus: null }
}

export function entriesOf(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
  phases: PhaseAmount[] = [],
): LedgerEntry[] {
  const advanceRow = advanceEntry(advance, advancePaidAt)
  const phaseRows = phases.map(phaseEntry)

  return advanceRow ? [advanceRow, ...phaseRows] : phaseRows
}

export const isCollectable = (entry: LedgerEntry): boolean => entry.state === 'collectable'
/** Work signed off and unpaid. Excludes the advance: see לתשלום in CONTEXT.md. */
export const isSignedOffUnpaid = (entry: LedgerEntry): boolean =>
  entry.kind === 'phase' && entry.state === 'collectable'
export const isAwaitingApproval = (entry: LedgerEntry): boolean => entry.state === 'awaitingClient'
export const isPaid = (entry: LedgerEntry): boolean => entry.state === 'paid'

const sum = (entries: LedgerEntry[]): number => entries.reduce((total, e) => total + e.price, 0)

/** גבייה: everything invoiceable right now, advances included. */
export function collectable(entries: LedgerEntry[]): number {
  return sum(entries.filter(isCollectable))
}

/** לתשלום: signed-off unpaid work on one project, advance excluded. */
export function signedOffUnpaid(entries: LedgerEntry[]): number {
  return sum(entries.filter(isSignedOffUnpaid))
}

export function awaitingApproval(entries: LedgerEntry[]): number {
  return sum(entries.filter(isAwaitingApproval))
}

/** Money that actually arrived. */
export function received(entries: LedgerEntry[]): number {
  return sum(entries.filter(isPaid))
}

/** Everything the client agreed to pay, whatever state it is in. */
export function agreed(entries: LedgerEntry[]): number {
  return sum(entries)
}

export function receivedSince(entries: LedgerEntry[], since: Date): number {
  return sum(entries.filter((e) => e.paidAt !== null && new Date(e.paidAt) >= since))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/money-ledger.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/money/ledger.ts tests/money-ledger.test.ts
git commit -m "feat(money): one module for what is owed, received and agreed"
```

---

### Task 2: The per-project facade

Re-implement the three existing functions over the core and move them into `lib/money/`. Signatures do not change, so no call expression changes; only import paths move.

**Files:**
- Create: `lib/money/project.ts`
- Delete: `lib/utils/project-money.ts`
- Modify (import path only): `lib/services/client-view.ts:29`, `lib/services/whatsapp-tools.ts:17`, `app/(dashboard)/page.tsx:30`, `app/(dashboard)/clients/page.tsx:25-29`, `app/(dashboard)/clients/[id]/page.tsx:34`, `app/(dashboard)/projects/page.tsx:39`, `app/(dashboard)/projects/[id]/page.tsx:49`, `components/patterns/phase-strip.tsx:5`, `components/contacts/contact-projects-card.tsx:11`, `components/projects/phases-card.tsx:32`
- Test: `tests/project-money.test.ts` (import path only; all 18 assertions unchanged)

**Interfaces:**
- Consumes: `agreed`, `received`, `signedOffUnpaid`, `entriesOf`, `PhaseAmount`, `Money` from Task 1.
- Produces: `projectTotal(advance: Money, phases?: PhaseAmount[]): number`, `projectPaid(advance: Money, advancePaidAt: string | Date | null | undefined, phases?: PhaseAmount[]): number`, `projectOutstanding(phases?: PhaseAmount[]): number`, plus re-exported `Money` and `PhaseAmount`.

- [ ] **Step 1: Point the existing test at the new path**

In `tests/project-money.test.ts` line 6, change `'@/lib/utils/project-money'` to `'@/lib/money/project'`. Change nothing else. These 18 assertions are the regression guard proving the portal figure is bit-identical.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/project-money.test.ts`
Expected: FAIL, cannot resolve `@/lib/money/project`.

- [ ] **Step 3: Write the facade**

Create `lib/money/project.ts`:

```ts
/**
 * The project-scoped surface of the ledger.
 *
 * These three names predate the ledger module and are used at 25 call sites,
 * six of them in the browser. They keep their exact signatures and defer every
 * decision to ./ledger, so per-project figures and owner-wide figures cannot
 * drift apart. projectOutstanding stays deliberately narrower than
 * collectable(): see לתשלום in CONTEXT.md.
 */
import {
  agreed,
  entriesOf,
  received,
  signedOffUnpaid,
  type Money,
  type PhaseAmount,
} from '@/lib/money/ledger'

export type { Money, PhaseAmount }

/** Everything the client has agreed to pay: the advance plus every phase. */
export function projectTotal(advance: Money, phases: PhaseAmount[] = []): number {
  return agreed(entriesOf(advance, null, phases))
}

/**
 * Money actually received. Payment is tracked separately from approval - an
 * approved phase is finished work, not a settled invoice.
 */
export function projectPaid(
  advance: Money,
  advancePaidAt: string | Date | null | undefined,
  phases: PhaseAmount[] = [],
): number {
  return received(entriesOf(advance, advancePaidAt, phases))
}

/** Work signed off but not paid for. Never the advance. */
export function projectOutstanding(phases: PhaseAmount[] = []): number {
  return signedOffUnpaid(entriesOf(null, null, phases))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/project-money.test.ts`
Expected: PASS, 18 tests, including "פרויקט אתר still totals 5,000" and "פרויקט אפליקציה still totals 15,000".

- [ ] **Step 5: Move every import and delete the old file**

```bash
grep -rl "@/lib/utils/project-money" lib app components \
  | xargs sed -i '' "s|@/lib/utils/project-money|@/lib/money/project|g"
rm lib/utils/project-money.ts
grep -rn "utils/project-money" . --include='*.ts' --include='*.tsx' | grep -v node_modules
```

Expected from the final grep: no output.

- [ ] **Step 6: Verify nothing else moved**

Run: `npm run typecheck && npm test`
Expected: PASS. `tests/money-agreement.test.ts` still passes at this point; it reads `lib/utils/project-money.ts` at line 40, so if it fails with ENOENT, update that one path to `lib/money/project.ts`. It is deleted in Task 7.

- [ ] **Step 7: Commit**

```bash
git add -A lib/money lib/utils lib/services app components tests
git commit -m "refactor(money): per-project figures defer to the ledger core"
```

---

### Task 3: The server loaders

**Files:**
- Create: `lib/money/ledger.server.ts`
- Test: `tests/money-ledger-server.test.ts`

**Interfaces:**
- Consumes: `advanceEntry`, `phaseEntry`, `LedgerEntry` from Task 1.
- Produces: `LedgerScope { userId: string; clientId?: string; projectId?: string }`, `LedgerRow extends LedgerEntry` with `id`, `projectId`, `projectName`, `clientId`, `clientName`, `name`, `approvedAt`; `openLedger(scope): Promise<LedgerRow[]>`, `fullLedger(scope): Promise<LedgerRow[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/money-ledger-server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = { project: { findMany: vi.fn() } }
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { openLedger, fullLedger } = await import('@/lib/money/ledger.server')
const { collectable } = await import('@/lib/money/ledger')

const PROJECT = {
  id: 'p1',
  name: 'אתר',
  advanceAmount: 1000,
  advancePaidAt: null,
  client: { id: 'c1', name: 'לקוח' },
  phases: [
    { id: 'ph1', name: 'עיצוב', status: 'APPROVED', price: 300, approvedAt: new Date('2026-08-01'), paidAt: null },
  ],
}

describe('scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('always scopes by userId', async () => {
    await fullLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' })
  })

  it('narrows to one client when asked', async () => {
    await fullLedger({ userId: 'u1', clientId: 'c1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', clientId: 'c1' })
  })

  it('narrows to one project when asked', async () => {
    await fullLedger({ userId: 'u1', projectId: 'p1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', id: 'p1' })
  })
})

describe('the prefilter is performance, not meaning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('asks the database for unpaid phases only on the open ledger', async () => {
    await openLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].select.phases.where).toEqual({ paidAt: null })
  })

  it('asks for every phase on the full ledger', async () => {
    await fullLedger({ userId: 'u1' })
    expect(prismaMock.project.findMany.mock.calls[0][0].select.phases.where).toBeUndefined()
  })

  it('reaches the same collectable total either way', async () => {
    const open = await openLedger({ userId: 'u1' })
    const full = await fullLedger({ userId: 'u1' })
    expect(collectable(open)).toBe(collectable(full))
    expect(collectable(open)).toBe(1300)
  })
})

describe('rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findMany.mockResolvedValue([PROJECT])
  })

  it('carries the advance as its own row, named in Hebrew', async () => {
    const rows = await fullLedger({ userId: 'u1' })
    const advance = rows.find((r) => r.kind === 'advance')
    expect(advance).toMatchObject({ id: 'advance:p1', name: 'מקדמה', price: 1000, state: 'collectable' })
    expect(advance?.phaseStatus).toBeNull()
  })

  it('drops a paid advance from the open ledger', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { ...PROJECT, advancePaidAt: new Date('2026-08-01'), phases: [] },
    ])
    expect(await openLedger({ userId: 'u1' })).toHaveLength(0)
  })

  it('omits the advance row entirely when there is no advance', async () => {
    prismaMock.project.findMany.mockResolvedValue([{ ...PROJECT, advanceAmount: 0 }])
    const rows = await fullLedger({ userId: 'u1' })
    expect(rows.every((r) => r.kind === 'phase')).toBe(true)
  })

  it('carries project and client identity on every row', async () => {
    const rows = await fullLedger({ userId: 'u1' })
    for (const row of rows) {
      expect(row).toMatchObject({ projectId: 'p1', projectName: 'אתר', clientId: 'c1', clientName: 'לקוח' })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/money-ledger-server.test.ts`
Expected: FAIL, cannot resolve `@/lib/money/ledger.server`.

- [ ] **Step 3: Write the implementation**

Create `lib/money/ledger.server.ts`:

```ts
/**
 * Loading the ledger. Server only - the predicates live in ./ledger, which the
 * browser also runs.
 *
 * Two loaders, differing only in how many rows travel. The `where` clauses here
 * are guaranteed supersets of anything ./ledger can match, so a prefilter can
 * never change an answer. The rule that makes openLedger sound is asserted
 * directly in tests/money-ledger.test.ts: nothing collectable carries a payment
 * date, so filtering to unpaid rows cannot drop one.
 *
 * getBadges runs on every route change and every 120 seconds, which is why the
 * open ledger exists at all rather than everything using fullLedger.
 */
import { prisma } from '@/lib/db/prisma'
import { advanceEntry, phaseEntry, type LedgerEntry } from '@/lib/money/ledger'

export interface LedgerScope {
  userId: string
  clientId?: string
  projectId?: string
}

export interface LedgerRow extends LedgerEntry {
  id: string
  projectId: string
  projectName: string
  clientId: string | null
  clientName: string | null
  name: string
  approvedAt: string | null
}

const ADVANCE_NAME = 'מקדמה'

async function load(scope: LedgerScope, unpaidOnly: boolean): Promise<LedgerRow[]> {
  const projects = await prisma.project.findMany({
    where: {
      userId: scope.userId,
      ...(scope.clientId ? { clientId: scope.clientId } : {}),
      ...(scope.projectId ? { id: scope.projectId } : {}),
    },
    select: {
      id: true,
      name: true,
      advanceAmount: true,
      advancePaidAt: true,
      client: { select: { id: true, name: true } },
      phases: {
        where: unpaidOnly ? { paidAt: null } : undefined,
        select: {
          id: true,
          name: true,
          status: true,
          price: true,
          approvedAt: true,
          paidAt: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows: LedgerRow[] = []

  for (const project of projects) {
    const base = {
      projectId: project.id,
      projectName: project.name,
      clientId: project.client?.id ?? null,
      clientName: project.client?.name ?? null,
    }

    const advance = advanceEntry(project.advanceAmount, project.advancePaidAt)
    // The phase prefilter is a database concern; the advance lives on the
    // project row, so its equivalent has to happen here.
    if (advance && !(unpaidOnly && advance.paidAt)) {
      rows.push({ ...base, ...advance, id: `advance:${project.id}`, name: ADVANCE_NAME, approvedAt: null })
    }

    for (const phase of project.phases) {
      rows.push({
        ...base,
        ...phaseEntry(phase),
        id: phase.id,
        name: phase.name,
        approvedAt: phase.approvedAt?.toISOString() ?? null,
      })
    }
  }

  return rows
}

/** Unpaid rows only. Enough for גבייה, and bounded by what is still owed. */
export function openLedger(scope: LedgerScope): Promise<LedgerRow[]> {
  return load(scope, true)
}

/** Every row, paid history included. Needed for received() and the /money page. */
export function fullLedger(scope: LedgerScope): Promise<LedgerRow[]> {
  return load(scope, false)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/money-ledger-server.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/money/ledger.server.ts tests/money-ledger-server.test.ts
git commit -m "feat(money): two ledger loaders whose prefilters cannot change an answer"
```

---

### Task 4: Migrate MoneyService and the /money page

**Files:**
- Modify: `lib/services/money.service.ts` (replace the body of `getLedger`, keep `startOfIsraelMonth` exactly as it is)
- Modify: `lib/design/labels.ts` (add `LEDGER_STATE_LABELS`)
- Modify: `lib/design/tones.ts` (add `LEDGER_STATE_TONES`)
- Modify: `app/(dashboard)/money/page.tsx:55-64, 76-79, 100-112, 135`

**Interfaces:**
- Consumes: `fullLedger`, `LedgerRow` (Task 3); `collectable`, `awaitingApproval`, `receivedSince`, `isCollectable`, `isAwaitingApproval`, `isPaid` (Task 1).
- Produces: `Ledger { rows: LedgerRow[]; totals: { due: number; awaiting: number; paidThisMonth: number } }`. `LedgerRow` is now the one from `lib/money/ledger.server`; the locally-declared `LedgerRow` and `LedgerView` in `money.service.ts` are removed and re-exported from the new home.

- [ ] **Step 1: Add the state labels and tones**

In `lib/design/labels.ts`, after `PHASE_STATUS_LABELS` (line 157):

```ts
/**
 * How one billable thing reads on the money screens. Keyed by LedgerState, not
 * PhaseStatus, because a מקדמה has no phase status and used to borrow APPROVED.
 */
export const LEDGER_STATE_LABELS: Record<string, string> = {
  scheduled: 'לא פעיל',
  inProgress: 'בעבודה',
  awaitingClient: 'ממתין לאישור לקוח',
  collectable: 'לגבייה',
  paid: 'שולם',
}
```

In `lib/design/tones.ts`, after `PHASE_STATUS_TONES` (line 109):

```ts
/**
 * Money is not a status: an unpaid invoice is not a success just because the
 * work behind it was approved. collectable is the one that wants attention.
 */
export const LEDGER_STATE_TONES: Record<string, Tone> = {
  scheduled: 'neutral',
  inProgress: 'progress',
  awaitingClient: 'caution',
  collectable: 'warning',
  paid: 'success',
}
```

- [ ] **Step 2: Register the new map with the tones guard**

`ALL_MAPS` in `tests/design-tones.test.ts:33-47` is a hand-maintained registry of 13 maps. A map that is not listed there is not checked at all, so add it to the import block at the top of that file and to the registry, keeping both alphabetical:

```ts
  LEDGER_STATE_TONES,
```

- [ ] **Step 3: Run the design guard**

Run: `npx vitest run tests/design-tones.test.ts`
Expected: PASS, and `ALL_MAPS` now has 14 entries. If "only ever name a real tone" fails, a value added in Step 1 is not in the `Tone` union at `lib/design/tones.ts:12-20`.

- [ ] **Step 4: Rewrite MoneyService.getLedger**

Replace lines 16-35 and 67-148 of `lib/services/money.service.ts`. Keep lines 42-65 (`DAY_MS`, `startOfIsraelMonth`) byte-for-byte.

```ts
import { startOfIsraelDay } from '@/lib/services/morning-brief.service'
import { fullLedger, type LedgerRow } from '@/lib/money/ledger.server'
import { awaitingApproval, collectable, receivedSince } from '@/lib/money/ledger'

export type { LedgerRow }
export type LedgerView = 'due' | 'awaiting' | 'paid' | 'all'

export interface Ledger {
  rows: LedgerRow[]
  totals: { due: number; awaiting: number; paidThisMonth: number }
}

// ... DAY_MS and startOfIsraelMonth unchanged ...

export class MoneyService {
  static async getLedger(userId: string): Promise<Ledger> {
    const rows = await fullLedger({ userId })
    const startOfMonth = startOfIsraelMonth(new Date())

    return {
      rows,
      totals: {
        due: collectable(rows),
        awaiting: awaitingApproval(rows),
        paidThisMonth: receivedSince(rows, startOfMonth),
      },
    }
  }
}
```

Delete the now-unused `prisma` import, the `num` helper, and the whole synthetic-row loop.

- [ ] **Step 5: Update the /money page to ask the core**

In `app/(dashboard)/money/page.tsx`:

Replace the imports at lines 20-21:
```ts
import { toneOf, LEDGER_STATE_TONES } from '@/lib/design/tones'
import { label, LEDGER_STATE_LABELS } from '@/lib/design/labels'
import { isAwaitingApproval, isCollectable, isPaid } from '@/lib/money/ledger'
```

Replace the buckets at lines 57-64:
```ts
  const buckets = useMemo(
    () => ({
      due: all.filter(isCollectable),
      awaiting: all.filter(isAwaitingApproval),
      paid: all.filter(isPaid),
      all,
    }),
    [all],
  )
```

Replace the status cell at lines 101-112:
```ts
    {
      key: 'status',
      header: 'מצב',
      mobile: 'trailing',
      cell: (r) => (
        <StatusPill tone={toneOf(LEDGER_STATE_TONES, r.state)} dot>
          {label(LEDGER_STATE_LABELS, r.state)}
        </StatusPill>
      ),
    },
```

Replace the action predicate at line 135:
```ts
      cell: (r) =>
        isCollectable(r) && r.kind === 'phase' ? (
```

Leave `markPaid`'s advance guard at lines 76-79 as it is: a מקדמה really is marked paid from the project page, and that is a routing fact, not a predicate.

- [ ] **Step 6: Verify**

```bash
npm run typecheck
npx vitest run
```
Expected: PASS. `tests/money-agreement.test.ts` will now FAIL its "counts unpaid approved phases on both sides" assertion, because `money.service.ts` no longer contains the literal `r.status === 'APPROVED' && !r.paidAt`. That is the refactor working. Task 7 deletes it. To keep the suite green in between, run `npx vitest run --exclude tests/money-agreement.test.ts`.

- [ ] **Step 7: Check the screen**

```bash
npm run dev
```
Open `/money`. Confirm: the four segment counts are unchanged from before the change; an advance row reads מקדמה with the label לגבייה rather than a phase label; an approved unpaid phase reads לגבייה in `warning` rather than אושר in `success`.

- [ ] **Step 8: Commit**

```bash
git add lib/services/money.service.ts lib/design/labels.ts lib/design/tones.ts "app/(dashboard)/money/page.tsx"
git commit -m "refactor(money): the ledger page reads one set of predicates"
```

---

### Task 5: Migrate TodayService

**Files:**
- Modify: `lib/services/today.service.ts:73-81` (the `collect` type), `:167-189` (the two collect queries), `:190-207` (the collect assembly), `:258-285` (the badge queries and the outstanding reduce)

**Interfaces:**
- Consumes: `openLedger` (Task 3), `collectable`, `isCollectable` (Task 1).
- Produces: `TodayBadges.outstanding` and `TodayBoard.collect` unchanged in shape. `collect` entries keep `{ id, projectId, projectName, clientName, name, price, kind }`, so `app/(dashboard)/page.tsx` needs no change.

- [ ] **Step 1: Replace the board's collect**

In `lib/services/today.service.ts`, delete the `prisma.projectPhase.findMany` and `prisma.project.findMany` entries from `getBoard`'s `Promise.all` (lines 167-189) and their destructured names `phases` and `advances`.

After the `Promise.all`, replace the `collect` assembly (lines 190-207) with:

```ts
    const collect: TodayBoard['collect'] = (await openLedger({ userId }))
      .filter(isCollectable)
      .map((row) => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        clientName: row.clientName,
        name: row.name,
        price: row.price,
        kind: row.kind,
      }))
      .sort((a, b) => b.price - a.price)
```

- [ ] **Step 2: Replace the badge's outstanding**

In `getBadges`, delete the `unpaidPhases` and `unpaidAdvances` entries from the `Promise.all` (lines 258-283, including the long comment block) and their destructured names. Replace the reduce at lines 281-283 with a call alongside the remaining counts:

```ts
    const [triageRequests, dueTasks, dueLeads, ledger] = await Promise.all([
      prisma.request.count({ where: { userId, status: 'PENDING_REVIEW' } }),
      prisma.task.count({
        where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: todayEnd } },
      }),
      prisma.contact.count({
        where: { userId, status: { in: [...LEAD_STATUSES] }, nextActionAt: { lt: todayEnd } },
      }),
      openLedger({ userId }),
    ])

    return {
      triageRequests,
      dueTasks,
      dueLeads,
      outstanding: collectable(ledger),
      botPaused: isBotPaused(),
    }
```

Add to the imports at the top:
```ts
import { openLedger } from '@/lib/money/ledger.server'
import { collectable, isCollectable } from '@/lib/money/ledger'
```

- [ ] **Step 3: Update the doc comment that named the old rule**

The `TodayBadges.outstanding` docstring at line 25 says "Approved but unpaid, in shekels." Replace with:

```ts
  /** גבייה: everything invoiceable now, unpaid מקדמות included. */
  outstanding: number
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npx vitest run --exclude tests/money-agreement.test.ts
```
Expected: PASS.

- [ ] **Step 5: Check both screens agree**

```bash
npm run dev
```
Open any page. Read the כספים nav badge. Open `/money` and read the לגבייה total. Open the dashboard and read the לגבייה figure on the collect block. All three must be the same number. That is the ₪3,000 incident, checked by hand one last time before the test that guarded it is deleted.

- [ ] **Step 6: Commit**

```bash
git add lib/services/today.service.ts
git commit -m "refactor(money): the badge and the board read the ledger"
```

---

### Task 6: Delete the dead KPI, migrate revenue

**Files:**
- Modify: `lib/services/dashboard.service.ts:6-12` (destructuring), `:25-37` (the three aggregates), `:103-105` (the return)
- Modify: `app/(dashboard)/page.tsx:59` (drop `outstanding` from `DashboardData`)
- Modify: `tests/dashboard-revenue.test.ts` (delete two tests, rewrite the mock setup)

**Interfaces:**
- Consumes: `fullLedger` (Task 3), `received` (Task 1).
- Produces: `DashboardService.getData` returns the same object minus `outstanding`.

- [ ] **Step 1: Rewrite the test first**

In `tests/dashboard-revenue.test.ts`: delete the tests "reports approved-but-unpaid separately" (line 51) and "counts outstanding as approved and unpaid, not merely unpaid" (line 66). Delete the `PAID_PHASES` / `APPROVED_UNPAID` constants. Replace the prisma mock and `beforeEach` with:

```ts
const prismaMock = {
  project: { count: vi.fn(), findMany: vi.fn() },
  contact: { count: vi.fn() },
  client: { count: vi.fn() },
  task: { count: vi.fn(), findMany: vi.fn() },
  request: { count: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const ledgerMock = vi.fn()
vi.mock('@/lib/money/ledger.server', () => ({ fullLedger: ledgerMock }))

const { DashboardService } = await import('@/lib/services/dashboard.service')

describe('dashboard revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ledgerMock.mockResolvedValue([])
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.project.findMany.mockResolvedValue([])
    prismaMock.contact.count.mockResolvedValue(0)
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.task.count.mockResolvedValue(0)
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.request.count.mockResolvedValue(0)
  })

  it('sums paid phases and paid advances', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'phase', state: 'paid', price: 2500, paidAt: '2026-08-01T00:00:00.000Z', phaseStatus: 'APPROVED' },
      { kind: 'advance', state: 'collectable', price: 1000, paidAt: null, phaseStatus: null },
    ])
    const data = await DashboardService.getData('u1')
    expect(data.revenue).toBe(2500)
  })

  it('counts a paid advance', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'advance', state: 'paid', price: 1000, paidAt: '2026-08-01T00:00:00.000Z', phaseStatus: null },
    ])
    expect((await DashboardService.getData('u1')).revenue).toBe(1000)
  })

  it('never counts approval as payment', async () => {
    ledgerMock.mockResolvedValue([
      { kind: 'phase', state: 'collectable', price: 1500, paidAt: null, phaseStatus: 'APPROVED' },
    ])
    expect((await DashboardService.getData('u1')).revenue).toBe(0)
  })

  it('reads zero rather than NaN when nothing has been paid', async () => {
    expect((await DashboardService.getData('u1')).revenue).toBe(0)
  })

  it('no longer reports an outstanding figure', async () => {
    expect('outstanding' in (await DashboardService.getData('u1'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-revenue.test.ts`
Expected: FAIL, `data.revenue` is 0 because the service still reads aggregates, and `outstanding` is still present.

- [ ] **Step 3: Change the service**

In `lib/services/dashboard.service.ts`: remove `paidPhases`, `paidAdvances` and `approvedUnpaid` from the destructuring and delete their three `prisma.*.aggregate` calls (lines 25-37). Add `fullLedger({ userId })` as the first entry of the `Promise.all`, destructured as `ledger`. Replace the return's first two fields with:

```ts
      revenue: received(ledger),
```

Add the imports:
```ts
import { fullLedger } from '@/lib/money/ledger.server'
import { received } from '@/lib/money/ledger'
```

- [ ] **Step 4: Drop the field from the page type**

In `app/(dashboard)/page.tsx`, delete line 59 (`outstanding: number`). Nothing renders it, so no JSX changes.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/dashboard-revenue.test.ts
npm run typecheck
```
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/services/dashboard.service.ts "app/(dashboard)/page.tsx" tests/dashboard-revenue.test.ts
git commit -m "refactor(money): dashboard revenue reads the ledger, dead KPI removed"
```

---

### Task 7: Retire the grep test and verify end to end

**Files:**
- Delete: `tests/money-agreement.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Confirm the predicate exists in exactly one place**

```bash
grep -rn "APPROVED' && !" lib app components --include='*.ts' --include='*.tsx'
grep -rn "status: 'APPROVED', paidAt: null" lib app --include='*.ts'
```
Expected: no output from either. If anything appears, that call site was missed and must be migrated before continuing.

- [ ] **Step 2: Delete the grep test**

```bash
git rm tests/money-agreement.test.ts
```

Its job was keeping four implementations agreeing. `tests/money-ledger.test.ts` now tests the one implementation's behaviour, and its "never marks a paid entry collectable" test covers the prefilter soundness the grep test could not express.

- [ ] **Step 3: Full suite**

```bash
npm test
npm run typecheck
npm run build
```
Expected: all PASS. `tests/design-tones.test.ts`, `tests/project-money.test.ts` (18), `tests/money-ledger.test.ts` (18), `tests/money-ledger-server.test.ts` (10), `tests/dashboard-revenue.test.ts` (5), `tests/phases.test.ts` and `tests/client-view.test.ts` all green.

- [ ] **Step 4: End-to-end**

```bash
E2E_PORT=3002 npm run test:e2e
```
Expected: 67/67. The visual snapshots for `money-main` and `dashboard-main` will differ because an approved unpaid phase now reads לגבייה in `warning`. Review the diff, confirm it is only that, then refresh:
```bash
E2E_PORT=3002 npx playwright test --update-snapshots e2e/visual.spec.ts
```

- [ ] **Step 5: Confirm the portal figure never moved**

Open a client portal URL from `/clients/[id]`. The לתשלום figure on a project card must equal what it showed before this work. `tests/project-money.test.ts` asserts this, but the portal is the one surface a client sees, so check it by eye once.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(money): retire the grep guard, one definition needs no policing"
```

---

## Self-review notes

- **Spec coverage.** Decisions 1-7 map to Tasks 1, 1+3, 1, 2, 6, 3, 7 respectively. The migration map's seven rows map to Tasks 5, 5, 4, 6, 6, 4, 2.
- **Type consistency.** `LedgerRow` is declared once, in `lib/money/ledger.server.ts`, and re-exported from `money.service.ts` so `app/(dashboard)/money/page.tsx` keeps its existing import. `PhaseAmount` and `Money` are declared in `lib/money/ledger.ts` and re-exported from `lib/money/project.ts` for `phase-strip.tsx` and `clients/page.tsx`.
- **Known transient failure.** `tests/money-agreement.test.ts` fails from Task 4 until Task 7 deletes it. Task 4 Step 5 gives the exclude flag to keep the suite readable in between. This is the only planned red.
