# AI schema teardown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the five AI models, `Client.profileHe` and `Request`'s four AI columns, after exporting everything they hold.

**Architecture:** Code first, schema last. Every column is removed from TypeScript, validation and UI *before* the SQL drops it, so the running app never references a column that no longer exists. The export precedes all of it and is the only step that cannot be undone by `git revert`.

**Tech Stack:** Prisma 7, PostgreSQL (Supabase pooled), Next.js 16, vitest.

**Spec:** [`docs/superpowers/specs/2026-09-18-agent-teardown-and-crm-restructure-design.md`](../specs/2026-09-18-agent-teardown-and-crm-restructure-design.md)
**Decision record:** [`docs/adr/0004-the-crm-has-no-ai.md`](../../adr/0004-the-crm-has-no-ai.md)

This is **Plan 3 of 5**.

## Dependencies and ordering

- **Plan 2 (agent runtime teardown) must merge first.** It deletes every service that writes these tables. Running this plan first would drop columns while live code still writes them. Verify: `test -d lib/ai && echo BLOCKED || echo OK` must print `OK`.
- **Plan 4** is the schema *cuts* and IA rebuild (Contact/Client split, `Priority` to boolean, lead-state reduction, the four-surface nav). Not here. This plan removes only what the AI owned.
- **Plan 5** is the portal and per-project quick links.

## Global Constraints

- All UI text in Hebrew. Layout is RTL.
- Service errors reaching the API layer **must contain Hebrew**, or `withAuth` maps them to 500 instead of 400.
- Every service method takes `userId` first; every query scoped by it.
- Never mutate objects; use spread.
- Hebrew labels via `lib/design/labels.ts`, tones via `lib/design/tones.ts`. Never inline either.
- Status chips through `<StatusPill>`, never `<Badge>`.
- Do **not** run `prettier`.
- **Do not run Playwright** — it cannot start on any branch cut from `main` (`e3a2090` is stranded on `fix/money-status-coverage`). Gate is `npm run typecheck && npm run test && npm run build`.
- **`db:push` times out on the Supabase pooler.** Schema changes ship as idempotent SQL in `scripts/NN_*.sql` run with `prisma db execute`. The last is `17_phase_client_review.sql`, so yours is `18_`.

## The one irreversible step

Task 1 exports data that Task 4 destroys. **There is no test that catches a bad export.** Between them sits a human step: Itay reads each client's `profileHe` and merges what is worth keeping into `notes` by hand. Task 4 does not start until he says it is done.

`WhatsAppMessage` in particular holds months of real client conversation indexed from Itay's personal WhatsApp. Once dropped it is gone.

---

### Task 1: Export everything before anything is dropped

**Files:**
- Create: `scripts/export-ai-tables.ts`
- Modify: `.gitignore` (add the export directory)

**Interfaces:**
- Produces: `.ai-export/<table>.json` for five tables, plus `.ai-export/profileHe.md` formatted for human reading.

- [ ] **Step 1: Add the export directory to `.gitignore`**

Append:

```
# One-off export taken before the AI schema teardown (ADR 0004). Contains
# real client conversation; never commit it.
.ai-export/
```

- [ ] **Step 2: Write the export script**

Create `scripts/export-ai-tables.ts`:

