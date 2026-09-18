# דיברתי control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `Contact.lastContactedAt` a manual writer before the WhatsApp webhooks that currently write it are deleted.

**Architecture:** One new service method (`ContactsService.recordConversation`), one dedicated POST route, and one button component used from both the contact detail page and the leads table row. The timestamp is server-side and never caller-supplied, because "I spoke to them" is an event happening now, not a field to backdate.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Zod 4, React 19, vitest, Playwright, shadcn/ui, Tailwind, react-hot-toast.

**Spec:** [`docs/superpowers/specs/2026-09-18-agent-teardown-and-crm-restructure-design.md`](../specs/2026-09-18-agent-teardown-and-crm-restructure-design.md)

This is **Plan 1 of 4**. It must merge before the teardown plan deletes `app/api/whatsapp/*`.

## Global Constraints

- All UI text in Hebrew. Layout is RTL (`dir="rtl"`, `lang="he"`).
- Service errors thrown to the API layer **must contain Hebrew**, or `withAuth` maps them to 500 instead of 400. See `lib/api/api-handler.ts`.
- Every service method takes `userId` first and **every query is scoped by it**.
- Never mutate objects; build new ones with spread.
- Hebrew labels come from `lib/design/labels.ts`, tones from `lib/design/tones.ts`. Never inline either.
- Status chips render through `<StatusPill>`, never `<Badge>`. Never pass a `bg-*` class through `StatusPill`'s `className`.
- New shared UI lives in `components/patterns/` and is held to **zero physical direction utilities** (`ml-`, `pr-`, `left-`, …) by `tests/design-rtl.test.ts`. Use logical properties (`ms-`, `pe-`, `start-`).
- Do **not** run `prettier`; it has no config here and rewrites to a style that is not the house style.
- Verification gate for the whole plan: `npm run typecheck && npm run test && npm run build`, then `E2E_PORT=3002 npx playwright test`.

---

### Task 1: `ContactsService.recordConversation`

**Files:**
- Modify: `lib/validations/contact.ts` (append after `updateContactSchema`, around line 52)
- Modify: `lib/services/contacts.service.ts` (add method after `update`, which ends around line 198)
- Test: `tests/spoke.test.ts` (create)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/prisma`.
- Produces:
  - `recordConversationSchema` and `RecordConversationInput` from `@/lib/validations/contact`, shape `{ nextActionAt?: string | null; nextActionNote?: string | null }`.
  - `ContactsService.recordConversation(userId: string, id: string, data: RecordConversationInput): Promise<Contact>`.

- [ ] **Step 1: Write the failing test**

Create `tests/spoke.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * דיברתי is the only writer of lastContactedAt once the WhatsApp webhooks are
 * gone. today.service reads that field for the quiet-leads count, so a lead
 * reached by phone has to be able to say so.
 */

