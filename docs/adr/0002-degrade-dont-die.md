# 0002 — The support bot degrades, it does not die

Date: 2026-08-01
Status: accepted

## Context

Every model call in the system runs through one shared dependency, the Vercel
AI Gateway, and it has a failure mode that takes all of them down at once: a
zero team credit balance rejects every request, BYOK included (hit 2026-08-01).
During that outage the client got only a canned receipt, nothing was filed,
the batch-extraction rescue cron was equally gateway-bound, and nobody told
Itay. Meanwhile the Hetzner VPS that runs WAHA has idle Ollama infrastructure
left by the retired project-health agent.

## Decision

A client-facing support turn answers through a three-tier chain:

1. **Gateway (Sonnet)** — the full agent, unchanged.
2. **Local model (Ollama/Gemma on the VPS)** — a short no-tools Hebrew
   acknowledgement written by `degradedSupportReply` in
   `lib/ai/resilient-model.ts`. It is forbidden to claim a ticket was filed,
   capped at 200 output tokens and 120s.
3. **Canned copy** — the pre-existing `CLIENT_ACK_MESSAGE`.

On every degraded turn (tier 2 or 3) the owner gets a WhatsApp handoff ping —
WAHA does not depend on the gateway, so the ping works precisely when
everything else fails — and the message is released back to batch extraction.

The fallback lives in **the webhook route's catch, not in
SupportAgentService**: the service's prompt contract stays untouched (and so
do its ~60 tests), and the degraded path structurally cannot run tools or the
full prompt. Failure detection is deliberately dumb: catch everything; error
classes are for logging only.

Background work runs the chain in reverse — the morning brief prefers the
local model and pays the gateway only when the VPS cannot answer. One brief a
day is latency-free, so slow CPU inference costs nothing, and the Hebrew
quality drop is owner-facing.

The whole local tier is env-gated (`OLLAMA_BASE_URL`, `OLLAMA_API_KEY`,
`OLLAMA_MODEL`): unset, tier 2 silently steps aside and the chain still works.

## Consequences

- A gateway outage now produces: a human-sounding receipt to the client, an
  explicit ⚠️ ping to Itay per affected turn, and a message queued for batch
  extraction — instead of silence on all three.
- The owner agent keeps its plain error reply: it is 100% tool-driven and a
  small local model cannot call tools usefully.
- Media transcription and intake extraction already degrade safely on their
  own and get no local fallback.
- A full swap of the client chat to the local model was considered and
  rejected: CPU latency (30–90s prompt processing), weak Hebrew, unreliable
  tool calling — the filing bugs happened with a frontier model.
