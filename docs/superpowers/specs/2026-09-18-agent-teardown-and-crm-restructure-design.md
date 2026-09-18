# Agent teardown and CRM restructure

> **Created**: 2026-09-18
> **Status**: approved, not started
> **Supersedes in practice**: ADR 0001, ADR 0002 (see [ADR 0004](../../adr/0004-the-crm-has-no-ai.md))

## Problem

Two separate complaints, resolved in one project because the first one's
solution is the second one's cause.

**The agent layer is not carrying its weight.** 7 of 40 services call a model,
13 of 40 are WhatsApp or support machinery. The client-facing bot has been
paused in production since 2026-08-13 with no operational consequence. Three
unfinished branches circle the same subsystem (`feat/support-agent-on-eve`,
`ai-migration`, `feat/ai-model-registry`). Its failure modes are shared and
total, which is why ADR 0002 exists at all.

**The operator side feels wrong** in three specific ways, all confirmed:
too many places to be, too much clicking to do one real thing, and it asks for
upkeep that earns nothing back. Notably *not* wrong: היום answers "what needs
me today" adequately, so the overview is not the problem.

On "too many places": the diagnosis stands, but its original justification did
not. It was argued from the claim that the sidebar presented seven undifferentiated
destinations, and that is false — the nav has been grouped into primary,
registry and footer blocks since the 2026-08-17 rebuild (see section B). The
count is still high for one person with ten clients, and משימות and פרויקטים
are still two stops for one sitting, which is what section B actually fixes.

## What this is not

This project began from a draft document proposing a ground-up rebuild. That
document is superseded, and it is worth recording why, because the same
suggestions will recur:

- It specified `Leads` as an entity that auto-creates a `Client` on win. That
  is the 12-model design cut in the 2026-03 redesign. One `Contact` with a
  phase filter is the fix, not the problem.
- It put phone and email on `Client`, collapsing the person/business split it
  then asked for two lines later.
- It specified a fixed project pipeline (אפיון → עיצוב → פיתוח → QA →
  Production). A fixed enum cannot bill. `ProjectPhase` carries `price`,
  `approvedAt` and `paidAt`, and every project's phases differ.
- It required every Request to belong to a Project. Requests belong to the
  Client; `sendQuote` is what forces a project, at quote time, so the billing
  phase has somewhere to land.
- It recommended Linear and Slack sync (three owner channels, when
  `notifyOwner()` is deliberately one, after three paths drifted and went
  silent), Twilio (WAHA already runs self-hosted), MongoDB (Postgres/Prisma),
  iCount (Morning is what is actually used), and Dark Glassmorphism (reversing
  a no-dark-mode operator console shipped 2026-08-17 across 51 commits).
- It recommended a client portal as a new idea. It shipped 2026-08-18.

The draft's two salvageable ideas, per-project quick links and invoicing, are
carried below.

## Decisions

| # | Decision |
|---|---|
| 1 | No model is called anywhere. `lib/ai/` and all 7 AI services are deleted. |
| 2 | WhatsApp survives outbound only. No session listens. |
| 3 | The morning brief is deleted outright, not reduced to a template. |
| 4 | Operator IA: 4 primary surfaces, 3 secondary. משימות merges into עבודה. |
| 5 | Business facts live on `Client` only; the Contact/Client split is finished. |
| 6 | `Priority` collapses from 4 levels to a boolean. |
| 7 | Lead pipeline: `NEW / QUOTED / CLIENT / LOST`, plus a דיברתי action. |
| 8 | The portal is the only inbound channel; the request form gains a contact select. |
| 9 | תקלה asks type-conditional `intake` questions; other types do not. |
| 10 | The five dropped models are exported to JSON before the tables go. |

## Scope

### A. Teardown

**Delete.** Services: `support-agent`, `whatsapp-agent`, `request-extraction`,
`intake-extraction`, `product-card`, `media-understanding`, `morning-brief`,
`support-tools`, `support-repo-tools`, `support-media`, `support-filing`,
`support-followups`, `support-conversation`, `whatsapp-tools`,
`whatsapp-archive`, `whatsapp-messages`, `github.service`, `fuzzy-match`
(its only non-test consumer is `whatsapp-tools`), and all of `lib/ai/`.

Models: `WhatsAppMessage`, `BotConversation`, `SupportConversation`,
`AgentProjectConfig`, `ProductCard`. Column: `Client.profileHe`. Request
columns: `isAiGenerated`, `aiConfidence`, `aiNote`, `sourceMessageId`.

Routes: `api/whatsapp/webhook`, `api/whatsapp/index`,
`api/projects/[id]/agent-config`, and all four `api/cron/*`. `vercel.json`
ends with an empty crons array.

