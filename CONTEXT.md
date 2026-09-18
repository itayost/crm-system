# Context

The ubiquitous language of this CRM. Terms are canonical: code, prompts, and
conversation use these words with exactly these meanings.

Entries tagged _Retires under ADR 0004_ still describe live code. That ADR's
plans 2 to 4 remove it later; none of the removal has shipped yet.

## Glossary

### מוצר (Product)

The delivered system a client uses daily — the thing support conversations
are about. _Retires under ADR 0004._ Distinct from **פרויקט (Project)**, the
CRM's work/billing entity that built it. A Project has phases and money; a
Product has screens and users. The portal shows a client their Projects, so
this is the distinction its wording has to keep straight.

### כרטיס מוצר (ProductCard)

The support bot's authoritative description of a Product: screens, flows,
vocabulary, and what does not exist, in Hebrew. Regenerated from the repo when
its HEAD moves; the owner's manual notes (`manualNotesHe`) survive
regeneration and win on conflict.
_Retires under ADR 0004._

### פרופיל לקוח (Client profile, `Client.profileHe`)

What the support bot may know about a client — and may therefore say to them.
Bot-visible by design: nothing goes in it that must not reach the client's
ears.
_Retires under ADR 0004._

### הערות (Client.notes)

Owner-private free text about a client: מה שרק אתה יודע. Never reaches any
prompt. Complements **פרופיל לקוח**, the bot-visible profile above; ADR 0004
retires that profile, after which this becomes the only free text the CRM
holds about a business.

### מילון (Glossary)

The section of a client profile mapping the client's own words to canonical
screens and features ("הדבר של התשלומים" → מסך התשלומים). Grown by the bot
itself whenever a clarifying question resolves an ambiguous term.
_Retires under ADR 0004._

### פנייה (Request)

A client ticket, opened by the client in the portal. Lives on the Client (the
business), optionally linked to a Project and to the Contact who filed it.

A תקלה additionally carries **אבחון (intake)**: structured answers to איפה, מה
ציפית, כמה פעמים, חוסם. Today the extraction agent infers those from the
WhatsApp conversation; the portal reads them back as כך הבנתי אותך. ADR 0004
moves intake onto the client's own form, at which point that playback becomes
literally true: they wrote it.

### ליד (Lead)

A Contact in the active pipeline (`NEW → CONTACTED → MEETING_SCHEDULED →
QUOTED`). `LOST` ends a lead; `INACTIVE` ends a client. A contact born with a
business attached was never a lead.

_Reduces to `NEW → QUOTED` under the pending agent-teardown-and-crm-restructure
design, which drops `CONTACTED` and `MEETING_SCHEDULED`: neither says anything
**פעולה הבאה** does not already say in Itay's own words, while both have to be
advanced by hand._

### דיברתי (Spoke to them)

The single lead action: stamps `lastContactedAt` and captures the **פעולה
הבאה** in one step. Today it is one of three writers of `lastContactedAt`,
alongside both WhatsApp webhooks; ADR 0004's teardown deletes those webhooks
and leaves this the only one, which is why it had to ship before that
deletion — otherwise lead staleness in היום would be measured from a value
nothing sets.

### מקדמה (Advance)

The sum a client owes on signature, before any work is delivered. It belongs to
the Project rather than to any one phase, and it has no approval step — there is
nothing to sign off, so it is owed from the moment the project exists.

### גבייה (Collectable)

Every shekel Itay can invoice for right now, across all projects: unpaid
מקדמות plus every phase signed off and not yet paid. The owner's question.
_Avoid_: outstanding.

### לתשלום (Signed-off unpaid)

What a single project owes for work already approved: its signed-off, unpaid
phases, never its מקדמה. The client's question, and deliberately narrower than
גבייה — a client is being shown what their delivered work has cost, not what
they agreed to pay on signature.

The morning brief's תשלומים פתוחים section asks this same question, narrowed
further to live work: signed-off unpaid phases on ACTIVE projects. Its total is
therefore smaller than גבייה and is meant to be. _Retires under ADR 0004._
_Avoid_: outstanding.
