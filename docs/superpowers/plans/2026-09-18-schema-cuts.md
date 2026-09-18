# Schema cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Contact/Client split and reduce the lead pipeline from four active states to two.

**Architecture:** Two independent cuts, each code-then-schema. Both are data migrations as well as schema changes: existing rows carry values that will no longer be legal, so each task moves the data before it narrows the column.

**Tech Stack:** Prisma 7, PostgreSQL (Supabase pooled), Next.js 16, vitest.

**Spec:** [`docs/superpowers/specs/2026-09-18-agent-teardown-and-crm-restructure-design.md`](../specs/2026-09-18-agent-teardown-and-crm-restructure-design.md)

This is **Plan 4 of 7**. See "Corrections to the spec" below — the plan count grew because three of the spec's claims did not survive contact with the code.

## Corrections to the spec, which this plan implements instead

The spec's "Upkeep cuts" paragraph says business facts `company`, `address`, `taxId` and `isVip` all move to `Client`. **`company` must stay on `Contact`**, and this plan keeps it.

`lib/services/clients.service.ts:145` reads:

```ts
name: overrides?.name ?? contact.company ?? contact.name
```

`Contact.company` is the lead's *stated* business name, captured before any `Client` row exists, and it seeds `Client.name` at conversion. `/api/public/leads` accepts it from the website form (`app/api/public/leads/route.ts:37`) and the leads table renders it (`app/(dashboard)/leads/page.tsx:165`). A lead has no `clientId`, so there is nowhere else for it to live. Removing it would break both lead intake and lead-to-client conversion.

`address`, `taxId` and `isVip` are genuinely duplicated: on `Contact` they appear only in the update schema (`lib/validations/contact.ts:38-40`), the wire type, and a read-only card. Those three move.

## Dependencies and ordering

- **Plans 2 and 3 (the AI teardown) should merge first.** Not strictly required — these cuts touch different columns — but `whatsapp-tools.ts` reads `Contact.company` and is deleted in Plan 2, so doing this first means editing a file that is about to disappear.
- **Priority is not in this plan.** Collapsing `Priority` to a boolean touches **40 files** and is Plan 5, alone.
- **The IA work is not in this plan.** It is far smaller than the spec implies — see below — and is Plan 6.

## Global Constraints

- All UI text in Hebrew. Layout is RTL.
- Service errors reaching the API layer **must contain Hebrew**, or `withAuth` maps them to 500 instead of 400.
- Every service method takes `userId` first; every query scoped by it.
- Never mutate objects; use spread.
- Hebrew labels via `lib/design/labels.ts`, tones via `lib/design/tones.ts`. Never inline either.
- Status chips through `<StatusPill>`, never `<Badge>`.
- Do **not** run `prettier`.
- **Do not run Playwright** (`e3a2090` is stranded on `fix/money-status-coverage`). Gate: `npm run typecheck && npm run test && npm run build`.
- **`db:push` times out on the Supabase pooler.** Ship SQL as `scripts/NN_*.sql` via `prisma db execute`. Plan 3 uses `18_`; yours are `19_` and `20_`.

---

### Task 1: Business facts live on Client only

**Files:**
- Modify: `prisma/schema.prisma` (`Contact`), `lib/types/contact.ts` (lines 39-41), `lib/validations/contact.ts` (lines 38-40)
- Modify: `components/contacts/contact-info-card.tsx` (lines 70-80), `components/forms/contact-form.tsx`
- Modify: `app/(dashboard)/contacts/[id]/page.tsx`
- Create: `scripts/19_contact_business_fields.sql`

**Interfaces:**
- Produces: `Contact` no longer has `address`, `taxId` or `isVip`. It **keeps** `company`.

- [ ] **Step 1: Migrate the data before narrowing anything**

Any contact that carries a business fact its client does not is about to lose it. Move it first.

Create `scripts/19_contact_business_fields.sql`:

```sql
-- Business facts belong to the business. Copy anything a Contact holds that
-- its Client does not, then drop the duplicated columns.
--
-- `company` is deliberately NOT dropped: it is the lead's stated business name,
-- captured before a Client exists, and it seeds Client.name at conversion.

BEGIN;

UPDATE "Client" c
SET "address" = ct."address"
FROM "Contact" ct
WHERE ct."clientId" = c."id"
  AND c."address" IS NULL
  AND ct."address" IS NOT NULL;

UPDATE "Client" c
SET "taxId" = ct."taxId"
FROM "Contact" ct
WHERE ct."clientId" = c."id"
  AND c."taxId" IS NULL
  AND ct."taxId" IS NOT NULL;

UPDATE "Client" c
SET "isVip" = true
FROM "Contact" ct
WHERE ct."clientId" = c."id"
  AND ct."isVip" = true
  AND c."isVip" = false;

ALTER TABLE "Contact" DROP COLUMN IF EXISTS "address";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "taxId";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "isVip";

COMMIT;
```

**Do not run it yet.** Code comes first.