Pages: `projects/[id]/agent`; the settings bot toggle.

Env: `WAHA_BOT_SESSION`, `WHATSAPP_BOT_PAUSED`, `OLLAMA_BASE_URL`,
`OLLAMA_API_KEY`, `OLLAMA_MODEL`, `SUPPORT_MEDIA_MODEL`, `PRODUCT_CARD_MODEL`,
`INTAKE_MODEL`, `GITHUB_TOKEN`, `CRON_SECRET`.

**Keep.** `owner-line`, `waha.service`, `waha-transport`, `whatsapp-identity`,
reduced to outbound template Hebrew: quote sent, phase approved, request done,
owner notices. `notifyOwner()` stays the only way to reach Itay.
`isBotPaused()` and its call sites go, since nothing can be paused once
nothing listens.

`/api/public/leads` survives untouched. It is website lead intake, not AI, and
its three protection layers (secret, rate limit, one-phone-one-contact) are
unaffected.

### B. Operator restructure

```
PRIMARY                          SECONDARY
  היום     what is owed now        לקוחות
  פניות    triage and quote        כספים
  עבודה    projects, phases, tasks הגדרות
  לידים    the pipeline
```

**This is a smaller change than an earlier draft of this spec claimed.** That
draft described the nav as seven items of equal weight, "a database browser
wearing a sidebar". It is not. `components/layout/nav-items.ts` already exports
`NAV_PRIMARY` (היום, פניות, משימות, לידים, each with a badge count),
`NAV_REGISTRY` (לקוחות, פרויקטים, כספים) and `NAV_FOOTER` (הגדרות), and
`components/layout/sidebar.tsx:69,76` renders the three groups separated by
rules. Its own comment records that the *previous* nav was "six items in one
undifferentiated group headed ראשי" — the 2026-08-17 rebuild already fixed the
problem the draft described.

So the hierarchy exists and the target above is largely reached. The one real
change is **merging משימות and פרויקטים into a single עבודה surface**, which
moves פרויקטים out of the registry block and collapses two primary destinations
into one.

`Task.projectId` is nullable and standalone tasks are supported, so עבודה needs
a home for project-less tasks rather than assuming every task hangs off a
project.

**Act from the row.** Quoting a request, advancing a phase and pressing דיברתי
must all work without opening a detail page. `components/patterns/data-table.tsx`
is the attachment point. This is the concrete answer to "too much clicking".

**Upkeep cuts.** `Contact` keeps `name`, `email`, `phone`, `role`, `isPrimary`,
`status`, `source`, `notes`, `nextActionAt`, `nextActionNote`,
`lastContactedAt`, `convertedAt`, and the two lead-qualification fields
`estimatedBudget` and `projectType`, which the website form posts through
`/api/public/leads` and the leads page renders.

**`Contact.company` also stays.** An earlier draft of this spec moved it to
`Client` with the other business facts. That was wrong: it is the lead's
*stated* business name, captured before any `Client` row exists, and
`ClientsService.convertContactToClient` reads it as
`name: overrides?.name ?? contact.company ?? contact.name`
(`lib/services/clients.service.ts:145`) to seed the new client's name. The
website form posts it and the leads table renders it. A lead has no `clientId`,
so there is nowhere else it can live; removing it breaks lead intake and
conversion both.

`address`, `taxId` and `isVip` are genuinely duplicated — on `Contact` they
appear only in the update schema, the wire type and a read-only card — and those
three move to `Client` alone. `Contact.notes` stays person-level while
`Client.notes` is the business-level free text named in `CONTEXT.md`.

`Priority` becomes a boolean across `Task`, `Project` and `Request`;
`PRIORITY_EMPHASIS` already rendered LOW and MEDIUM as nothing, so this makes
the form match what the design layer had already concluded. It touches **40
files** and is therefore a plan of its own.

**דיברתי.** One control on the lead row that stamps `lastContactedAt` and
captures the next action together.

> This is not optional polish. `lastContactedAt` is written by exactly two
> places, `api/whatsapp/index/route.ts:54` and `api/whatsapp/webhook/route.ts:224`,
> both deleted here, and `today.service.ts:159-169` reads it for the
> quiet-leads count.
>
> That count is also gated on `nextActionAt: null`, so the teardown does not
> flood it. The failure is subtler: with the field never written, the staleness
> `OR` collapses to `createdAt < 3 days ago`, so the count stops meaning "leads
> I have not spoken to recently" and starts meaning "leads whose record is
> old". A lead phoned yesterday with no next action set begins counting as
> quiet, where a recent WhatsApp would previously have excluded them. The
> number grows and misleads rather than breaking visibly, which is the harder
> bug to notice.

