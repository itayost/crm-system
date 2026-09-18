# Agent runtime teardown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every service, route and cron that calls a model, leaving WhatsApp as an outbound-only pipe and the schema untouched.

**Architecture:** Pure deletion, in dependency order, innermost consumer first. Each task removes one coherent capability and leaves `npm run typecheck && npm run test && npm run build` green, so any task can be the last one merged if the work is paused.

**Tech Stack:** Next.js 16 App Router, Prisma 7, vitest, Playwright, Vercel cron.

**Spec:** [`docs/superpowers/specs/2026-09-18-agent-teardown-and-crm-restructure-design.md`](../specs/2026-09-18-agent-teardown-and-crm-restructure-design.md)
**Decision record:** [`docs/adr/0004-the-crm-has-no-ai.md`](../../adr/0004-the-crm-has-no-ai.md)

This is **Plan 2 of 5**.

## Dependencies and ordering

- **Plan 1 (`feat/spoke-control`, PR #25) must merge first.** It gives `Contact.lastContactedAt` a writer. Task 2 here deletes both webhooks, which are its only other writers, and `today.service.ts:159-169` reads that field. Verify before starting: `git log --oneline | grep spoke` must show `feat(contacts): the דיברתי control`, and `components/patterns/spoke-button.tsx` must exist.
- **Plan 3 is the schema teardown** and is deliberately NOT here. Dropping `ProductCard`, `WhatsAppMessage`, `BotConversation`, `SupportConversation`, `AgentProjectConfig`, `Client.profileHe` and `Request`'s four AI columns reaches into ten surviving files, needs a data export first, and wants its own review. **This plan leaves every model and column in place**; it only stops writing to them.
- This split is why several tasks below delete a *writer* while leaving its table. That is intentional, not an oversight.

## Global Constraints

- All UI text in Hebrew. Layout is RTL (`dir="rtl"`, `lang="he"`).
- Service errors thrown to the API layer **must contain Hebrew**, or `withAuth` maps them to 500 instead of 400 (`lib/api/api-handler.ts`).
- Every service method takes `userId` first; every query is scoped by it.
- Never mutate objects; use spread.
- Hebrew labels via `lib/design/labels.ts`, tones via `lib/design/tones.ts`. Never inline either.
- Status chips through `<StatusPill>`, never `<Badge>`; never pass `bg-*` through its `className`.
- `components/patterns/` allows **zero** physical direction utilities; repo-wide budget of 4 is consumed.
- Do **not** run `prettier`; it has no config here.
- **Do not run Playwright.** It cannot start on any branch cut from `main` (`e2e/global-setup.ts` builds `new PrismaClient()` with no driver adapter, which Prisma 7 requires; the fix, `e3a2090`, is stranded on `fix/money-status-coverage`). Per-task gate is `npm run typecheck && npm run test && npm run build`.

## What survives, and must still work at every commit

`lib/services/owner-line.ts`, `waha.service.ts`, `waha-transport.ts`, `whatsapp-identity.ts`.

They are load-bearing for code that has nothing to do with the agent:

| Survivor | Depended on by |
|---|---|
| `owner-line` | `app/api/public/leads/route.ts`, `app/api/public/requests/route.ts`, `lib/services/phases.service.ts` |
| `whatsapp-identity` | `lib/services/public-leads.service.ts` |
| `waha.service` | `owner-line`, `whatsapp-identity` |
| `waha-transport` | `waha.service` |

If a deletion breaks one of these, you have deleted too much. Stop and report rather than stubbing it.

---

### Task 1: Delete the client support agent

**Files:**
- Delete: `lib/services/support-agent.service.ts`, `support-tools.ts`, `support-filing.ts`, `support-media.service.ts`, `support-conversation.service.ts`, `support-followups.service.ts`
- Delete: `app/api/whatsapp/webhook/route.ts` (and its now-empty `webhook/` directory)
- Delete: `app/api/cron/support-followups/route.ts` (and its directory)
- Delete tests: `tests/support-agent.test.ts`, `support-followups.test.ts`, `support-media.test.ts`, `cron-support-followups.test.ts`, `whatsapp-bot-webhook.test.ts`, `bot-pause.test.ts`
- Modify: `vercel.json` (remove the `support-followups` cron entry)
- Modify: `lib/config/bot-pause.ts` — delete it, plus every `isBotPaused()` call site

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `WhatsAppMessage` rows stop being read by any agent. `owner-line.ts` must still export `notifyOwner` unchanged.

- [ ] **Step 1: Remove the bot-status indicator chain**

`isBotPaused` has **eight** call sites, and one of them feeds a visible header badge. Handle them in this order, innermost first:

| File | What to do |
|---|---|
| `lib/services/today.service.ts:226` | Remove `botPaused: isBotPaused()` from the `getBadges` return, and drop `botPaused` from the `TodayBadges` type. Also remove the import at line 4 |
| `components/layout/header.tsx:88-95` | Delete the whole `data-testid="bot-status"` span and its explanatory comment. It exists only to answer "did the bot go quiet" |
| `e2e/navigation.spec.ts:43-50` | Delete the test `'bot-status: the header says whether the bot is talking to clients'`. It asserts `/הבוט פעיל\|הבוט מושהה/`, which will no longer render |
| `app/(dashboard)/settings/page.tsx` | Remove the read-only bot toggle |
| `app/api/settings/health/route.ts` | Remove the bot-paused field from the health payload |
| `lib/services/requests.service.ts` | The "finished" notice chose `אני כאן` when the bot could hear a reply and the portal link when it could not. With no bot at all, **the portal link is always correct** — delete the branch, keep the portal-link wording |
| `app/api/cron/support-followups/route.ts` | Deleted wholesale in Step 2 |
| `lib/config/bot-pause.ts` | Deleted in Step 5 |

Verify you found them all: `grep -rn "isBotPaused\|bot-pause\|WHATSAPP_BOT_PAUSED\|bot-status" --include='*.ts' --include='*.tsx' app lib components tests e2e` must return nothing when Step 5 is done.

- [ ] **Step 2: Delete the six support services and the two routes**

```bash
git rm lib/services/support-agent.service.ts lib/services/support-tools.ts \
       lib/services/support-filing.ts lib/services/support-media.service.ts \
       lib/services/support-conversation.service.ts lib/services/support-followups.service.ts
git rm -r "app/api/whatsapp/webhook" "app/api/cron/support-followups"
```

- [ ] **Step 3: Delete their tests**

```bash
git rm tests/support-agent.test.ts tests/support-followups.test.ts \
       tests/support-media.test.ts tests/cron-support-followups.test.ts \
       tests/whatsapp-bot-webhook.test.ts tests/bot-pause.test.ts
```

- [ ] **Step 4: Remove the cron entry**

In `vercel.json`, delete the object with `"path": "/api/cron/support-followups"`. Leave the other three for now.

- [ ] **Step 5: Delete the pause switch and fix its call sites**

```bash
git rm lib/config/bot-pause.ts
```

Then edit every call site found in Step 1. In `requests.service.ts`, the "finished" notice keeps only the portal-link sign-off.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`
Expected: all pass. Typecheck is what catches a missed import; if it names a file you did not intend to touch, read it before editing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(teardown): delete the client support agent

The bot has been paused in production since 2026-08-13 with no operational
consequence. Its six services, its webhook, its follow-up cron and the pause
switch itself all go. WHATSAPP_BOT_PAUSED becomes meaningless once nothing
listens, so the finished-request notice now always points at the portal
rather than promising a channel that no longer exists."
```

---

### Task 2: Delete the owner agent and passive indexing

**Files:**
- Delete: `lib/services/whatsapp-agent.service.ts`, `whatsapp-tools.ts`, `whatsapp-archive.ts`, `whatsapp-messages.ts`, `fuzzy-match.ts`
- Delete: `app/api/whatsapp/index/route.ts` (and the now-empty `app/api/whatsapp/` tree)
- Delete tests: `tests/whatsapp-index-webhook.test.ts`, `tests/waha-media.test.ts`
- Modify: `tests/approval-paths.test.ts` — it imports `fuzzy-match`; remove that dependency or the test if it only covered agent matching

**Interfaces:**
- Consumes: Task 1 has already removed the bot webhook.
- Produces: **`lastContactedAt` now has exactly one writer**, `ContactsService.recordConversation` from Plan 1. This is the moment the coupling closes.

**Do NOT delete `lib/services/whatsapp-identity.ts`.** `public-leads.service.ts` imports it and `/api/public/leads` must keep working.

- [ ] **Step 1: Confirm Plan 1 is present**

Run: `test -f components/patterns/spoke-button.tsx && echo OK || echo MISSING`
Expected: `OK`. If `MISSING`, **stop** — deleting the webhooks without the דיברתי control leaves `lastContactedAt` with no writer and silently changes what the quiet-leads count in היום measures. Report BLOCKED.

- [ ] **Step 2: Verify the webhooks really are the only other writers**

Run: `grep -rn "lastContactedAt" --include='*.ts' app lib | grep -v tests`
Expected: writes only in `app/api/whatsapp/index/route.ts`, plus the read in `today.service.ts` and the write in `contacts.service.ts`. If a fourth writer exists, report it before continuing.

- [ ] **Step 3: Delete the services and the route**

```bash
git rm lib/services/whatsapp-agent.service.ts lib/services/whatsapp-tools.ts \
       lib/services/whatsapp-archive.ts lib/services/whatsapp-messages.ts \
       lib/services/fuzzy-match.ts
git rm -r "app/api/whatsapp"
git rm tests/whatsapp-index-webhook.test.ts tests/waha-media.test.ts
```

- [ ] **Step 4: Fix `tests/approval-paths.test.ts`**

It imports `fuzzy-match`. Read it. If the fuzzy matching was only there to resolve a WhatsApp sender to a contact, remove those cases; if it covers approval logic that survives, keep the test and drop only the import.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 6: Prove the coupling closed**

Run: `npx vitest run tests/today-quiet-leads.test.ts`
Expected: PASS. This test exists precisely for this moment. If it fails here, the teardown has broken the quiet-leads semantics and you must stop.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(teardown): delete the owner agent and passive indexing

Both WhatsApp webhooks are now gone, which makes ContactsService.recordConversation
the only writer of lastContactedAt. tests/today-quiet-leads.test.ts guards the
clause that reads it. whatsapp-identity survives: public-leads still needs it."
```

---

### Task 3: Delete AI extraction

**Files:**
- Delete: `lib/services/request-extraction.service.ts`, `intake-extraction.service.ts`, `media-understanding.service.ts`
- Delete: `app/api/cron/extract-requests/route.ts` and its directory
- Delete tests: `tests/request-extraction.test.ts`, `tests/media-understanding.test.ts`
- Modify: `tests/intake.test.ts` — **keep it.** `Request.intake` survives and Plan 4 repoints it at the client's own form. Strip only the cases that exercise model extraction.
- Modify: `vercel.json` (remove the `extract-requests` cron)

**Interfaces:**
- Produces: `Request.intake` is now written by nothing. Plan 4 gives it a writer (the portal form). It stays nullable, so existing rows keep their data and the portal keeps playing them back.

- [ ] **Step 1: Delete the services, the cron and the two tests**

```bash
git rm lib/services/request-extraction.service.ts lib/services/intake-extraction.service.ts \
       lib/services/media-understanding.service.ts
git rm -r "app/api/cron/extract-requests"
git rm tests/request-extraction.test.ts tests/media-understanding.test.ts
```

- [ ] **Step 2: Trim `tests/intake.test.ts` rather than deleting it**

Read it. Keep every case that tests the `intakeSchema` in `lib/validations/intake.ts` — that schema is Plan 4's ticket form. Remove only cases that call an extraction service.

- [ ] **Step 3: Remove the cron entry from `vercel.json`**

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(teardown): delete AI extraction

Request.intake keeps its schema, its portal playback and its operator edit
form; only the thing that filled it from chat goes. Plan 4 repoints it at the
client's own form, at which point כך הבנתי אותך becomes literally true."
```

---

### Task 4: Delete the product-card machinery

**Files:**
- Delete: `lib/services/product-card.service.ts`, `github.service.ts`, `support-repo-tools.ts`
- Delete: `app/api/cron/refresh-product-cards/route.ts`, `app/api/projects/[id]/agent-config/route.ts`, and both directories
- Delete: `app/(dashboard)/projects/[id]/agent/page.tsx` and its directory
- Delete tests: `tests/product-cards.test.ts`, `tests/support-repo-tools.test.ts`, `tests/github-service.test.ts`
- Modify: `vercel.json` (remove `refresh-product-cards`; the crons array is now empty)
- Modify: any nav or link pointing at `/projects/[id]/agent`

**Interfaces:**
- Produces: `vercel.json` has no crons at all. The `ProductCard` and `AgentProjectConfig` tables remain, unread and unwritten, until Plan 3 drops them.

- [ ] **Step 1: Find links to the agent page before deleting it**

Run: `grep -rn "/agent" --include='*.tsx' --include='*.ts' app components lib | grep -v 'agent-config' | grep -v node_modules`

Remove any nav entry, link or button that points there.

- [ ] **Step 2: Delete everything**

```bash
git rm lib/services/product-card.service.ts lib/services/github.service.ts lib/services/support-repo-tools.ts
git rm -r "app/api/cron/refresh-product-cards" "app/api/projects/[id]/agent-config" "app/(dashboard)/projects/[id]/agent"
git rm tests/product-cards.test.ts tests/support-repo-tools.test.ts tests/github-service.test.ts
```

- [ ] **Step 3: Empty the crons array**

`vercel.json` should now read `{ "crons": [] }` or have the key removed entirely. Either is valid; prefer removing the key.

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`
Expected: build output shows no `/api/cron/*` routes and no `/projects/[id]/agent`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(teardown): delete the product-card machinery

ADR 0001's precomputed cards existed to feed the support agent, which no longer
exists. The GitHub read-only tools go with them. vercel.json now has no crons.
The ProductCard and AgentProjectConfig tables stay until Plan 3 drops them."
```

---

### Task 5: Delete the morning brief

**Files:**
- Delete: `lib/services/morning-brief.service.ts`
- Delete: `app/api/cron/morning-brief/route.ts` and the now-empty `app/api/cron/` tree
- Delete tests: `tests/morning-brief-next-actions.test.ts`, `tests/morning-brief-route.test.ts`

**Interfaces:**
- Consumes: `owner-line.ts` must survive this — the brief was one of its callers, not its owner.
- Produces: nothing. `today.service.ts` is untouched and remains the answer to "what needs me today".

The spec deletes the brief outright rather than reducing it to a template: its ~250 lines of queries answered questions the dashboard and היום already answer, and only the prose was AI.

> **`morning-brief.service.ts` is not self-contained.** It exports `startOfIsraelDay`, and **two surviving modules import it**: `lib/services/today.service.ts` (lines 3, 96, 207) and `lib/services/money.service.ts` (lines 1, 43, 47). Deleting the file without relocating that function breaks היום *and* the money layer. Step 1 below moves it first; do not skip it.

- [ ] **Step 1: Relocate `startOfIsraelDay` before deleting anything**

Create `lib/utils/israel-day.ts` containing only that function, moved verbatim from `morning-brief.service.ts` along with its doc comment. It is a pure date helper with no Prisma and no model dependency, which is why it can leave the brief cleanly.

Then repoint both consumers:

```bash
grep -rn "startOfIsraelDay" --include='*.ts' app lib tests
```

Update the import in `lib/services/today.service.ts:3` and `lib/services/money.service.ts:1` to `@/lib/utils/israel-day`. Leave every call site otherwise untouched.

Run `npm run typecheck && npm run test` and commit this move on its own:

```bash
git add lib/utils/israel-day.ts lib/services/today.service.ts lib/services/money.service.ts lib/services/morning-brief.service.ts
git commit -m "refactor(dates): startOfIsraelDay leaves the morning brief

Two survivors import it, today.service and money.service, so it cannot go
down with the brief it happens to live in."
```

Committing the move separately means that if the deletion below goes wrong, the rescue of the helper is already safe in history.

- [ ] **Step 2: Confirm `owner-line` has other callers**

Run: `grep -rln "owner-line" --include='*.ts' app lib | grep -v morning-brief`
Expected: at least `app/api/public/leads/route.ts`, `app/api/public/requests/route.ts`, `lib/services/phases.service.ts`. If the brief is the only caller, something earlier went wrong — stop and report.

- [ ] **Step 3: Delete**

```bash
git rm lib/services/morning-brief.service.ts
git rm -r "app/api/cron"
git rm tests/morning-brief-next-actions.test.ts tests/morning-brief-route.test.ts
```

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(teardown): delete the morning brief

Its queries answered what the dashboard and היום already answer; only the prose
was AI, and the prose was the only part not duplicated. notifyOwner survives —
the brief was one of its callers, never its owner."
```

---

### Task 6: Delete `lib/ai` and retire the environment

**Files:**
- Delete: `lib/ai/models.ts`, `lib/ai/resilient-model.ts`, and the `lib/ai/` directory
- Delete tests: `tests/ai-models.test.ts`
- Modify: `package.json` — remove `@ai-sdk/gateway`, `@ai-sdk/openai-compatible`, `ai`
- Modify: `CLAUDE.md` and `AGENTS.md` — remove the environment variables and the prompt-caching section

**Interfaces:**
- Produces: no model is called anywhere in the repo. This is the commit that makes ADR 0004's headline claim true.

- [ ] **Step 1: Prove nothing imports `lib/ai` any more**

Run: `grep -rn "lib/ai\|@ai-sdk\|from 'ai'" --include='*.ts' --include='*.tsx' app lib components tests | grep -v node_modules`
Expected: only `lib/ai/`'s own files and `tests/ai-models.test.ts`.

One known false positive: `lib/services/owner-line.ts:21-24` carries a *comment* explaining that this module deliberately keeps its import graph free of the agent loop's `ai` / `@ai-sdk/gateway` dependency. It has no such import. Reword that comment to past tense rather than treating it as a hit.

**Any other hit means an earlier task missed something** — fix that first, do not delete around it.

- [ ] **Step 2: Delete**

```bash
git rm -r lib/ai
git rm tests/ai-models.test.ts
npm uninstall @ai-sdk/gateway @ai-sdk/openai-compatible ai
```

- [ ] **Step 3: Strip the environment documentation**

In `CLAUDE.md` and `AGENTS.md`, remove the lines documenting `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`, `SUPPORT_MEDIA_MODEL`, `PRODUCT_CARD_MODEL`, `INTAKE_MODEL`, `GITHUB_TOKEN`, `CRON_SECRET`, `WAHA_BOT_SESSION`, `WHATSAPP_BOT_PAUSED`, and the whole "Prompt caching" and "Pausing the bot" sections.

Keep `WHATSAPP_WEBHOOK_SECRET` documented only if something still reads it; check with grep first and remove it if not.

- [ ] **Step 4: Delete the Vercel variables**

These are not code and cannot be verified by the suite. List them for the user rather than deleting them yourself:

```bash
vercel env ls
```

Report which of the ten above still exist in production so the user can remove them. **Do not run `vercel env rm`** — that is a production change and is the user's call.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(teardown): no model is called anywhere

lib/ai and the three AI SDK dependencies go. With them go the insufficient_funds
outage class, the five-minute gateway cache TTL, the Ollama tier and ADR 0002's
whole degradation chain — they stop existing rather than being managed."
```

---

### Task 7: Flip the documentation to past tense

**Files:**
- Modify: `CONTEXT.md` — every `_Retires under ADR 0004._` marker introduced by Plan 1
- Modify: `docs/adr/0001-precomputed-product-cards.md`, `docs/adr/0002-degrade-dont-die.md` — the block quotes near the top
- Modify: `docs/adr/0004-the-crm-has-no-ai.md` — the `Status:` line

**Interfaces:**
- Consumes: Tasks 1-6. Do this **last**, when the claims are finally true.

Plan 1 deliberately wrote these in the present tense because none of the teardown had shipped. After Task 6, most of it has. This task makes the documents true again, in the other direction.

**Be precise about what is now true.** Plan 3 still owns the schema, so `ProductCard`, `Client.profileHe` and the `Request` AI columns **still exist** after this plan. Do not claim otherwise.

- [ ] **Step 1: Inventory the markers**

Run: `grep -n "Retires under ADR 0004\|still present as of this commit\|approved, not started" CONTEXT.md docs/adr/*.md`

- [ ] **Step 2: Update each entry to its post-Plan-2 truth**

| Entry | After this plan |
|---|---|
| כרטיס מוצר | The table still exists; nothing reads or writes it. Say so. Full removal is Plan 3 |
| פרופיל לקוח | Column still exists; nothing reads it. Plan 3 drops it |
| מילון | The bot that grew it is gone; the text remains in `profileHe` until Plan 3 |
| מוצר | Drop "the thing support conversations are about" — support conversations are gone |
| לתשלום | Drop the morning-brief paragraph — the brief is gone |
| הערות | Still complements `profileHe` until Plan 3 |
| פנייה | Intake is no longer model-extracted, and not yet client-written. Say it has no writer until Plan 4 |
| דיברתי | Now genuinely the only writer of `lastContactedAt`. Remove the "one of three" wording |
| ליד | Unchanged — the state reduction is Plan 3's |

- [ ] **Step 3: Update the ADR block quotes**

0001 and 0002: the *code* they describe is gone, so past tense is now correct for the agent and the degradation chain. 0001's `ProductCard` **table** is not gone — word it as "the support agent it fed was removed in Plan 2; the table itself goes in Plan 3".

0004: change `Status: approved, not started` to reflect partial implementation, naming which plans have landed.

- [ ] **Step 4: Verify no claim outruns the code**

For each past-tense claim you wrote, grep for the thing it says is gone. A claim that something was removed while `grep` still finds it is the exact defect Plan 1's final review caught.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: the teardown's runtime half has shipped

Flips the markers Plan 1 wrote in the present tense. Deliberately does not
claim the schema is gone: ProductCard, Client.profileHe and Request's AI
columns all still exist and are Plan 3's to remove."
```

---

## Done when

- `grep -rn "@ai-sdk\|from 'ai'" app lib components` returns nothing outside `node_modules`.
- `vercel.json` has no crons.
- `npm run typecheck && npm run test && npm run build` green.
- `tests/today-quiet-leads.test.ts` passes, proving the `lastContactedAt` coupling survived.
- `owner-line`, `waha.service`, `waha-transport` and `whatsapp-identity` all still exist, and `/api/public/leads` still works.
- No document claims the schema was dropped.

## Explicitly not in this plan

- Dropping any model, table or column, and the JSON export that must precede it. **Plan 3.**
- Removing `profileHe`'s UI (`components/clients/profile-card.tsx`, `client-profile.service.ts`) and the `Request` AI columns' ten consumers. **Plan 3.**
- The operator IA rebuild and the lead-state reduction. **Plan 3.**
- The portal contact select and type-conditional intake. **Plan 4.**
- Per-project quick links. **Plan 5.**