- [ ] **Step 2: Check what would be lost**

Before touching code, run a read-only query so the report can state the blast radius:

```sql
SELECT count(*) FROM "Contact" WHERE "clientId" IS NULL AND ("address" IS NOT NULL OR "taxId" IS NOT NULL OR "isVip" = true);
```

Contacts with **no** client carry business facts that the migration cannot move anywhere. Report the count. If it is non-zero, say so prominently — those values are lost, and that is a decision for Itay, not for you.

- [ ] **Step 3: Remove the fields from code**

- `lib/types/contact.ts`: delete `isVip`, `address`, `taxId`. Keep `company`.
- `lib/validations/contact.ts:38-40`: delete the three fields from the update schema. Keep `company` in both create and update schemas.
- `components/contacts/contact-info-card.tsx:70-80`: remove the address and taxId rows.
- `components/forms/contact-form.tsx`: remove the three inputs if present.
- `app/(dashboard)/contacts/[id]/page.tsx`: remove any reference.

- [ ] **Step 4: Add a comment recording why `company` stays**

In `prisma/schema.prisma`, above `Contact.company`:

```prisma
  /// The lead's stated business name, captured before any Client exists. Seeds
  /// Client.name at conversion (ClientsService.convertContactToClient). Not a
  /// duplicate of Client data: a lead has no clientId, so this is the only
  /// place it can live.
  company         String?
```

- [ ] **Step 5: Let typecheck find the rest**

Run: `npm run typecheck` and fix every error it names.

- [ ] **Step 6: Apply the migration and update Prisma**

Remove `address`, `taxId`, `isVip` from `model Contact` in `prisma/schema.prisma`, then:

```bash
npx prisma db execute --file scripts/19_contact_business_fields.sql --schema prisma/schema.prisma
npx prisma generate
```

- [ ] **Step 7: Gate and commit**

Run: `npm run typecheck && npm run test && npm run build`

```bash
git add -A
git commit -m "refactor(contacts): business facts live on the business

address, taxId and isVip were on both Contact and Client, so the same fact had
to be entered twice. Anything a Contact held that its Client did not is copied
across first.

company stays on Contact deliberately: it is the lead's stated business name,
captured before a Client row exists, and it seeds Client.name at conversion.
The spec said to move it; the spec was wrong."
```

---

### Task 2: Two active lead states

**Files:**
- Modify: `lib/validations/enums.ts` (`contactStatus` at :41, `LEAD_STATUSES` at :62)
- Modify: `lib/design/labels.ts` (:117-118), `lib/design/tones.ts` (:87-88)
- Modify: `prisma/schema.prisma` (`ContactStatus` enum)
- Modify: `components/contacts/contact-status-select.tsx`
- Create: `scripts/20_lead_states.sql`
- Modify: tests asserting the four-state pipeline, incl. `tests/contact-pipeline.test.ts:157`, `tests/morning-brief-next-actions.test.ts:78` (if it survives Plan 2)

**Interfaces:**
- Produces: `ContactStatus` becomes `NEW | QUOTED | CLIENT | LOST | INACTIVE`. `LEAD_STATUSES` becomes `['NEW', 'QUOTED']`.

The reasoning, from the grilling: neither `CONTACTED` nor `MEETING_SCHEDULED` said anything `nextActionNote` did not already say in Itay's own words, and both had to be advanced by hand. The only distinction worth a state is whether a price is already with them.

- [ ] **Step 1: Preserve what the retired states were telling you**

A contact sitting in `MEETING_SCHEDULED` carries real information: a meeting is booked. Collapsing it to `NEW` silently throws that away. Move it into `nextActionNote`, which is exactly the field that replaces these states.

Create `scripts/20_lead_states.sql`:

```sql
-- Two active lead states instead of four. CONTACTED and MEETING_SCHEDULED
-- collapse into NEW; what they were telling us moves into nextActionNote,
-- which is the field that replaces them.

BEGIN;

UPDATE "Contact"
SET "nextActionNote" = COALESCE("nextActionNote", 'נקבעה פגישת אפיון - לעדכן מה סוכם')
WHERE "status" = 'MEETING_SCHEDULED';

UPDATE "Contact"
SET "nextActionNote" = COALESCE("nextActionNote", 'נוצר קשר - להמשיך מכאן')
WHERE "status" = 'CONTACTED';

UPDATE "Contact"
SET "status" = 'NEW'
WHERE "status" IN ('CONTACTED', 'MEETING_SCHEDULED');

COMMIT;
```

`COALESCE` means an existing note is never overwritten. Both states collapse to `NEW` rather than `QUOTED`, because neither implies a price went out.

> The Postgres enum type itself is **not** altered here. Dropping a value from a Postgres enum requires recreating the type, and leaving the two values unused is harmless. Prisma's enum is what the application enforces. Say so in your report rather than attempting an enum rewrite.

- [ ] **Step 2: Count what will move**

Run, read-only, and report the numbers:

