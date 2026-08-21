# 0003 — גבייה is not what a client owes

Date: 2026-08-21
Status: accepted

## Context

"Money owed" had four live implementations and no module: a pure filter in
`lib/utils/project-money.ts`, two hand-written reduces in `today.service.ts`,
and a synthetic-row fold in `money.service.ts`. A fifth in
`dashboard.service.ts` excluded advances, was guarded by two tests, and was
rendered nowhere.

The three live ones agreed only because `tests/money-agreement.test.ts` grepped
their source for matching string literals. That test was written after the
disagreement it now describes: the כספים badge counted phases while the /money
page it links to counted advances too, so the badge showed nothing beside a
page reading ₪3,000.

The obvious fix is one predicate with a scope parameter — owner, client,
project — and advances always counted. It is a smaller interface and it makes
the four numbers structurally identical.

## Decision

Two concepts, named separately, both owned by `lib/money/ledger.ts`:

- **גבייה (`collectable`)** — everything invoiceable right now, unpaid מקדמות
  included. The owner's question, asked across all projects by the nav badge,
  the היום board and /money.
- **לתשלום (`signedOffUnpaid`)** — a single project's approved unpaid phases,
  never its מקדמה. The client's question, rendered in the portal and on the
  per-project figures.

The single-predicate alternative was rejected because it is not a refactor. A
מקדמה is owed on signature; delivered work is owed on sign-off. Folding
advances into the per-project figure would change what a client reads on their
own portal page (`components/portal/project-card.tsx:82`) from "what my
delivered work has cost" to "what I agreed to pay, minus what I have paid".
That is a product decision, and it is not the one this work was for.

`projectTotal`, `projectPaid` and `projectOutstanding` keep their signatures as
a facade over the core, so the 18 assertions in `tests/project-money.test.ts`
prove the client-facing number did not move.

## Consequences

- The badge, the board, /money and the dashboard read one predicate. The grep
  test is deleted: with one implementation it would be a tautology.
- Two names have to be learned, and a reader who assumes they are synonyms will
  be wrong. `CONTEXT.md` marks both `_Avoid_: outstanding`, because that is the
  word that already meant two things.
- An advance no longer borrows `PhaseStatus.APPROVED`. `LedgerState` is derived
  per entry, so /money stops rendering a phase label on a מקדמה and stops
  re-excluding advances at two call sites.
- Server loaders prefilter for speed only. The rule that keeps this honest —
  nothing collectable carries a payment date — is asserted directly, because
  the badge runs on every route change and every 120 seconds and a wrong
  prefilter would silently under-report.
- If the portal is ever meant to show a client their unpaid מקדמה, that is a
  deliberate product change to `client-view.ts`, not a change to this rule.
