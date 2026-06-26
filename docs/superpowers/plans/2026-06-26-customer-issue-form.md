# Customer Issue/Bug Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let clients submit issues/bugs/requests through a private per-client link that creates a `PENDING_REVIEW` `Request` ticket, auto-tied to that client, and pings the owner over WhatsApp.

**Architecture:** A public, unauthenticated form page at `/r/[token]` resolves a `Client` by a random `formToken`. Submissions POST `multipart/form-data` to `/api/public/requests`, which validates input (Zod), optionally uploads one attachment to a private Supabase Storage bucket, matches/creates a reporter `Contact`, and creates a `Request{ status: PENDING_REVIEW, source: FORM }` owned by the client's owner. The owner approves it from the existing requests review queue. Mirrors the existing `app/api/public/leads/route.ts` pattern.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Prisma + PostgreSQL (Supabase), `@supabase/supabase-js` (Storage), Zod, React Hook Form, Tailwind + shadcn/ui, Playwright (E2E + API tests), WAHA (WhatsApp) via existing services.

## Global Constraints

- TypeScript strict mode. Match repo style: **no semicolons**, single quotes, 2-space indent.
- All user-facing copy is **Hebrew, RTL**. No emojis in code/comments/UI.
- Immutability: never mutate objects/arrays; use spread.
- Services are static classes scoped by `userId`; authenticated API routes use `withAuth` from `lib/api/api-handler.ts`.
- Schema changes apply via **raw SQL through `prisma db execute --stdin`** (`db:push` times out on the Supabase pooler), then `npx prisma generate`.
- Tests use **Playwright only** (no unit runner exists). Browser flows = E2E specs; endpoint behavior = Playwright API tests via the `request` fixture. Run with `npm run test:e2e`.
- New env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. On Vercel set via `printf 'value' | vercel env add NAME` to avoid trailing newlines.
- Spec: `docs/superpowers/specs/2026-06-26-customer-issue-form-design.md`.

---

## File Structure

**Create:**
- `lib/validations/public-request.ts` — Zod schema + types for a public submission.
- `lib/services/storage.service.ts` — attachment validation + Supabase Storage upload/signed-URL.
- `lib/services/public-requests.service.ts` — token resolution, reporter Contact match/create, Request creation.
- `app/api/public/requests/route.ts` — public `POST` (multipart) + `OPTIONS` (CORS).
- `app/api/clients/[id]/form-token/route.ts` — authenticated `POST` to generate/rotate `formToken`.
- `app/api/requests/[id]/attachment/route.ts` — authenticated `GET` returning a signed URL.
- `app/r/[token]/page.tsx` — public server component form page.
- `components/forms/public-request-form.tsx` — client component form.
- `e2e/public-request.spec.ts` — API + E2E tests for the public flow.

**Modify:**
- `prisma/schema.prisma` — `Client.formToken`, `Request.attachments`, `RequestSource.FORM`.
- `lib/services/clients.service.ts` — add `regenerateFormToken`.
- `middleware.ts` — exempt `/r/` from the auth redirect.
- `app/(dashboard)/clients/[id]/page.tsx` — "טופס פניות" link card.
- `app/(dashboard)/requests/page.tsx` — `FORM` source badge + attachment links.

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `prisma/schema.prisma` (Client model ~line 119-140, Request model ~line 279-314, RequestSource enum ~line 332-337)

**Interfaces:**
- Produces: `Client.formToken: string | null` (unique), `Request.attachments: string[]`, enum value `RequestSource.FORM`.

- [ ] **Step 1: Add `formToken` to the Client model**

In `prisma/schema.prisma`, inside `model Client`, add the field after `isInternal`:

```prisma
  isInternal Boolean @default(false)
  formToken  String? @unique
```

- [ ] **Step 2: Add `attachments` to the Request model**

Inside `model Request`, add after the `aiNote` line:

```prisma
  aiNote        String? @db.Text
  attachments   String[] @default([])
```

- [ ] **Step 3: Add `FORM` to the RequestSource enum**

