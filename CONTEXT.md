# Context

The ubiquitous language of this CRM. Terms are canonical: code, prompts, and
conversation use these words with exactly these meanings.

Entries tagged _Retires under ADR 0004_ describe schema that ADR's Plan 2
deliberately left in place: nothing reads or writes it any more, but dropping
it is Plan 3's job, not shipped yet.

## Glossary

### מוצר (Product)

The delivered system a client uses daily. Distinct from **פרויקט (Project)**,
the CRM's work/billing entity that built it. A Project has phases and money; a
Product has screens and users. The portal shows a client their Projects, so
this is the distinction its wording has to keep straight.

### כרטיס מוצר (ProductCard)

The support bot's authoritative description of a Product: screens, flows,
vocabulary, and what does not exist, in Hebrew. The bot that read and
regenerated it was removed in Plan 2 -- the table still exists, holding
whatever it last generated, but nothing reads or writes it.
_Retires under ADR 0004._

### פרופיל לקוח (Client profile, `Client.profileHe`)

What the support bot could know about a client — and could therefore say to
them. The bot is gone (Plan 2); the column still exists, and Itay can still
view and edit it by hand from the client page, but nothing automated reads or
writes it any more.
_Retires under ADR 0004._

### הערות (Client.notes)

Owner-private free text about a client: מה שרק אתה יודע. Complements
**פרופיל לקוח** above — until Plan 3 drops that column, after which this
becomes the only free text the CRM holds about a business.

### מילון (Glossary)

The section of a client profile mapping the client's own words to canonical
screens and features ("הדבר של התשלומים" → מסך התשלומים). The bot that grew it
is gone (Plan 2); whatever it already wrote remains inside `profileHe` until
Plan 3 drops that column.
_Retires under ADR 0004._

### פנייה (Request)

A client ticket, opened by the client in the portal. Lives on the Client (the
business), optionally linked to a Project and to the Contact who filed it.

A תקלה additionally carries **אבחון (intake)**: structured answers to איפה, מה
ציפית, כמה פעמים, חוסם. The extraction agent that used to infer those from the
WhatsApp conversation is gone, and the portal's own form does not yet ask for
them — `Request.intake` has no writer until Plan 7 gives it one. The portal's
כך הבנתי אותך playback still runs and shows whatever an existing request
already has; a new request arrives with nothing to play back.

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
הבאה** in one step. It is now the only writer of `lastContactedAt` — the two
WhatsApp webhooks that used to write it alongside it are gone, deleted by ADR
0004's Plan 2. It had to ship before that deletion, or lead staleness in היום
would be measured from a value nothing sets.

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
_Avoid_: outstanding.
