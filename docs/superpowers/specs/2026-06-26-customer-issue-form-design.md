# Customer Issue/Bug Form — Design

Date: 2026-06-26
Status: Approved (pending implementation plan)

## Goal

Let a client submit an issue, bug, feature request, or question through a private
per-client link. Each submission becomes a `Request` ticket in `PENDING_REVIEW`,
auto-tied to that client, and notifies the owner over WhatsApp. The owner approves
it from the existing requests review queue.

## Context

- The CRM already has a `Request` (ticket) model belonging to a `Client` (business),
  optionally linked to a `Contact` (person) and a `Project`.
- A proven public-endpoint pattern exists at `app/api/public/leads/route.ts`:
  no auth, Zod validation with Hebrew error messages, owner-scoped writes,
  fire-and-forget WhatsApp notification, and a CORS `OPTIONS` handler.
- The approval flow (`PENDING_REVIEW` -> `OPEN` -> `IN_PROGRESS` -> `RESOLVED`/`DISMISSED`)
  and the requests review queue already exist and are reused unchanged.

## Decisions

| Topic | Decision |
|-------|----------|
| Client identity | Per-client private link (auto-ties submission to one client). |
| Form fields | Type, title, description, project picker, reporter name + phone/email, single file attachment. |
| Arrival status | `PENDING_REVIEW` (triage gate, same as AI drafts). |
| Link mechanism | `Client.formToken` (random `crypto.randomUUID()`), URL `/r/[token]`, revocable. |
| Attachment storage | Server-side upload through the API route to a private Supabase Storage bucket; dashboard views via short-lived signed URLs. |
| Notification | Reuse WhatsApp owner-notify (WahaService). |
| Spam protection | Honeypot field + lightweight per-token/IP rate limit (best-effort). |

## Data flow

```text
Customer  GET /r/[token]            -> public form page (resolve client by formToken)
          POST /api/public/requests -> validate (Zod) -> upload file -> create Request
                                       - resolve client by token
                                       - match/create reporter Contact (by phone, scoped to client)
                                       - Request{ status: PENDING_REVIEW, source: FORM }
                                       - fire-and-forget WhatsApp notify to owner
Owner     dashboard /requests       -> approve -> OPEN (existing flow, unchanged)
```

## Schema changes (`prisma/schema.prisma`)

- `Client.formToken String? @unique` — per-client link key (nullable; regenerate to revoke).
- `Request.attachments String[]` — Supabase Storage object paths (empty by default).
- `RequestSource.FORM` — new enum value distinguishing form-origin tickets.

Apply via raw SQL through `prisma db execute --stdin` (`db:push` times out on the
Supabase pooler):

- `ALTER TABLE "Client" ADD COLUMN "formToken" TEXT;` + unique index.
- `ALTER TABLE "Request" ADD COLUMN "attachments" TEXT[] DEFAULT '{}';`
- `ALTER TYPE "RequestSource" ADD VALUE 'FORM';`

## Components

### Public form page — `app/r/[token]/page.tsx`

- Server component resolves the client by `formToken`. Unknown/null token renders a
  generic Hebrew "link not found" page (no signal about whether the token ever existed).
