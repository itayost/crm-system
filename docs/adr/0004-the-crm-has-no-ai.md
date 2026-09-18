# 0004 — The CRM has no AI, and the portal is the only way in

Date: 2026-09-18
Status: accepted
Supersedes: [0001](0001-precomputed-product-cards.md), [0002](0002-degrade-dont-die.md)

## Context

Between 2026-03 and 2026-08 this CRM grew a substantial AI layer: a
client-facing WhatsApp support agent, an owner agent, per-message intake and
relation extraction, media transcription, precomputed ProductCards (ADR 0001),
a three-tier degradation chain (ADR 0002), and an LLM-written morning brief.
Seven services, five Prisma models, four crons, two webhooks, and 4,448 lines
of test, slightly over half the suite.

By 2026-09 the honest accounting was this:

- The client-facing bot had been **paused in production since 2026-08-13** and
  nothing broke that could not be handled by hand.
- The layer had accumulated three concurrent, unfinished migration attempts
  (`feat/support-agent-on-eve`, `ai-migration`, `feat/ai-model-registry`),
  which is what a subsystem looks like when nobody is sure what it should be.
- Its failure modes were shared and total. A zero Vercel credit balance
  rejects every gateway request including BYOK (hit 2026-08-01), which is the
  entire reason ADR 0002 exists. The mitigation was itself a third model tier
  on a VPS.
- Meanwhile the client portal at `/r/[token]`, rebuilt 2026-08-18, already did
  the thing clients actually needed: see where their work stands, and file a
  request.

The layer was solving a problem (clients will not use a portal, so meet them
in WhatsApp) by taking on a large, stateful, non-deterministic dependency. The
portal rebuild had quietly removed the premise.

## Decision

**No model is called anywhere in this system.** `lib/ai/` is deleted along
with all seven AI services, five models (`WhatsAppMessage`, `BotConversation`,
`SupportConversation`, `AgentProjectConfig`, `ProductCard`), both WhatsApp
webhooks, all four crons, and the `projects/[id]/agent` page. `vercel.json`
ends up with no crons at all.

**The portal is the only inbound channel.** A client opens a request by
filling a form, not by sending a message that something has to interpret. What
the extraction agent used to infer, `Request.intake`, is now simply what the
client typed: a תקלה answers איפה / מה ציפית / כמה פעמים / חוסם directly, and
the portal's existing כך הבנתי אותך playback becomes literally true.

**WhatsApp survives as an outbound pipe only.** `owner-line`, `waha.service`
and `whatsapp-identity` stay, sending template Hebrew for quote-sent,
phase-approved, request-done, and owner notices. No session listens. Deleting
it entirely was rejected: a portal nobody is told to check is a portal nobody
opens, and `notifyOwner()` remains the single line to Itay.

**The morning brief is deleted outright,** not reduced to a template. Its ~250
lines of queries answered questions the dashboard and היום already answer; only
the prose was AI, and the prose was the only part that was not duplicated.

## Consequences

- The `insufficient_funds` outage class, the gateway prompt-cache TTL problem,
  the Ollama tier, and the whole of ADR 0002's degradation chain stop existing
  rather than being managed. `OLLAMA_*`, `*_MODEL`, `GITHUB_TOKEN`,
  `CRON_SECRET`, `WAHA_BOT_SESSION` and `WHATSAPP_BOT_PAUSED` are retired.
- **What is genuinely lost:** 24/7 first response, automatic ticket extraction
  from chat, and voice-note transcription. Clients who would rather send a
  WhatsApp voice message than fill a form are worse off, and that is accepted.
- **`lastContactedAt` loses its only writer.** Both webhooks wrote it, and
  `today.service.ts` reads it for the quiet-leads count. That count is also
  gated on `nextActionAt: null`, so the teardown does not flood it; what it
  does is quietly change what it measures. With the field never written, the
  staleness clause collapses to `createdAt < 3 days ago`, so "leads I have not
  spoken to recently" silently becomes "leads whose record is old", and a lead
  phoned yesterday starts counting as quiet. A metric that lies is worse than
  one that is missing, which is why the דיברתי control ships first.
- `Request.contactId` was populated by phone-number identity on the bot
  session. The portal knows the business (`Client.formToken`), not the person,
  so the request form gains a contact select to keep attribution.
- Data in the five dropped models is exported to gitignored JSON first, and
  `Client.profileHe` is merged into `Client.notes` by hand before its column
  goes. Months of indexed client conversation is not recoverable once dropped.
- ADR 0001's ProductCard caching argument and ADR 0002's degradation chain are
  retained as history. Neither describes code that exists after this change.