```sql
SELECT "status", count(*) FROM "Contact" WHERE "status" IN ('CONTACTED','MEETING_SCHEDULED') GROUP BY "status";
```

- [ ] **Step 3: Narrow the application enums**

`lib/validations/enums.ts`:

```ts
export const contactStatus = z.enum(['NEW', 'QUOTED', 'CLIENT', 'LOST', 'INACTIVE'])
```

```ts
/**
 * The lead pipeline, in the order a lead actually moves through it.
 *
 * Two states, not four. CONTACTED and MEETING_SCHEDULED were removed because
 * neither said anything nextActionNote did not already say in Itay's own
 * words, while both had to be advanced by hand. What a lead is waiting on is
 * prose; the only distinction worth a state is whether a price is with them.
 *
 * LOST is deliberately absent, as before: it is a terminal state, not a stage,
 * and the לידים tab answers "what do I still have to chase".
 */
export const LEAD_STATUSES = ['NEW', 'QUOTED'] as const
```

Leave `CLIENT_STATUSES` and `TERMINAL_CONTACT_STATUSES` unchanged.

- [ ] **Step 4: Remove the labels and tones**

`lib/design/labels.ts`: delete the `CONTACTED` and `MEETING_SCHEDULED` entries.
`lib/design/tones.ts`: delete their tone mappings.

`tests/design-tones.test.ts` asserts every map value is a real tone and that no raw palette class appears. It should still pass; if it fails, you have removed a key one map still needs.

- [ ] **Step 5: Update the status select**

`components/contacts/contact-status-select.tsx` offers the reachable statuses. With two active states the choice is now NEW, QUOTED, CLIENT, LOST. Read its existing comment first — it records why certain transitions were offered.

- [ ] **Step 6: Update the Prisma enum**

In `prisma/schema.prisma`, remove `CONTACTED` and `MEETING_SCHEDULED` from `enum ContactStatus`.

- [ ] **Step 7: Fix the tests**

`npm run test` will fail on assertions naming the four states. Known: `tests/contact-pipeline.test.ts:157` and `:138-142`, and `tests/morning-brief-next-actions.test.ts:78` if Plan 2 left it. Update the expected arrays; **do not** delete the pipeline tests — they cover the derive-on-create rule and the terminal-status clearing rule, both of which survive.

- [ ] **Step 8: Apply and gate**

```bash
npx prisma db execute --file scripts/20_lead_states.sql --schema prisma/schema.prisma
npx prisma generate
npm run typecheck && npm run test && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(leads): two active states instead of four

CONTACTED and MEETING_SCHEDULED collapse into NEW. What they were telling us
moves into nextActionNote first, with COALESCE so an existing note is never
overwritten: a booked meeting is real information and should not vanish into a
status change.

The Postgres enum keeps both values as unused; dropping one requires recreating
the type and Prisma's enum is what the application enforces."
```

---

### Task 3: Update the glossary

**Files:**
- Modify: `CONTEXT.md` (the ליד entry)

- [ ] **Step 1: Make ליד describe the code**

Replace the four-state pipeline with `NEW → QUOTED`, and **remove the forward-reference** added in Plan 1 ("Reduces to ... under the pending agent-teardown-and-crm-restructure design") — it has now happened.

Keep the reasoning, which is the part worth preserving:

> Two active states, not four. `CONTACTED` and `MEETING_SCHEDULED` were removed because neither said anything **פעולה הבאה** did not already say in Itay's own words, while both had to be advanced by hand. What a lead is waiting on is prose, not an enum; the only distinction worth a state is whether a price is already with them.

Note that the Postgres enum retains the two values as unused, so a reader querying the database directly is not surprised.

- [ ] **Step 2: Verify no claim outruns the code**

Run: `grep -rn "CONTACTED\|MEETING_SCHEDULED" CONTEXT.md CLAUDE.md AGENTS.md lib/validations/enums.ts`
Expected: only the historical explanation in `CONTEXT.md` and `enums.ts`'s comment. `CLAUDE.md` still documents the four-state pipeline and must be corrected here.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: ליד is two active states"
```

---

## Done when

- `Contact` has no `address`, `taxId` or `isVip`, and **still has `company`**.
- `LEAD_STATUSES` is `['NEW', 'QUOTED']` and no contact row sits in a retired state.
- `npm run typecheck && npm run test && npm run build` green.
- `CONTEXT.md` and `CLAUDE.md` both describe two active states.

## Not in this plan

- **`Priority` to a boolean.** 40 files. **Plan 5**, alone.
- **The IA work.** Much smaller than the spec implies: `nav-items.ts` already splits into `NAV_PRIMARY` / `NAV_REGISTRY` / `NAV_FOOTER` and `sidebar.tsx` renders them separated by rules, so the hierarchy exists. The only real change is merging משימות and פרויקטים into one עבודה surface. **Plan 6.**
- **Portal contact select, type-conditional intake, per-project quick links. Plan 7.**
