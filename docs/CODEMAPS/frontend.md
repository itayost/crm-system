# Frontend Codemap

Freshness: 2026-08-18 | Owner UI + client portal

## Layers

There are four, and the third one used to be missing entirely - which is why
the page header was hand-typed on seven pages, the search box on five, and
`<TableHead className="text-right">` thirty times.

```
tokens        app/globals.css              primitives -> semantics -> tone rules
                                           + [data-surface='portal'], which re-points the
                                           semantic layer for /r/[token]. Unlayered, like the
                                           tones, because it has to beat :root in @layer base.
              tailwind.config.js           type / space / radius / elevation / motion / z-index
                                           two type scales: ui-* (console), portal-* (client)
              lib/design/tones.ts          13 domain enums -> 8 tones
              lib/design/labels.ts         15 Hebrew label maps

primitives    components/ui/*              shadcn. 14 files; nine unused ones were deleted.

composition   components/patterns/*        THE console layer. PageHeader, SearchField,
                                           SegmentControl, DataTable, EmptyState, TableSkeleton,
                                           DetailHeader, FactRail, MoneyLine/Figure, PhaseStrip,
                                           TonePanel, ConfirmDelete.
              components/portal/*          THE client layer. PortalShell/Nav/Page/Button,
                                           JourneyRail, QuoteDecision, DecisionPanel,
                                           IntakePlayback, AttachmentGrid, NewRequestForm,
                                           RequestList, ProjectCard, InvalidToken.
                                           Both held to zero physical direction utilities by
                                           tests/design-rtl.test.ts.

pages         app/(dashboard)/*            owner side
              app/r/[token]/*              client portal (RSC)
```

## Two surfaces, one system

The console and the portal share the tone system, the label maps, `StatusPill`
and every primitive. They diverge only in the token block one of them opts into:

|            | console                    | portal                          |
|------------|----------------------------|---------------------------------|
| ground     | grey-100, blue-biased      | paper `38 44% 96%`, warm        |
| body       | 13px (`ui-sm`)             | 17px (`portal-base`)            |
| radius     | 4px                        | 16px cards / 12px controls      |
| control    | 26px                       | 48px                            |
| `--primary`| blue (= `--tone-info-solid`)| ink                            |
| display    | Assistant                  | Frank Ruhl Libre                |
| elevation  | overlays only              | allowed on cards                |
| signature  | phase strip (horizontal)   | journey rail (vertical)         |

A component does not know which surface it is on. `data-surface="portal"` is set
in exactly one place - `app/r/[token]/layout.tsx` - and nothing else may set it.

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
    loading.tsx / error.tsx ......... force-dynamic + a DB round trip on cellular
    page.tsx ........................ one sentence, then the evidence for it
    requests/page.tsx ............... grouped by whose turn it is
    requests/new/page.tsx ........... the submit flow, off the home page
    [requestId]/page.tsx ............ decision-first when a quote is open
    projects/page.tsx ............... journey rail + the statement
```

The decision deliberately has no route of its own: quote notices already
deep-link to `/r/{token}/{requestId}`, and those links are in clients' WhatsApp
history.

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
- **On the portal, the answer comes before the evidence.** A client arrives with
  one question and should not have to assemble the answer out of counters.
- **The journey rail is the portal's signature.** done = filled ink + a date,
  now = the only tone-coloured marker, ahead = hollow ring, no date. Paid is an
  ink underline, never green - work state owns the colour, money owns the mark.
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
  ever downward; zero in `components/patterns/` and `components/portal/`.
- `tests/client-view.test.ts` - the whitelist. No storage path, no client id and
  no `intake.suggestedType` may leave the module, and `notYetDue` must reconcile
  with `project-money.ts`.
- `tests/money-agreement.test.ts` - the `כספים` badge and `/money` must count
  the same thing.
- `e2e/` - 80 tests across `main`, `auth` and `mobile` projects. Portal teardown
  runs inwards-out (tasks, requests, projects, then the client): neither
  `ClientsService.delete` nor `ProjectsService.delete` cascades, both on purpose,
  and this suite shares a database with production. Every selector
  goes through `e2e/fixtures.ts`; `row()` resolves `[data-testid="row"]:visible`
  so the same assertion works against the desktop `<tr>` and the mobile
  `<article>`.
- Visual baselines are darwin-specific and are not run in CI.