const prismaMock = {
  contact: { findFirst: vi.fn(), update: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { ContactsService } = await import('@/lib/services/contacts.service')

describe('recordConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'contact-1' })
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
  })

  it('stamps lastContactedAt with the server clock, not a caller value', async () => {
    const before = Date.now()
    await ContactsService.recordConversation('user-1', 'contact-1', {})
    const after = Date.now()

    const stamped = prismaMock.contact.update.mock.calls[0][0].data.lastContactedAt as Date
    expect(stamped.getTime()).toBeGreaterThanOrEqual(before)
    expect(stamped.getTime()).toBeLessThanOrEqual(after)
  })

  it('scopes the lookup by userId', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {})

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: 'contact-1', userId: 'user-1' },
    })
  })

  it('sets the next action alongside the stamp', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {
      nextActionAt: '2026-10-01T00:00:00.000Z',
      nextActionNote: 'לשלוח הצעת מחיר',
    })

    expect(prismaMock.contact.update.mock.calls[0][0].data).toMatchObject({
      nextActionAt: new Date('2026-10-01T00:00:00.000Z'),
      nextActionNote: 'לשלוח הצעת מחיר',
    })
  })

  it('clears the next action when given null', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {
      nextActionAt: null,
      nextActionNote: null,
    })

    expect(prismaMock.contact.update.mock.calls[0][0].data).toMatchObject({
      nextActionAt: null,
      nextActionNote: null,
    })
  })

  it('leaves the next action untouched when the field is absent', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {})

    const data = prismaMock.contact.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('nextActionAt')
    expect(data).not.toHaveProperty('nextActionNote')
  })

  it('throws a Hebrew error for a contact the user does not own', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null)

    await expect(
      ContactsService.recordConversation('user-1', 'someone-elses', {})
    ).rejects.toThrow('איש קשר לא נמצא')
    expect(prismaMock.contact.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/spoke.test.ts`
Expected: FAIL. `ContactsService.recordConversation is not a function`.

- [ ] **Step 3: Add the validation schema**

Append to `lib/validations/contact.ts`:

```ts
/**
 * דיברתי. Deliberately has no lastContactedAt field: the stamp is the server's
 * clock, so the control cannot be used to backdate a conversation.
 */
export const recordConversationSchema = z.object({
  nextActionAt: z.string().datetime().nullable().optional(),
  nextActionNote: z.string().nullable().optional(),
})

export type RecordConversationInput = z.infer<typeof recordConversationSchema>
```

- [ ] **Step 4: Add the service method**

Add to `lib/services/contacts.service.ts`, after `update`. Add `RecordConversationInput` to the existing import from `@/lib/validations/contact`:

```ts
  /**
   * דיברתי: the single lead action, stamping "I spoke to them" and capturing
   * what is owed next in one call.
   *
   * This is the **only** writer of lastContactedAt. Both WhatsApp webhooks used
   * to write it and neither survives the 2026-09 teardown, while
   * today.service.ts still reads it for the quiet-leads count. Without this
   * method that count silently stops meaning "not spoken to recently" and
   * starts meaning "record is older than three days".
   *
   * The two next-action fields are only written when supplied, so pressing
   * דיברתי without touching them records the conversation and leaves an
   * existing plan alone.
   */
  static async recordConversation(
    userId: string,
    id: string,
    data: RecordConversationInput
  ) {
    const existing = await prisma.contact.findFirst({ where: { id, userId } })

    if (!existing) {
      throw new Error('איש קשר לא נמצא')
    }

    return prisma.contact.update({
      where: { id },
      data: {
        lastContactedAt: new Date(),
        ...(data.nextActionAt !== undefined && {
          nextActionAt: data.nextActionAt ? new Date(data.nextActionAt) : null,
        }),
        ...(data.nextActionNote !== undefined && {
          nextActionNote: data.nextActionNote || null,
        }),
      },
    })
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/spoke.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add tests/spoke.test.ts lib/services/contacts.service.ts lib/validations/contact.ts
git commit -m "feat(contacts): give lastContactedAt a writer that is not a webhook"
```

---

### Task 2: The POST route

**Files:**
- Create: `app/api/contacts/[id]/spoke/route.ts`
- Test: `tests/spoke-route.test.ts` (create)

**Interfaces:**
- Consumes: `ContactsService.recordConversation`, `recordConversationSchema`, `withAuth` and `createResponse` from `@/lib/api/api-handler`.
- Produces: `POST /api/contacts/{id}/spoke`, body `{ nextActionAt?, nextActionNote? }`, returning the updated contact.

A dedicated route rather than a flag on `PUT /contacts/[id]`, because it is a distinct intent and because it keeps `lastContactedAt` off the general update schema, where a caller could set it to any value.

- [ ] **Step 1: Write the failing test**

Create `tests/spoke-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordConversation = vi.fn()

vi.mock('@/lib/services/contacts.service', () => ({
  ContactsService: { recordConversation },
}))

vi.mock('@/lib/api/api-handler', () => ({
  withAuth: (handler: unknown) => handler,
  createResponse: (data: unknown) => ({ data }),
}))

const { POST } = await import('@/app/api/contacts/[id]/spoke/route')

describe('POST /api/contacts/[id]/spoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordConversation.mockResolvedValue({ id: 'contact-1' })
  })

  it('forwards the authenticated user, the id and the parsed body', async () => {
    const req = { json: async () => ({ nextActionNote: 'לחזור אליו' }) } as Request

    await (POST as unknown as (r: Request, c: unknown) => Promise<unknown>)(req, {
      params: Promise.resolve({ id: 'contact-1' }),
      userId: 'user-1',
    })

    expect(recordConversation).toHaveBeenCalledWith('user-1', 'contact-1', {
      nextActionNote: 'לחזור אליו',
    })
  })

  it('rejects a body that tries to set lastContactedAt', async () => {
    const req = {
      json: async () => ({ lastContactedAt: '2020-01-01T00:00:00.000Z' }),
    } as Request

    await (POST as unknown as (r: Request, c: unknown) => Promise<unknown>)(req, {
      params: Promise.resolve({ id: 'contact-1' }),
      userId: 'user-1',
    })

    expect(recordConversation).toHaveBeenCalledWith('user-1', 'contact-1', {})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/spoke-route.test.ts`
Expected: FAIL. Cannot find module `@/app/api/contacts/[id]/spoke/route`.

- [ ] **Step 3: Create the route**

Create `app/api/contacts/[id]/spoke/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ContactsService } from '@/lib/services/contacts.service'
import { recordConversationSchema } from '@/lib/validations/contact'

/**
 * דיברתי. Its own route rather than a flag on PUT /contacts/[id], so that
 * lastContactedAt never appears on the general update schema where a caller
 * could set it to an arbitrary value.
 */
export const POST = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const body = await req.json()
  const data = recordConversationSchema.parse(body)
  const contact = await ContactsService.recordConversation(userId, id, data)

  return createResponse(contact)
})
```

> A Next.js route segment **may not export anything but its handlers**. Do not add a shared constant to this file; `tsc --noEmit` will not catch it, only `next build` will.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/spoke-route.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the route builds**

Run: `npm run build`
Expected: build succeeds and the route appears in the output as `/api/contacts/[id]/spoke`.

- [ ] **Step 6: Commit**

```bash
git add tests/spoke-route.test.ts "app/api/contacts/[id]/spoke/route.ts"
git commit -m "feat(api): a route for recording that a lead was spoken to"
```

---

### Task 3: The `SpokeButton` component

**Files:**
- Create: `components/patterns/spoke-button.tsx`
- Test: none. This repo tests behaviour in services (Task 1) and route wiring (Task 2), not markup. The component is exercised manually in Task 4 Step 3 and by the existing Playwright suite in Task 5 Step 3.

All of `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` and `DialogFooter` are exported from `components/ui/dialog.tsx`.

**Interfaces:**
- Consumes: `POST /api/contacts/{id}/spoke` via `api` from `@/lib/api/client`.
- Produces: `<SpokeButton contactId nextActionAt nextActionNote onDone variant? />` where `onDone: () => void` refetches the parent, and `variant` is `'default' | 'row'` so the leads table can render a compact form.

- [ ] **Step 1: Create the component**

Create `components/patterns/spoke-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { PhoneCall } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