`nextActionAt` and `nextActionNote` are deliberately **kept**. They lose the
morning brief as a consumer, so היום becomes their only surface and must show
them.

### C. Portal

The contact select replaces `reporterName`, `reporterPhone` and
`reporterEmail` with one select over that client's contacts, defaulting to the
primary and hidden when there is only one. It populates `Request.contactId`,
which the bot used to fill from phone identity.

`Client.formToken` stays the credential. Magic links were rejected: email
infrastructure, expiry and session handling to protect "your own tickets", for
ten clients.

תקלה asks the diagnostic subset of the existing intake schema; בקשה, שאלה and
אחר stay at title plus description. `lib/validations/intake.ts`,
`components/requests/intake-edit-form.tsx`, `intake-details.tsx` and
`intake-playback.tsx` all survive. Only the filler changes from model to
client.

### D. Data

1. Export `WhatsAppMessage`, `BotConversation`, `SupportConversation`,
   `AgentProjectConfig`, `ProductCard` to JSON in a gitignored directory.
2. Read each client's `profileHe` and merge what is worth keeping into
   `notes`, by hand. Roughly ten clients.
3. Only then drop the tables and columns.

Schema changes ship as idempotent SQL in `scripts/NN_*.sql` via
`prisma db execute`; `db:push` times out on the Supabase pooler.

### E. New capability

Per-project quick links: a nullable JSON column on `Project` and a link strip
on its page (Vercel, GitHub, Figma, spec doc, live URL).

## Sequencing

The work runs as **seven plans**, not the five an earlier draft assumed. Two of
the steps below turned out to be far larger than they read here and were split
once their real blast radius was measured against the code.

| Plan | Scope | Why separate |
|---|---|---|
| 1 | דיברתי + היום next actions | Must ship while the webhooks still write `lastContactedAt` |
| 2 | Delete the agent runtime: services, routes, crons, `lib/ai` | Pure deletion; reviewable as "did anything break" |
| 3 | Drop the AI schema: 5 models, `profileHe`, `Request`'s 4 AI columns | Needs an irreversible export first; the AI columns reach 10 surviving files |
| 4 | Contact/Client split + lead-state reduction | Both are data migrations, not just schema changes |
| 5 | `Priority` to a boolean | **40 files**; cannot share a plan with anything |
| 6 | Merge משימות and פרויקטים into עבודה | The only real IA delta (see section B) |
| 7 | Portal contact select, type-conditional intake, project quick links | Client-facing; separate risk profile |

**Plan 1 before Plan 2 is the one ordering constraint that is not negotiable.**
Everything else can reorder, though 2 before 3 avoids editing files that are
about to be deleted.

Plans 1 to 4 are written. 5 to 7 are not.

## Testing

17 test files (4,448 LOC, 51% of the suite) test deleted code and go with it.
`intake.test.ts` is the exception: intake survives repurposed, so it is
rewritten rather than deleted.

New behaviour needing cover: דיברתי writes `lastContactedAt` and clears/sets
the next action; היום staleness still works after the webhooks are gone; the
portal contact select populates `Request.contactId`; type-conditional intake
renders for תקלה only; lead state transitions under the reduced enum; priority
boolean migration preserves HIGH/URGENT as true.

E2E currently 82 tests, run with `E2E_PORT=3002`. Specs touching the bot,
agent page and old nav need rewriting. Teardown must run inwards-out (tasks →
requests → projects → client) or rows leak into the shared production DB.

Verification gate: `npm run typecheck && npm run test && npm run build`, then
`E2E_PORT=3002 npx playwright test`.

## Out of scope

- **Invoicing via Morning.** Deferred to its own project. `לתשלום` and `גבייה`
  data already exists and is not changing here. Money-chasing is not a weekly
  activity, making this the lowest-leverage large item available.
- **Any change to the money model.** `projectTotal()`, `collectable()` and
  `signedOffUnpaid()` are untouched; ADR 0003 stands.
- **The tone / StatusPill system.** Untouched. Both traps documented in
  `CLAUDE.md` still apply.
- **The portal's visual direction.** The 2026-08-18 paper surface stands.
- **Re-adding inbound WhatsApp in any form**, including raw message capture.

## Risks

| Risk | Mitigation |
|---|---|
| `lastContactedAt` loses its writer and היום breaks | Sequencing step 2 before step 3 |
| Dropped data is unrecoverable | Export first, merge `profileHe` by hand |
| Clients resist the portal after using WhatsApp | Outbound notices keep pulling them back; portal copy already says נחזור אליך בוואטסאפ |
| Deleting 51% of tests hides a coverage regression | Measure coverage before and after; new controls get tests |
| `CLAUDE.md` and `AGENTS.md` describe the deleted layer at length | Both need a trim in the same project; they are the agent-facing source of truth |