```ts
/**
 * One-off export, taken immediately before ADR 0004's schema teardown drops
 * these tables. Everything here is unrecoverable afterwards: WhatsAppMessage
 * alone holds months of real client conversation indexed from the personal
 * session.
 *
 * Writes to .ai-export/, which is gitignored. Run with:
 *   npx tsx scripts/export-ai-tables.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { prisma } from '../lib/db/prisma'

const OUT = '.ai-export'

async function main() {
  mkdirSync(OUT, { recursive: true })

  const tables = {
    whatsAppMessage: () => prisma.whatsAppMessage.findMany(),
    botConversation: () => prisma.botConversation.findMany(),
    supportConversation: () => prisma.supportConversation.findMany(),
    agentProjectConfig: () => prisma.agentProjectConfig.findMany(),
    productCard: () => prisma.productCard.findMany(),
  }

  for (const [name, read] of Object.entries(tables)) {
    const rows = await read()
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rows, null, 2))
    console.log(`${name}: ${rows.length} rows`)
  }

  // profileHe gets its own human-readable file: it is the one thing a person
  // has to read and merge by hand, not a blob to archive.
  const clients = await prisma.client.findMany({
    where: { profileHe: { not: null } },
    select: { id: true, name: true, notes: true, profileHe: true },
    orderBy: { name: 'asc' },
  })

  const md = clients
    .map(
      (c) =>
        `# ${c.name}\n\n` +
        `<!-- clientId: ${c.id} -->\n\n` +
        `## הערות (current, owner-private)\n\n${c.notes ?? '(none)'}\n\n` +
        `## פרופיל (to merge, then delete)\n\n${c.profileHe}\n\n---\n`
    )
    .join('\n')

  writeFileSync(`${OUT}/profileHe.md`, md)
  console.log(`profileHe: ${clients.length} clients with a profile`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run it**

Run: `npx tsx scripts/export-ai-tables.ts`
Expected: five row counts plus a client count. Record every number in your report — Task 4's verification compares against them.

- [ ] **Step 4: Verify the export is real, not empty**

Run: `ls -la .ai-export/ && wc -c .ai-export/*`
Expected: five JSON files and one `.md`. **A zero-length or `[]` file for a table you expected rows in means stop.** Report it rather than proceeding; a silent empty export is the one failure this plan cannot recover from.

- [ ] **Step 5: Confirm it is not staged**

Run: `git status --short | grep ai-export`
Expected: **no output.** If the directory shows up, `.gitignore` did not take effect and you must fix that before committing anything.

- [ ] **Step 6: Commit the script only**

```bash
git add scripts/export-ai-tables.ts .gitignore
git commit -m "chore(teardown): export the AI tables before dropping them

Writes .ai-export/, gitignored. profileHe gets a human-readable file because
it is the one thing that needs reading and merging by hand rather than
archiving."
```

- [ ] **Step 7: Hand off to the human**

Report to the controller, and stop this task, with:
- the row counts from Step 3
- the number of clients with a profile
- the path `.ai-export/profileHe.md`

**Task 4 must not run until Itay confirms he has merged what he wants from `profileHe.md` into each client's `notes`.** That is a decision about his own client knowledge and no agent can make it for him.

---

### Task 2: Remove `Request`'s AI columns from the code

**Files:**
- Modify: `lib/types/request.ts` (lines 36-38, 45)
- Modify: `lib/validations/request.ts` (lines 77-79)
- Modify: `components/requests/request-badges.tsx` (lines 67-73 and the badges they render)
- Modify: `components/requests/request-list-card.tsx`
- Modify: `lib/services/request-timeline.ts` (line 38)
- Modify: `lib/services/client-view.ts` (the doc comment at 234-236, and line 292)
- Modify: `lib/services/requests.service.ts`, `public-requests.service.ts`
- Modify: `app/(dashboard)/requests/page.tsx`, `app/(dashboard)/requests/[id]/page.tsx`, `app/r/[token]/projects/page.tsx`
- Modify: `tests/client-view.test.ts` and any test asserting on these fields

**Interfaces:**
- Consumes: nothing.
- Produces: no TypeScript refers to `isAiGenerated`, `aiConfidence`, `aiNote` or `sourceMessageId`. Task 4 can then drop them safely.

**The columns stay in the database during this task.** Prisma will still generate them; you are removing the code that reads them.

- [ ] **Step 1: Read the two places that carry meaning, not just types**

`lib/services/request-timeline.ts:38` reads:

```ts
note: request.isAiGenerated ? 'נוצרה אוטומטית מהודעה' : undefined,
```

With nothing auto-generating requests, that branch is permanently false. **Delete the `note` line entirely**, not just the condition — an always-`undefined` field is noise.

`lib/services/client-view.ts:234-236` is a doc comment naming `aiNote`, `aiConfidence`, `isAiGenerated`, `userId`, `taskId` and `sourceMessageId` as fields that must never reach a client's screen. **The whitelist itself stays** — it still protects `userId` and `taskId`. Edit the comment to drop the three AI fields and `sourceMessageId` from its list, and keep the rest of its warning intact. Do not weaken the whitelist.

`client-view.ts:292` describes the timeline reading `isAiGenerated`. Update that comment to match Step 1's deletion.

- [ ] **Step 2: Remove the fields from types and validation**

`lib/types/request.ts`: delete `isAiGenerated`, `aiConfidence`, `aiNote`, `sourceMessageId`.
`lib/validations/request.ts`: delete `sourceMessageId`, `aiConfidence`, `aiNote` from the schema.

- [ ] **Step 3: Remove the badges**

`components/requests/request-badges.tsx` takes all three AI fields as props and renders chips from them. Remove the props, their types, and the chips. If that leaves the component with nothing but a status pill, say so in your report rather than deleting the component — a later plan may still want it.

Then fix `components/requests/request-list-card.tsx` and both operator request pages where they pass those props.

- [ ] **Step 4: Let typecheck find the rest**

Run: `npm run typecheck`

Work through every error it reports. This is the reliable way to find the remaining consumers; do not guess from grep alone.

- [ ] **Step 5: Fix the tests**

Run: `npm run test`

`tests/client-view.test.ts` likely asserts the AI fields are excluded from the client payload. Those assertions are now about fields that do not exist. **Do not just delete them** — check whether each one also covers `userId` or `taskId`, which still matter. Keep those, remove only the AI-field cases.

- [ ] **Step 6: Confirm nothing references them**

Run: `grep -rn "isAiGenerated\|aiConfidence\|aiNote\|sourceMessageId" --include='*.ts' --include='*.tsx' app lib components tests`
Expected: no output. `prisma/schema.prisma` will still declare them — that is correct until Task 4.

- [ ] **Step 7: Gate and commit**

Run: `npm run typecheck && npm run test && npm run build`

```bash
git add -A
git commit -m "refactor(requests): stop reading the AI columns

The four columns stay in the database until this plan's schema task; this only
removes the code that reads them. The timeline's 'נוצרה אוטומטית מהודעה' note
goes with them, since nothing auto-generates a request any more. client-view's
field whitelist keeps protecting userId and taskId."
```

---

### Task 3: Remove `Client.profileHe` from the code

**Files:**
- Delete: `components/clients/profile-card.tsx` (84 lines), `lib/services/client-profile.service.ts` (112 lines)
- Delete: `tests/client-profile.test.ts`
- Modify: `app/(dashboard)/clients/[id]/page.tsx` (the `profileHe` field at line 67, the render at line 551)
- Modify: `lib/validations/client.ts` (line 11)

**Interfaces:**
- Produces: no TypeScript refers to `profileHe`. `Client.notes` is unchanged and remains the owner-private free text.

`client-profile.service.ts` also exports `GLOSSARY_HEADER` and `addGlossaryEntry` — the מילון the bot grew inside the profile. Both go with it; nothing else grows a glossary.

- [ ] **Step 1: Confirm the export happened**

Run: `test -f .ai-export/profileHe.md && echo OK || echo BLOCKED`
Expected: `OK`. If `BLOCKED`, Task 1 did not run — stop, because this task removes the UI that displays the text Itay still needs to read.

- [ ] **Step 2: Delete the card and the service**

```bash
git rm components/clients/profile-card.tsx lib/services/client-profile.service.ts tests/client-profile.test.ts
```

- [ ] **Step 3: Fix the client detail page**

In `app/(dashboard)/clients/[id]/page.tsx`: remove the `profileHe?: string | null` field from the client type (line 67), the `<ProfileCard ... />` render (around line 551), and the now-unused import.

- [ ] **Step 4: Remove it from validation**

`lib/validations/client.ts:11`: delete the `profileHe` field.

- [ ] **Step 5: Confirm and gate**

Run: `grep -rn "profileHe\|GLOSSARY_HEADER\|addGlossaryEntry" --include='*.ts' --include='*.tsx' app lib components tests`
Expected: no output (`prisma/schema.prisma` still declares the column; correct until Task 4).

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(clients): stop reading profileHe

The bot-visible profile and the מילון it grew both go. Client.notes is
untouched and becomes the only free text the CRM holds about a business.
The column itself drops in this plan's schema task, after its contents have
been merged by hand."
```

---

### Task 4: Drop the schema

**Files:**
- Create: `scripts/18_drop_ai_schema.sql`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: Tasks 1-3. No code references any of this.
- Produces: the five models, `Client.profileHe` and `Request`'s four AI columns no longer exist.

> **Do not start this task until the controller confirms Itay has merged `profileHe.md` into each client's `notes`.** If that confirmation is not in your dispatch, report BLOCKED.

- [ ] **Step 1: Re-verify no code references the schema you are about to drop**

Run:

```bash
grep -rn "whatsAppMessage\|botConversation\|supportConversation\|agentProjectConfig\|productCard\|profileHe\|isAiGenerated\|aiConfidence\|aiNote\|sourceMessageId" \
  --include='*.ts' --include='*.tsx' app lib components tests
```

Expected: **no output.** Any hit means Task 2 or 3 is incomplete — fix that first.

- [ ] **Step 2: Write the migration**

Create `scripts/18_drop_ai_schema.sql`. Idempotent, because these scripts are run by hand and may be run twice:

```sql
-- ADR 0004: the CRM has no AI. Drops the five models the agent owned, the
-- bot-visible client profile, and Request's AI provenance columns.
--
-- Contents were exported to .ai-export/ first; profileHe was merged into
-- Client.notes by hand. Nothing here is recoverable from this database.

BEGIN;

ALTER TABLE "Request" DROP COLUMN IF EXISTS "isAiGenerated";
ALTER TABLE "Request" DROP COLUMN IF EXISTS "aiConfidence";
ALTER TABLE "Request" DROP COLUMN IF EXISTS "aiNote";
ALTER TABLE "Request" DROP COLUMN IF EXISTS "sourceMessageId";

ALTER TABLE "Client" DROP COLUMN IF EXISTS "profileHe";

DROP TABLE IF EXISTS "SupportConversation";
DROP TABLE IF EXISTS "BotConversation";
DROP TABLE IF EXISTS "AgentProjectConfig";
DROP TABLE IF EXISTS "ProductCard";
DROP TABLE IF EXISTS "WhatsAppMessage";

COMMIT;
```

Order matters: `Request.sourceMessageId` references `WhatsAppMessage`, so the column goes before the table.

- [ ] **Step 3: Update the Prisma schema to match**

In `prisma/schema.prisma`, delete:
- `model WhatsAppMessage`, `model BotConversation`, `model SupportConversation`, `model AgentProjectConfig`, `model ProductCard`
- `enum AgentMonitoringStatus` and `enum MessageDirection`, if nothing else uses them (check first)
- `Client.profileHe`
- `Request.isAiGenerated`, `aiConfidence`, `aiNote`, `sourceMessageId`, and the `sourceMessage` relation
- the back-relations on `Contact` (`whatsappMessages`, `supportConversations`) and `Client` (`supportConversations`)

- [ ] **Step 4: Apply the migration**

Run: `npx prisma db execute --file scripts/18_drop_ai_schema.sql --schema prisma/schema.prisma`

Then regenerate: `npx prisma generate`

> `db:push` times out on the Supabase pooler. Use `db execute` as above.

- [ ] **Step 5: Verify the database matches the schema**

Run: `npx prisma validate && npx prisma db pull --print | grep -c "model "`

Compare the model count against `grep -c "^model " prisma/schema.prisma`. They must agree. If `db pull` shows a model your schema no longer declares, the SQL did not fully apply.

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run test && npm run build`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(teardown): drop the AI schema

Five models, Client.profileHe and Request's four AI provenance columns.
Contents were exported to .ai-export/ and profileHe was merged into notes by
hand before this ran. Shipped as scripts/18_*.sql via prisma db execute,
since db:push times out on the Supabase pooler."
```

---

### Task 5: Make the documentation true

**Files:**
- Modify: `CONTEXT.md`, `docs/adr/0001-*.md`, `docs/adr/0002-*.md`, `docs/adr/0004-*.md`
- Modify: `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: Tasks 1-4.

After this task the AI teardown is complete, so past tense is finally correct everywhere. Plan 1's final review caught documents claiming a teardown that had not happened; the symmetric failure is leaving them hedged after it has.

- [ ] **Step 1: Retire the glossary entries that now describe nothing**

In `CONTEXT.md`, **delete** the כרטיס מוצר, פרופיל לקוח and מילון entries outright — their code is gone, and a glossary of the ubiquitous language should not define terms the system no longer has. Remove the `_Retires under ADR 0004._` markers from every remaining entry.

Update הערות: it is now simply the owner-private free text, with no profile to complement.

Leave ליד's forward reference to the lead-state reduction, which is Plan 4's and has not happened.

- [ ] **Step 2: Update the preamble**

Remove the note explaining the retirement markers, since none remain.

- [ ] **Step 3: Finalise the ADRs**

`0001` and `0002`: past tense is now fully correct. Say the removal completed, and name this plan.
`0004`: update `Status:` to reflect that the teardown itself has shipped, noting plans 4 and 5 still carry the CRM restructure and portal work.

- [ ] **Step 4: Strip the agent sections from `CLAUDE.md` and `AGENTS.md`**

Remove the data-model entries for the five dropped models, the WhatsApp/WAHA environment block, the "Pausing the bot" section, the "Prompt caching" section, and any description of the support agent, ProductCards or the morning brief.

**Keep** the sections on the money model, status colours, the client portal, request billing, Hebrew/RTL and the service/API patterns — none of that changed.

- [ ] **Step 5: Verify no claim outruns the code**

For each past-tense claim, grep for the thing it says is gone. This is the exact check Plan 1's review had to apply in the other direction.

Run: `grep -rn "ProductCard\|profileHe\|support agent\|morning brief\|WHATSAPP_BOT_PAUSED" CLAUDE.md AGENTS.md CONTEXT.md`
Expected: only historical references in the ADRs, none in the three instruction files.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: the AI teardown is complete

CONTEXT.md drops the three terms whose code no longer exists; CLAUDE.md and
AGENTS.md lose the agent, the bot environment and prompt caching. ליד keeps its
forward reference, since the lead-state reduction is Plan 4's."
```

---

## Done when

- `grep -rn "whatsAppMessage\|botConversation\|supportConversation\|agentProjectConfig\|productCard\|profileHe\|isAiGenerated\|aiConfidence\|aiNote\|sourceMessageId" app lib components tests` returns nothing.
- `prisma/schema.prisma` declares exactly **7** models, down from 12: `User`, `Contact`, `Client`, `Project`, `ProjectPhase`, `Task`, `Request`. Verify with `grep -c "^model " prisma/schema.prisma`.
- `npx prisma validate` passes and `db pull` agrees with the schema.
- `npm run typecheck && npm run test && npm run build` green.
- `.ai-export/` exists locally and is **not** in git.
- No instruction file describes the agent.

## Risks

| Risk | Mitigation |
|---|---|
| Export silently empty, then tables dropped | Task 1 Step 4 checks file sizes and stops on a zero-length file; Task 4 refuses to start without confirmation |
| `profileHe` dropped before Itay reads it | Task 4 is gated on explicit human confirmation, not on a file existing |
| A dropped column still referenced at runtime | Tasks 2 and 3 remove all code first; Task 4 Step 1 re-verifies with grep before the SQL runs |
| The SQL half-applies | Wrapped in `BEGIN`/`COMMIT`; Step 5 compares `db pull` against the schema |
| Docs left hedged after the work completes | Task 5 Step 5 greps every past-tense claim |