/**
 * דיברתי: one control that records the conversation and captures what is owed
 * next, because those two things are always decided in the same moment.
 *
 * Opening the dialog does not commit anything; pressing שמירה stamps
 * lastContactedAt server-side. Leaving the date empty is allowed and means
 * "spoke to them, nothing scheduled" - the stamp still lands.
 */
export function SpokeButton({
  contactId,
  nextActionAt,
  nextActionNote,
  onDone,
  variant = 'default',
}: {
  contactId: string
  nextActionAt: string | null
  nextActionNote: string | null
  onDone: () => void
  variant?: 'default' | 'row'
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const start = () => {
    setDate(nextActionAt ? new Date(nextActionAt).toISOString().split('T')[0] : '')
    setNote(nextActionNote ?? '')
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/contacts/${contactId}/spoke`, {
        nextActionAt: date ? new Date(date).toISOString() : null,
        nextActionNote: note.trim() || null,
      })
      toast.success(date ? 'נרשם, ונקבעה פעולה הבאה' : 'נרשם')
      setOpen(false)
      onDone()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant={variant === 'row' ? 'ghost' : 'outline'}
        size={variant === 'row' ? 'sm' : 'default'}
        onClick={start}
        className="gap-2"
      >
        <PhoneCall className="size-4" />
        דיברתי
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>דיברתי איתו</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-content-muted">
              נרשום שדיברתם עכשיו. מה צריך לעשות אחר כך?
            </p>
            <Input
              placeholder="מה צריך לעשות? לדוגמה: לשלוח הצעת מחיר"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="תיאור פעולה הבאה"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="תאריך פעולה הבאה"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={save} disabled={saving}>
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify it typechecks and respects the RTL budget**

Run: `npm run typecheck && npx vitest run tests/design-rtl.test.ts`
Expected: both PASS. If the RTL test fails, replace any physical direction utility with its logical equivalent (`ml-` becomes `ms-`, `pr-` becomes `pe-`).

- [ ] **Step 3: Commit**

```bash
git add components/patterns/spoke-button.tsx
git commit -m "feat(contacts): the דיברתי control"
```

---

### Task 4: Wire it into both surfaces

**Files:**
- Modify: `app/(dashboard)/contacts/[id]/page.tsx` (alongside the existing `NextActionEditor`)
- Modify: `app/(dashboard)/leads/page.tsx` (one button per lead row)

**Interfaces:**
- Consumes: `SpokeButton` from `@/components/patterns/spoke-button`.
- Produces: nothing new.

Acting from the row is the point. The spec's second diagnosis is "too much clicking to do one real thing", and logging a call is the most frequent lead action.

- [ ] **Step 1: Add it to the contact detail page**

In `app/(dashboard)/contacts/[id]/page.tsx`, import the component and render it next to the existing `NextActionEditor` (rendered at line 187). The page's refetch callback is `fetchContact`, declared at line 43 and already passed to `NextActionEditor` as `onChanged` at line 191.

```tsx
import { SpokeButton } from '@/components/patterns/spoke-button'

// ...alongside <NextActionEditor ... /> around line 187:
<SpokeButton
  contactId={contact.id}
  nextActionAt={contact.nextActionAt}
  nextActionNote={contact.nextActionNote}
  onDone={fetchContact}
/>
```

- [ ] **Step 2: Add it to each leads table row**

In `app/(dashboard)/leads/page.tsx`, render it in the row's action cell with `variant="row"`. The page's refetch callback is **`fetchContacts`**, declared at line 97 (the page lists contacts filtered to the lead phase, which is why it is not called `fetchLeads`).

```tsx
<SpokeButton
  contactId={lead.id}
  nextActionAt={lead.nextActionAt}
  nextActionNote={lead.nextActionNote}
  onDone={fetchContacts}
  variant="row"
/>
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `/leads`, press דיברתי on a lead, save with a note and a date. Expected: a success toast, the row's next action updates without a page reload.

- [ ] **Step 4: Run the full unit suite**

Run: `npm run typecheck && npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/contacts/[id]/page.tsx" "app/(dashboard)/leads/page.tsx"
git commit -m "feat(leads): press דיברתי from the row, not from a detail page"
```

---

### Task 5: Lock the quiet-leads semantics with a test

**Files:**
- Test: `tests/today-quiet-leads.test.ts` (create)

**Interfaces:**
- Consumes: `TodayService` from `@/lib/services/today.service`.
- Produces: nothing.

This is the regression guard for the coupling the whole plan exists to protect. It asserts the query shape, so that when the teardown plan deletes the webhooks, a later change that drops `lastContactedAt` from this clause fails loudly instead of silently changing what the number means.

- [ ] **Step 1: Write the test**

Create `tests/today-quiet-leads.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The quiet-leads count must keep asking about lastContactedAt.
 *
 * The field's only writers were the two WhatsApp webhooks, deleted in the
 * 2026-09 teardown, and דיברתי now replaces them. If this clause ever loses
 * the lastContactedAt arm, the count silently stops meaning "not spoken to
 * recently" and starts meaning "record older than three days" - a metric that
 * lies rather than one that breaks. See ADR 0004.
 */

const prismaMock = {
  contact: { count: vi.fn(), findMany: vi.fn() },
  request: { count: vi.fn(), findMany: vi.fn() },
  projectPhase: { count: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/money/ledger', () => ({
  openLedger: vi.fn().mockResolvedValue([]),
  isCollectable: () => false,
}))

const { TodayService } = await import('@/lib/services/today.service')

describe('quiet leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.count.mockResolvedValue(0)
    prismaMock.contact.findMany.mockResolvedValue([])
    prismaMock.request.count.mockResolvedValue(0)
    prismaMock.request.findMany.mockResolvedValue([])
    prismaMock.projectPhase.count.mockResolvedValue(0)
  })

  it('still asks about lastContactedAt, not only about createdAt', async () => {
    await TodayService.getBoard('user-1')

    const quiet = prismaMock.contact.count.mock.calls
      .map((call) => call[0].where)
      .find((where) => where?.nextActionAt === null)

    expect(quiet).toBeDefined()
    expect(JSON.stringify(quiet.OR)).toContain('lastContactedAt')
  })

  it('only counts leads with no next action planned', async () => {
    await TodayService.getBoard('user-1')

    const quiet = prismaMock.contact.count.mock.calls
      .map((call) => call[0].where)
      .find((where) => where?.OR)

    expect(quiet.nextActionAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/today-quiet-leads.test.ts`
Expected: PASS, 2 tests. It tests existing behaviour, so it should pass immediately. If it fails, the mock shape does not match `today.service.ts`'s actual calls; read that file's `Promise.all` block and align the mock, do not weaken the assertion.

- [ ] **Step 3: Full verification gate**

Run: `npm run typecheck && npm run test && npm run build`
Then: `E2E_PORT=3002 npx playwright test`
Expected: all PASS. `E2E_PORT=3002` is required; `NEXTAUTH_URL` pins the port and logout fails without it.

- [ ] **Step 4: Commit**

```bash
git add tests/today-quiet-leads.test.ts
git commit -m "test(today): the quiet-leads count must keep asking about lastContactedAt"
```

---

## Done when

- `lastContactedAt` has a writer that is not a webhook, reachable from the leads table row and the contact detail page.
- `tests/today-quiet-leads.test.ts` guards the coupling for the teardown plan.
- Full gate green: `npm run typecheck && npm run test && npm run build`, then `E2E_PORT=3002 npx playwright test`.

Only then may Plan 2 delete `app/api/whatsapp/*`.
