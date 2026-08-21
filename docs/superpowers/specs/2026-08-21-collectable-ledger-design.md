# Collectable ledger — design

Date: 2026-08-21
Status: agreed (grilled 2026-08-21)

## Problem

"Money owed" has four live implementations and no module.

| Where | Mechanism | Advances |
|---|---|---|
| `lib/utils/project-money.ts:60` `projectOutstanding` | pure filter over loaded phases | excluded, by design |
| `lib/services/today.service.ts:282` `getBadges` | two queries + two reduces | included |
| `lib/services/today.service.ts:190` `getBoard.collect` | two queries + map + sort | included |
| `lib/services/money.service.ts:135` `getLedger.totals.due` | advances folded in as synthetic rows | included |

A fifth, `DashboardService.outstanding` (`dashboard.service.ts:105`), is computed
with a Prisma `_sum`, excludes advances, is guarded by two tests, and is
**rendered nowhere**. The dashboard's visible לגבייה figure comes from
`board.collect`.

The three live aggregate definitions agree only because `tests/money-agreement.test.ts`
greps all three source files for string literals. That test's own docstring
records the outage it was written after: the כספים badge counted phases while
`/money` counted advances too, so the badge showed nothing beside a page reading
₪3,000.

A sixth copy of the predicate lives in the browser at
`app/(dashboard)/money/page.tsx:60`.

## Decisions

### 1. Two named concepts, not one with a scope

The module names both and keeps them distinct:

- **גבייה (collectable)** — unpaid מקדמות plus approved unpaid phases. Owner scope.
- **לתשלום (signedOffUnpaid)** — approved unpaid phases only, never the מקדמה. Project scope.

Rejected: one predicate with a scope parameter. It would change what clients see
(`components/portal/project-card.tsx:82` renders לתשלום), which is a product
change, not a refactor.

Both terms are now in `CONTEXT.md`, along with **מקדמה (advance)**.

### 2. Coarse fetch plus a pure core

Every *live* owner-scope consumer already loads rows and reduces in JS; only the
dead `DashboardService` path uses `_sum`. Six of nine money consumers are
`'use client'` components computing in the browser from serialised rows, which is
why `project-money.ts` is dependency-free today.

So: the server layer owns a coarse query per scope, and every decision lives in a
pure, browser-safe core that both sides run. No predicate is written twice, and
no Prisma `where` clause encodes meaning.

### 3. An advance gets its own state, never a borrowed one

`money.service.ts:111` stamps advances `status: 'APPROVED'` with
`approvedAt: null`. The page then undoes the fiction twice
(`money/page.tsx:76` and `:135`) and renders an advance with a **phase** status
label at `:109`.

The core derives a `LedgerState` instead. An advance is never a PhaseStatus.

### 4. `project-money.ts` becomes the project-scoped surface

Its three functions keep their exact signatures and are re-implemented over the
core. Call expressions do not change; only the import path moves to
`lib/money/project.ts`. `tests/project-money.test.ts` (18 tests, pure, no mocks)
passes unchanged and becomes the regression guard proving the portal figure is
bit-identical.

### 5. The dead KPI is deleted

`DashboardService.outstanding` and its two tests go. `revenue` is live
(rendered at `page.tsx:463` as הכנסות) and migrates to `received()`.

### 6. Prefilters are performance, never meaning

Two loaders. `openLedger` prefilters to unpaid rows; `fullLedger` loads
everything. The core re-decides on whatever rows it receives, so a prefilter can
never change an answer.

The rule that makes this sound, and which is tested directly:

```
for every entry e:  isCollectable(e)  implies  e.paidAt == null
```

`getBadges` runs on every route change and every 120 seconds
(`components/layout/badges-provider.tsx:45-52`), so it must not load history.

### 7. The grep test is deleted

`tests/money-agreement.test.ts` existed to keep four implementations agreeing.
With one implementation it would be a tautology, and it pins source text the
refactor deliberately moves. Replaced by table-driven core tests plus the
safety-rule test above.

## Migration map

| Consumer | After |
|---|---|
| `TodayService.getBadges` outstanding | `collectable(await openLedger({ userId }))` |
| `TodayService.getBoard` collect | `(await openLedger({ userId })).filter(isCollectable)` |
| `MoneyService.getLedger` | `fullLedger({ userId })` plus core totals |
| `DashboardService.revenue` | `received(await fullLedger({ userId }))` |
| `DashboardService.outstanding` | deleted |
| `money/page.tsx` buckets | core predicates |
| `project-money.ts` (25 call sites, 11 files) | facade over the core |

## Deliberate visible change

On `/money`, an approved-but-unpaid phase currently renders tone `success`
with the label אושר. It becomes tone `warning` with the label לגבייה, and an
advance stops rendering a phase label entirely.

This is intentional and the codebase already argues for it:
`components/portal/project-card.tsx:109` says "Money is not a status: a paid
figure is not 'success' and an outstanding one" is not either.

## Out of scope

- `MoneyService`'s Israel-month boundary (`startOfIsraelMonth`) is correct and moves unchanged.
- The parallel label/tone maps in `lib/design/` are a separate candidate.
- `morning-brief.service.ts:203` formats phase prices for prose, not as a total; it is left alone.