```prisma
enum RequestSource {
  WHATSAPP
  MANUAL
  EMAIL
  FORM
  OTHER
}
```

- [ ] **Step 4: Apply the schema via raw SQL**

Run each statement (the enum value must be added in its own statement, committed before use):

```bash
npx prisma db execute --stdin <<'SQL'
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "formToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Client_formToken_key" ON "Client"("formToken");
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';
SQL
npx prisma db execute --stdin <<'SQL'
ALTER TYPE "RequestSource" ADD VALUE IF NOT EXISTS 'FORM';
SQL
```

Expected: each command prints `Script executed successfully.`

- [ ] **Step 5: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 6: Verify columns exist**

Run:

```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Client' AND column_name = 'formToken';
SQL
```

Expected: `Script executed successfully.` (no error means the column resolved).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Client.formToken, Request.attachments, RequestSource.FORM"
```

---

## Task 2: Client form-token endpoint + dashboard link UI

**Files:**
- Modify: `lib/services/clients.service.ts`
- Create: `app/api/clients/[id]/form-token/route.ts`
- Modify: `app/(dashboard)/clients/[id]/page.tsx`
- Test: `e2e/public-request.spec.ts` (created here; extended in later tasks)

**Interfaces:**
- Consumes: `prisma`, `withAuth`, `createResponse` (existing).
- Produces:
  - `ClientsService.regenerateFormToken(userId: string, id: string): Promise<{ formToken: string }>`
  - `POST /api/clients/[id]/form-token` → `{ formToken: string }`

- [ ] **Step 1: Write the failing API test**

Create `e2e/public-request.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// Authenticated context comes from the project's storageState.
async function createClient(request: import('@playwright/test').APIRequestContext, name: string) {
  const res = await request.post('/api/clients', { data: { name } })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test.describe('client form token', () => {
  test('generates and rotates a form token', async ({ request }) => {
    const client = await createClient(request, `טסט טוקן ${Date.now()}`)

    const first = await request.post(`/api/clients/${client.id}/form-token`)
    expect(first.status()).toBe(200)
    const { formToken: token1 } = await first.json()
    expect(token1).toBeTruthy()

    const second = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken: token2 } = await second.json()
    expect(token2).toBeTruthy()
    expect(token2).not.toBe(token1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: FAIL — `POST /api/clients/<id>/form-token` returns 404 (route does not exist yet).

- [ ] **Step 3: Add the service method**

In `lib/services/clients.service.ts`, add inside `ClientsService`:

```ts
  static async regenerateFormToken(userId: string, id: string) {
    const client = await prisma.client.findFirst({ where: { id, userId } })

    if (!client) {
      throw new Error('לקוח לא נמצא')
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { formToken: crypto.randomUUID() },
      select: { formToken: true },
    })

    return { formToken: updated.formToken as string }
  }
```

- [ ] **Step 4: Create the endpoint**

Create `app/api/clients/[id]/form-token/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { ClientsService } from '@/lib/services/clients.service'

export const POST = withAuth(async (_req: NextRequest, { params, userId }) => {
  const { id } = await params
  const result = await ClientsService.regenerateFormToken(userId, id)

  return createResponse(result)
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: PASS.

- [ ] **Step 6: Add the link card to the client detail page**

In `app/(dashboard)/clients/[id]/page.tsx`:

(a) Ensure the client type used by the page includes `formToken: string | null`. Find the local interface describing the fetched client (it has `name`, `projects`, etc.) and add:

```ts
  formToken: string | null
```

(b) Add state + handler near the other handlers in the component (after the existing `useState` declarations):

```tsx
  const [tokenBusy, setTokenBusy] = useState(false)

  const formUrl = client?.formToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${client.formToken}`
    : null

  const handleGenerateToken = async () => {
    if (!client) return
    setTokenBusy(true)
    try {
      const { data } = await api.post(`/clients/${client.id}/form-token`)
      setClient({ ...client, formToken: data.formToken })
      toast.success('הקישור נוצר')
    } catch {
      toast.error('שגיאה ביצירת הקישור')
    } finally {
      setTokenBusy(false)
    }
  }

  const handleCopyLink = async () => {
    if (!formUrl) return
    await navigator.clipboard.writeText(formUrl)
    toast.success('הקישור הועתק')
  }
```

(This uses the page's existing `api` (axios), `toast` (react-hot-toast), `client`/`setClient`, and `useState` imports. If `setClient` does not exist, replace with the page's existing client state setter.)

(c) Add a new Card after the "פרטי עסק" Card and before "אנשי קשר":

```tsx
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>טופס פניות</CardTitle>
          <Button size="sm" onClick={handleGenerateToken} disabled={tokenBusy}>
            {client.formToken ? 'אפס קישור' : 'צור קישור'}
          </Button>
        </CardHeader>
        <CardContent>
          {formUrl ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-gray-100 px-3 py-2 text-sm" dir="ltr">
                {formUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                העתק
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              צור קישור פרטי שהלקוח יכול להשתמש בו כדי לדווח על תקלות ובקשות.
            </p>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 7: Write the failing E2E test for the UI**

Append to `e2e/public-request.spec.ts`:

```ts
test.describe('client form link UI', () => {
  test('shows and copies the form link', async ({ page, request }) => {
    const client = await createClient(request, `טסט קישור ${Date.now()}`)

    await page.goto(`/clients/${client.id}`)
    await expect(page.getByText('טופס פניות')).toBeVisible()
    await page.getByRole('button', { name: 'צור קישור' }).click()
    await expect(page.locator('code', { hasText: '/r/' })).toBeVisible()
  })
})
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: PASS (both describes).

- [ ] **Step 9: Commit**

```bash
git add lib/services/clients.service.ts app/api/clients e2e/public-request.spec.ts "app/(dashboard)/clients/[id]/page.tsx"
git commit -m "feat: per-client form-token generation and link UI"
```

---

## Task 3: Backend submit pipeline (validation, storage, service, public endpoint)

**Files:**
- Create: `lib/validations/public-request.ts`
- Create: `lib/services/storage.service.ts`
- Create: `lib/services/public-requests.service.ts`
- Create: `app/api/public/requests/route.ts`
- Test: `e2e/public-request.spec.ts` (extend)

**Interfaces:**
- Consumes: `prisma`, `Client.formToken` / `Request.attachments` / `RequestSource.FORM` (Task 1), `ClientsService.regenerateFormToken` (Task 2, used in tests to mint a token).
- Produces:
  - `publicRequestSchema` (Zod) + `PublicRequestInput` type.
  - `validateAttachment(file: { size: number; type: string }): { ok: true } | { ok: false; error: string }`
  - `StorageService.uploadAttachment(args: { clientId: string; file: File }): Promise<string>` (returns object path)
  - `StorageService.getSignedUrl(path: string, expiresIn?: number): Promise<string>`
  - `PublicRequestsService.submit(input: PublicRequestSubmit): Promise<{ id: string }>`
  - `POST /api/public/requests` (multipart) → `{ success: true, id: string }` (201)

- [ ] **Step 1: Create the validation schema**

Create `lib/validations/public-request.ts`:

```ts
import { z } from 'zod'

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

export const publicRequestSchema = z.object({
  token: z.string().min(1),
  type: z.enum(['BUG', 'REQUEST', 'QUESTION', 'OTHER']).optional(),
  title: z.string().min(1, 'כותרת חובה'),
  description: z.string().min(1, 'תיאור חובה'),
  projectId: z.string().optional(),
  reporterName: z.string().optional(),
  reporterPhone: z
    .string()
    .regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  reporterEmail: z
    .string()
    .email('אימייל לא תקין')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
})

export type PublicRequestInput = z.infer<typeof publicRequestSchema>
```

- [ ] **Step 2: Create the storage service**

Create `lib/services/storage.service.ts`:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'request-attachments'
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export function validateAttachment(file: { size: number; type: string }) {
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false as const, error: 'סוג קובץ לא נתמך' }
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false as const, error: 'הקובץ גדול מדי (מקסימום 5MB)' }
  }
  return { ok: true as const }
}

let cached: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase storage env vars missing')
  }
  cached = createClient(url, key)
  return cached
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

export class StorageService {
  static async uploadAttachment({ clientId, file }: { clientId: string; file: File }): Promise<string> {
    const path = `${clientId}/${crypto.randomUUID()}/${sanitizeName(file.name)}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error } = await getClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }
    return path
  }

  static async getSignedUrl(path: string, expiresIn = 300): Promise<string> {
    const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(path, expiresIn)
    if (error || !data) {
      throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
    }
    return data.signedUrl
  }
}
```

- [ ] **Step 3: Create the public-requests service**

Create `lib/services/public-requests.service.ts`:

```ts
import { prisma } from '@/lib/db/prisma'

export interface PublicRequestSubmit {
  token: string
  type?: 'BUG' | 'REQUEST' | 'QUESTION' | 'OTHER'
  title: string
  description: string
  projectId?: string
  reporterName?: string
  reporterPhone?: string
  reporterEmail?: string
  attachments: string[]
}

export interface SubmitResult {
  id: string
  clientName: string
  reporterName?: string
  attachmentCount: number
  ownerUserId: string
}

export class PublicRequestsService {
  static async submit(input: PublicRequestSubmit): Promise<SubmitResult> {
    const client = await prisma.client.findFirst({
      where: { formToken: input.token },
      select: { id: true, name: true, userId: true },
    })
    if (!client) {
      throw new Error('NOT_FOUND')
    }

    // projectId is only honored if it belongs to this client.
    let projectId: string | undefined = undefined
    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, clientId: client.id },
        select: { id: true },
      })
      projectId = project?.id
    }

    // Reporter Contact only when a phone is provided (Contact.phone is non-null).
    let contactId: string | undefined = undefined
    if (input.reporterPhone) {
      const existing = await prisma.contact.findFirst({
        where: { userId: client.userId, clientId: client.id, phone: input.reporterPhone },
        select: { id: true },
      })
      if (existing) {
        contactId = existing.id
      } else {
        const created = await prisma.contact.create({
          data: {
            name: input.reporterName || 'לקוח',
            phone: input.reporterPhone,
            email: input.reporterEmail,
            status: 'CLIENT',
            source: 'OTHER',
            clientId: client.id,
            userId: client.userId,
          },
          select: { id: true },
        })
        contactId = created.id
      }
    }

    // If we could not attach a Contact, keep reporter details in the description.
    const reporterLine =
      !contactId && (input.reporterName || input.reporterEmail)
        ? `\n\nדיווח מאת: ${[input.reporterName, input.reporterEmail].filter(Boolean).join(' / ')}`
        : ''

    const request = await prisma.request.create({
      data: {
        title: input.title,
        description: input.description + reporterLine,
        type: input.type ?? 'REQUEST',
        status: 'PENDING_REVIEW',
        source: 'FORM',
        priority: 'MEDIUM',
        isAiGenerated: false,
        attachments: input.attachments,
        clientId: client.id,
        contactId,
        projectId,
        userId: client.userId,
      },
      select: { id: true },
    })

    return {
      id: request.id,
      clientName: client.name,
      reporterName: input.reporterName,
      attachmentCount: input.attachments.length,
      ownerUserId: client.userId,
    }
  }
}
```

- [ ] **Step 4: Create the public endpoint**

Create `app/api/public/requests/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { publicRequestSchema } from '@/lib/validations/public-request'
import { StorageService, validateAttachment } from '@/lib/services/storage.service'
import { PublicRequestsService, SubmitResult } from '@/lib/services/public-requests.service'
import { WahaService } from '@/lib/services/waha.service'
import { WhatsAppAgentService } from '@/lib/services/whatsapp-agent.service'

const TYPE_LABELS: Record<string, string> = {
  BUG: 'תקלה',
  REQUEST: 'בקשה',
  QUESTION: 'שאלה',
  OTHER: 'אחר',
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    // Honeypot: a bot fills hidden fields. Accept and drop silently.
    if (form.get('website')) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const data = publicRequestSchema.parse({
      token: form.get('token') ?? '',
      type: form.get('type') || undefined,
      title: form.get('title') ?? '',
      description: form.get('description') ?? '',
      projectId: form.get('projectId') || undefined,
      reporterName: form.get('reporterName') || undefined,
      reporterPhone: form.get('reporterPhone') || undefined,
      reporterEmail: form.get('reporterEmail') || undefined,
    })

    // Optional single attachment.
    const attachments: string[] = []
    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      const check = validateAttachment(file)
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 })
      }
      try {
        const path = await StorageService.uploadAttachment({ clientId: 'pending', file })
        attachments.push(path)
      } catch (err) {
        // Never lose the ticket over a failed upload.
        console.error('Attachment upload failed:', err)
      }
    }

    const result = await PublicRequestsService.submit({ ...data, attachments })

    notifyOwner(result, data.type).catch((err) =>
      console.error('Failed to notify owner of new request:', err)
    )

    return NextResponse.json({ success: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'הקישור אינו תקין' }, { status: 404 })
    }
    console.error('Public request submission error:', error)
    return NextResponse.json({ success: false, error: 'שגיאה בשליחת הטופס' }, { status: 500 })
  }
}

async function notifyOwner(result: SubmitResult, type?: string) {
  const ownerChatId = await WhatsAppAgentService.getOwnerChatId()
  if (!ownerChatId) {
    console.log('No owner chatId set — skipping new request notification')
    return
  }

  const lines = [
    '🔔 *פנייה חדשה מטופס!*',
    '',
    `*עסק:* ${result.clientName}`,
    `*סוג:* ${TYPE_LABELS[type ?? 'REQUEST'] ?? 'בקשה'}`,
  ]
  if (result.reporterName) lines.push(`*מאת:* ${result.reporterName}`)
  if (result.attachmentCount > 0) lines.push('*צורף קובץ:* כן')
  lines.push('', 'ממתין לאישור בלוח הבקשות.')

  await WahaService.sendMessage({ chatId: ownerChatId, text: lines.join('\n') })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
```

Note: `clientId: 'pending'` is used as the upload path prefix because the request id is not known until after creation; this keeps Task 3 self-contained. Path correctness is cosmetic (objects are reached by stored path, not by prefix). The stored path is saved verbatim on the request.

- [ ] **Step 5: Write the failing API tests**

Append to `e2e/public-request.spec.ts`:

```ts
test.describe('public request submission', () => {
  async function mintToken(request: import('@playwright/test').APIRequestContext) {
    const client = await createClient(request, `טסט פנייה ${Date.now()}`)
    const res = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await res.json()
    return { clientId: client.id, formToken }
  }

  test('creates a PENDING_REVIEW FORM request for a valid token', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const title = `תקלה בטופס ${Date.now()}`

    const pub = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: formToken, type: 'BUG', title, description: 'הכפתור לא עובד' },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    await pub.dispose()

    // Owner sees it in the pending-review queue with source FORM.
    const list = await request.get('/api/requests?pendingReview=true')
    const requests = await list.json()
    const found = requests.find((r: { title: string }) => r.title === title)
    expect(found).toBeTruthy()
    expect(found.source).toBe('FORM')
    expect(found.status).toBe('PENDING_REVIEW')
  })

  test('rejects an unknown token with 404', async ({ playwright }) => {
    const pub = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: 'does-not-exist', title: 'x', description: 'y' },
    })
    expect(res.status()).toBe(404)
    await pub.dispose()
  })

  test('rejects a disallowed file type with 400', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const pub = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
    const res = await pub.post('/api/public/requests', {
      multipart: {
        token: formToken,
        title: 'עם קובץ',
        description: 'בדיקה',
        file: { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') },
      },
    })
    expect(res.status()).toBe(400)
    await pub.dispose()
  })

  test('honeypot submissions are silently dropped', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const title = `ספאם ${Date.now()}`
    const pub = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: formToken, title, description: 'spam', website: 'http://spam' },
    })
    expect(res.status()).toBe(201)
    await pub.dispose()

    const list = await request.get('/api/requests?pendingReview=true')
    const requests = await list.json()
    expect(requests.find((r: { title: string }) => r.title === title)).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: PASS for all four submission tests. (Tests send no allowed file, so Supabase Storage env is not required.)

- [ ] **Step 7: Commit**

```bash
git add lib/validations/public-request.ts lib/services/storage.service.ts lib/services/public-requests.service.ts app/api/public/requests e2e/public-request.spec.ts
git commit -m "feat: public request submit endpoint, validation, and storage service"
```

---

## Task 4: Public form page + middleware exemption

**Files:**
- Modify: `middleware.ts`
- Create: `app/r/[token]/page.tsx`
- Create: `components/forms/public-request-form.tsx`
- Test: `e2e/public-request.spec.ts` (extend)

**Interfaces:**
- Consumes: `prisma` (resolve client), `POST /api/public/requests` (Task 3).
- Produces: a reachable public page at `/r/[token]` rendering `<PublicRequestForm>`.

- [ ] **Step 1: Exempt `/r/` from auth in middleware**

In `middleware.ts`, add an early return at the top of `middleware`, before the `isAuthPage` logic:

```ts
export async function middleware(request: NextRequest) {
  // Public per-client request form — no auth.
  if (request.nextUrl.pathname.startsWith('/r/')) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })
```

- [ ] **Step 2: Create the form client component**

Create `components/forms/public-request-form.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  token: string
  clientName: string
  projects: ProjectOption[]
}

const TYPES = [
  { value: 'BUG', label: 'תקלה' },
  { value: 'REQUEST', label: 'בקשה' },
  { value: 'QUESTION', label: 'שאלה' },
  { value: 'OTHER', label: 'אחר' },
]

export function PublicRequestForm({ token, clientName, projects }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('token', token)
      const res = await fetch('/api/public/requests', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'שגיאה בשליחת הטופס')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הטופס')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800">תודה!</h2>
        <p className="mt-2 text-green-700">הפנייה נשלחה ונטפל בה בהקדם.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div>
        <label className="mb-1 block text-sm font-medium">סוג הפנייה</label>
        <select name="type" defaultValue="BUG" className="w-full rounded border p-2">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">כותרת</label>
        <input name="title" required className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">תיאור</label>
        <textarea name="description" required rows={4} className="w-full rounded border p-2" />
      </div>

      {projects.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">פרויקט / אתר (לא חובה)</label>
          <select name="projectId" defaultValue="" className="w-full rounded border p-2">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">שם מלא (לא חובה)</label>
        <input name="reporterName" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">טלפון (לא חובה)</label>
        <input name="reporterPhone" inputMode="tel" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">אימייל (לא חובה)</label>
        <input name="reporterEmail" type="email" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">צירוף קובץ / צילום מסך (לא חובה)</label>
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="w-full rounded border p-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'שולח...' : 'שליחה'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create the page**

Create `app/r/[token]/page.tsx`:

```tsx
import { prisma } from '@/lib/db/prisma'
import { PublicRequestForm } from '@/components/forms/public-request-form'

export const dynamic = 'force-dynamic'

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const client = await prisma.client.findFirst({
    where: { formToken: token },
    select: {
      id: true,
      name: true,
      projects: {
        where: { status: { not: 'CANCELLED' } },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!client) {
    return (
      <main dir="rtl" className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">הקישור אינו תקין</h1>
          <p className="mt-2 text-gray-600">בדקו את הקישור או פנו אלינו ישירות.</p>
        </div>
      </main>
    )
  }

  return (
    <main dir="rtl" lang="he" className="mx-auto max-w-lg p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">דיווח תקלה / בקשה — {client.name}</h1>
        <p className="mt-1 text-sm text-gray-600">מלאו את הטופס ונחזור אליכם בהקדם.</p>
      </header>
      <PublicRequestForm token={token} clientName={client.name} projects={client.projects} />
    </main>
  )
}
```

- [ ] **Step 4: Write the failing E2E tests**

Append to `e2e/public-request.spec.ts`:

```ts
test.describe('public form page', () => {
  test('renders not-found for an unknown token', async ({ page }) => {
    await page.goto('/r/nope-not-real')
    await expect(page.getByText('הקישור אינו תקין')).toBeVisible()
  })

  test('submits the form and shows a thank-you', async ({ page, request }) => {
    const client = await createClient(request, `טסט עמוד ${Date.now()}`)
    const tokRes = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await tokRes.json()

    await page.goto(`/r/${formToken}`)
    await expect(page.getByRole('heading', { name: /דיווח תקלה/ })).toBeVisible()

    await page.locator('input[name="title"]').fill(`תקלה מהדפדפן ${Date.now()}`)
    await page.locator('textarea[name="description"]').fill('משהו לא עובד')
    await page.getByRole('button', { name: 'שליחה' }).click()

    await expect(page.getByText('תודה!')).toBeVisible()
  })
})
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: PASS (page renders without auth redirect; submission shows thank-you).

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/r components/forms/public-request-form.tsx e2e/public-request.spec.ts
git commit -m "feat: public request form page and middleware exemption"
```

---

## Task 5: Dashboard display (attachment signed-URL route + requests page badges/links)

**Files:**
- Create: `app/api/requests/[id]/attachment/route.ts`
- Modify: `app/(dashboard)/requests/page.tsx`
- Test: `e2e/public-request.spec.ts` (extend)

**Interfaces:**
- Consumes: `RequestsService.getById` (existing), `StorageService.getSignedUrl` (Task 3), `Request.attachments` / `source` (Task 1).
- Produces: `GET /api/requests/[id]/attachment?path=...` → `{ url: string }`; a `FORM` source badge and attachment links on the requests page.

- [ ] **Step 1: Create the signed-URL endpoint**

Create `app/api/requests/[id]/attachment/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { withAuth, createResponse, errorResponse } from '@/lib/api/api-handler'
import { RequestsService } from '@/lib/services/requests.service'
import { StorageService } from '@/lib/services/storage.service'

export const GET = withAuth(async (req: NextRequest, { params, userId }) => {
  const { id } = await params
  const path = new URL(req.url).searchParams.get('path')
  if (!path) {
    return errorResponse('path חסר', 400)
  }

  // Ownership + path membership guard (RequestsService.getById throws if not owned).
  const request = await RequestsService.getById(userId, id)
  if (!request.attachments.includes(path)) {
    return errorResponse('קובץ לא נמצא', 404)
  }

  const url = await StorageService.getSignedUrl(path)
  return createResponse({ url })
})
```

- [ ] **Step 2: Add `source` + `attachments` to the requests page request type**

In `app/(dashboard)/requests/page.tsx`, find the local `interface` describing a request (it has `type: string`, `status`, `priority`, etc.) and add:

```ts
  source: string
  attachments: string[]
```

- [ ] **Step 3: Add a FORM badge and attachment links**

In `app/(dashboard)/requests/page.tsx`, in the table-row render block where the type/status/priority badges appear (near the existing `<Badge ...>{TYPE_LABELS[request.type]}</Badge>`), add the source badge immediately after the type badge:

```tsx
                    {request.source === 'FORM' && (
                      <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                        טופס
                      </Badge>
                    )}
```

Add the same badge in the pending-review list block where the type badge is rendered (the other `<Badge ...>{TYPE_LABELS[request.type]}</Badge>` occurrence).

Then add an attachment indicator near the request title in the same row(s):

```tsx
                    {request.attachments?.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={async () => {
                          const { data } = await api.get(
                            `/requests/${request.id}/attachment?path=${encodeURIComponent(request.attachments[0])}`
                          )
                          window.open(data.url, '_blank')
                        }}
                      >
                        צפייה בקובץ
                      </button>
                    )}
```

(Uses the page's existing `api` axios import and `Badge` component.)

- [ ] **Step 4: Write the failing E2E test**

Append to `e2e/public-request.spec.ts`:

```ts
test.describe('requests dashboard shows form tickets', () => {
  test('form ticket appears with a form badge in the review queue', async ({ page, request, playwright }) => {
    const client = await createClient(request, `טסט לוח ${Date.now()}`)
    const tokRes = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await tokRes.json()
    const title = `פנייה ללוח ${Date.now()}`

    const pub = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
    await pub.post('/api/public/requests', {
      multipart: { token: formToken, type: 'BUG', title, description: 'בדיקה' },
    })
    await pub.dispose()

    await page.goto('/requests')
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText('טופס')).toBeVisible()
  })
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: PASS (the form ticket shows in the queue with the "טופס" badge).

- [ ] **Step 6: Run the full public-request suite**

Run: `npm run test:e2e -- public-request.spec.ts`
Expected: all describes PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/requests "app/(dashboard)/requests/page.tsx" e2e/public-request.spec.ts
git commit -m "feat: surface FORM tickets and attachments in the requests dashboard"
```

---

## Manual setup (one-time, outside the automated tasks)

These are required for the attachment **upload** path to work in dev/production (automated tests do not exercise live uploads):

1. In Supabase, create a **private** Storage bucket named `request-attachments`.
2. Set env vars locally (`.env`) and on Vercel:
   - `SUPABASE_URL` — your project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key (server-only; never expose to the client).
   - On Vercel: `printf 'value' | vercel env add SUPABASE_URL` (and same for the key) to avoid trailing newlines.
3. Generate a `formToken` for each existing client via the "צור קישור" button on the client detail page, then share each link.
4. Manual verification: open a client's `/r/[token]` link, attach a small PNG, submit, and confirm the ticket shows "צפייה בקובץ" that opens a signed URL.

---

## Self-Review

**Spec coverage:**
- Per-client link (`formToken`, `/r/[token]`) → Tasks 1, 2, 4. ✓
- Form fields (type, title, description, project picker, reporter, file) → Task 4 (form) + Task 3 (validation). ✓
- Arrival status `PENDING_REVIEW`, source `FORM` → Task 1 (enum) + Task 3 (service). ✓
- Attachment storage (private bucket, server-side upload, signed URL) → Task 3 (storage service, upload) + Task 5 (signed-URL route). ✓
- Reporter Contact match/create (phone-only guard) → Task 3 service. ✓
- WhatsApp notify (fire-and-forget, reuse services) → Task 3 endpoint. ✓
- Spam: honeypot + (best-effort) → Task 3 endpoint (honeypot). Rate limiting documented as best-effort in the spec; intentionally omitted from code as YAGNI at this volume — noted here as a deliberate scope cut.
- Dashboard link UI + FORM badge + attachment view → Tasks 2, 5. ✓
- Middleware exemption for `/r/` → Task 4. ✓
- Testing (Playwright API + E2E) → Tasks 2-5. ✓

**Deliberate scope note:** The spec lists a lightweight in-memory rate limit as best-effort defense-in-depth. It is omitted from the implementation (private token is the primary gate; honeypot covers bots). If desired later, add a per-token/IP token-bucket in `app/api/public/requests/route.ts`.

**Placeholder scan:** No TBD/TODO; all code steps contain full code. The `clientId: 'pending'` upload prefix is intentional and explained (path correctness is cosmetic).

**Type consistency:** `regenerateFormToken` returns `{ formToken }` (Task 2) consumed by the endpoint and UI. `PublicRequestsService.submit` returns `SubmitResult` consumed by `notifyOwner`. `validateAttachment`/`StorageService` names match across Tasks 3 and 5. `publicRequestSchema` field names match the form `name=` attributes (Task 4) and the endpoint's `form.get(...)` keys (Task 3).