- Header shows the business name only: "דיווח תקלה / בקשה — {client.name}". No other client data exposed.
- Fields (RTL Hebrew):
  - `סוג הפנייה` (type): תקלה / בקשה / שאלה / אחר -> `BUG` / `REQUEST` / `QUESTION` / `OTHER`
  - `כותרת` (title, required)
  - `תיאור` (description, required, textarea)
  - `פרויקט / אתר` (optional dropdown of that client's projects, passed in server-side)
  - `שם מלא`, `טלפון`, optional `אימייל` (reporter)
  - `צירוף קובץ / צילום מסך` (optional, single file)
- React Hook Form + Zod. Success shows an inline Hebrew thank-you state (no redirect).
- Middleware: `/r/...` must be exempt from the auth redirect. Add `/r` (and the
  public submit route as needed) to the middleware matcher exceptions.

### `POST /api/public/requests` (public, no auth)

- Accepts `multipart/form-data`; parse with `request.formData()`.
- Zod schema: `token` (required), `type` enum, `title` (required), `description`
  (required), `projectId` (optional), reporter `name`/`phone`/`email` (optional),
  optional file. Hebrew error messages; honeypot field included.
- Steps:
  1. Resolve `Client` by `formToken`; generic Hebrew 404 if none.
  2. If `projectId` is given, verify it belongs to that client; ignore silently if not.
  3. Reporter Contact (only when a phone is provided — `Contact.phone` is non-null):
     find a Contact with that phone scoped to `clientId`; otherwise create one
     (`clientId` set, `status: CLIENT`, `source: OTHER`, name/email from the form).
     Link as `contactId`. If no phone is provided, leave `contactId` null (the
     reporter name/email, if any, go into the request description).
  4. If a file is present, upload to Supabase Storage; collect the object path.
  5. Create `Request{ status: PENDING_REVIEW, source: FORM, clientId, contactId?,
     projectId?, attachments, userId: owner.id }`.
  6. Fire-and-forget WhatsApp notify. Return `{ success: true }`.
- `OPTIONS` handler for CORS (same as the leads route).

### `GET /api/requests/[id]/attachment?path=...` (authenticated, owner-only)

- Confirms the request belongs to the user, then returns a short-lived Supabase
  signed URL for the stored object. Bucket stays private.

### Storage — `lib/services/storage.service.ts` (Supabase Storage)

- One private bucket `request-attachments`. Path: `{clientId}/{requestId-or-uuid}/{filename}`.
- Server-side upload via `@supabase/supabase-js` with a service-role key.
- New env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Pre-upload validation: max 5 MB; allowlist `image/png`, `image/jpeg`, `image/webp`,
  `application/pdf`. Reject otherwise with a Hebrew error.
- Bucket creation + env setup is a one-time manual step (documented, not automated).

### Dashboard integration

- Client detail page (`app/(dashboard)/clients/[id]`): a "טופס פניות" section showing
  `/r/{formToken}` with copy-to-clipboard and a "צור/אפס קישור" button that sets/rotates
  `formToken` via a dedicated authenticated endpoint `POST /api/clients/[id]/form-token`
  (generates a fresh `crypto.randomUUID()`, owner-scoped).
- Requests page: form tickets appear in the existing `PENDING_REVIEW` queue with a
  `source: FORM` badge; attachments render via the signed-URL endpoint. Approve/dismiss
  already work.

## Notification & error handling

- Reuse `WhatsAppAgentService.getOwnerChatId()` + `WahaService.sendMessage()`. Hebrew
  message includes business name, type, title, reporter, attachment yes/no, and that it
  awaits review. Fire-and-forget with `.catch()` logging; never blocks the response.
- Customer-facing errors are generic Hebrew strings; detailed errors logged server-side.
- File-upload failure does not lose the ticket: the Request is still created (attachment
  omitted) and the failure is logged.
- Zod failures return 400 with the first Hebrew message.

## Spam / abuse protection

- Honeypot hidden field: if filled, return success and create nothing.
- Lightweight per-token + IP rate limit (in-memory token bucket; sufficient at this
  volume, no Redis). Documented as best-effort.
- The private per-client token is the primary gate; the above are defense-in-depth.

## Testing

- Unit: Zod schema (valid/invalid, file size/mime), token resolution, reporter
  match-vs-create logic.
- Integration: `POST /api/public/requests` — happy path creates a `PENDING_REVIEW`
  `FORM` request tied to the correct client; bad token -> 404; honeypot -> silent drop;
  oversized/wrong-type file -> 400.
- E2E (Playwright): `e2e/public-request.spec.ts` — open `/r/[token]`, submit, assert
  thank-you; in dashboard assert the ticket appears in the review queue. Follows the
  existing fixtures pattern.

## Scope boundaries (YAGNI)

In scope: one public page, one public POST, one signed-URL GET, a small storage helper,
three schema additions, and the client-detail link UI.

Out of scope: multi-file uploads, customer-facing ticket status tracking, email
notifications, public-facing ticket history, CAPTCHA.

## Manual setup checklist

- Create the private `request-attachments` bucket in Supabase Storage.
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (local + Vercel; use
  `printf 'value' | vercel env add` to avoid trailing newlines).
- Generate a `formToken` for each existing client (via the new dashboard button).
