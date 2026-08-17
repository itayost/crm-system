# Frontend Codemap

Freshness: 2026-08-17 | Owner UI + client portal

## Layers

There are four, and the third one used to be missing entirely - which is why
the page header was hand-typed on seven pages, the search box on five, and
`<TableHead className="text-right">` thirty times.

```
tokens        app/globals.css              primitives -> semantics -> tone rules
              tailwind.config.js           type / space / radius / elevation / motion / z-index
              lib/design/tones.ts          13 domain enums -> 8 tones
              lib/design/labels.ts         15 Hebrew label maps

primitives    components/ui/*              shadcn. 14 files; nine unused ones were deleted.

composition   components/patterns/*        THE layer. PageHeader, SearchField, SegmentControl,
                                           DataTable, EmptyState, TableSkeleton, DetailHeader,
                                           FactRail, MoneyLine/Figure, PhaseStrip, TonePanel,
                                           ConfirmDelete. Zero physical direction utilities,
                                           enforced by tests/design-rtl.test.ts.

pages         app/(dashboard)/*            owner side
              app/r/[token]/*              client portal (RSC)
```

## Page tree

```
app/
  layout.tsx ........................ RTL, Hebrew, Assistant + IBM Plex Mono via next/font
  not-found.tsx
  (auth)/
    login/page.tsx .................. honours ?from=
    register/page.tsx ............... renders only while User.count() === 0
  (dashboard)/
    layout.tsx ...................... Sidebar + Header + MobileNav + BadgesProvider
    loading.tsx / error.tsx
    page.tsx ........................ היום. 7 blocks; 1-6 render only when non-empty
    leads/page.tsx .................. replaces the old /contacts list
    contacts/[id]/page.tsx .......... the person record (unchanged by the rebuild)
    clients/page.tsx ................ ranked by money
    clients/[id]/page.tsx ........... header + money line + rail + 5 tabs
    projects/page.tsx ............... שלב נוכחי + phase strip
    projects/[id]/page.tsx
    projects/[id]/agent/page.tsx .... ניטור, linked from the project page
    tasks/page.tsx .................. segments + facets
    tasks/[id]/page.tsx ............. quotes the originating request's own words
    requests/page.tsx ............... 6 segments over `?view=`
    requests/[id]/page.tsx
    money/page.tsx .................. the ledger, at phase granularity
    settings/page.tsx ............... bot state (read-only), connections, account
  r/[token]/ ........................ portal: header + footer + 3 tabs
```

`/contacts` redirects to `/leads`.

## Conventions

- **A pile is a segment, not a stacked block.** Named subsets of a list are
  mutually exclusive segments on `?view=`, counted in the control. Nothing that
  is a subset of a table renders above that table.
- **A detail page is one column of work and one rail of facts.** Anything that
  is neither actionable nor a fact does not exist.
- **Money renders at one granularity per page**, and the granularity is the
  page's own noun.
- **A badge is only allowed on a number that can reach zero on a good day.**
- Rows navigate through a real `<Link>`, so cmd-click and copy-link work.
- Numbers are wrapped in `<bdi>`; without it `₪1,200` renders with the shekel on
  the wrong side.

## State

- Server state: direct fetch in page components via `lib/api/client.ts` (axios).
  No React Query. Badges come from one `GET /api/today` behind `BadgesProvider`.
- Forms: React Hook Form + zod. The reset effect keys on `record?.id`, never the
  record object - keying on the object meant a background refetch silently
  discarded whatever had been typed.
- Notifications: **react-hot-toast** (this doc previously claimed Sonner; sonner
  was installed and imported by nothing, and has been removed).

## Testing

- `tests/design-tones.test.ts` - no raw palette classes anywhere.
- `tests/design-rtl.test.ts` - physical direction utilities, budget 4 and only
  ever downward; zero in `components/patterns/`.
- `tests/money-agreement.test.ts` - the `כספים` badge and `/money` must count
  the same thing.
- `e2e/` - 79 tests across `main`, `auth` and `mobile` projects. Every selector
  goes through `e2e/fixtures.ts`; `row()` resolves `[data-testid="row"]:visible`
  so the same assertion works against the desktop `<tr>` and the mobile
  `<article>`.
- Visual baselines are darwin-specific and are not run in CI.
