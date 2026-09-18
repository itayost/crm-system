# Context

The ubiquitous language of this CRM. Terms are canonical: code, prompts, and
conversation use these words with exactly these meanings.

## Glossary

### מוצר (Product)

The delivered system a client uses daily. Distinct from **פרויקט (Project)**,
the CRM's work/billing entity that built it. A Project has phases and money; a
Product has screens and users. The portal shows a client their Projects, so
this is the distinction its wording has to keep straight.

### הערות (Client.notes)

Owner-private free text about a client: מה שרק אתה יודע. The only free text
the CRM holds about a business, now that the bot-visible profile is gone.

### פנייה (Request)

A client ticket, opened by the client in the portal. Lives on the Client (the
business), optionally linked to a Project and to the Contact who filed it.

A תקלה additionally carries **אבחון (intake)**: the structured answers the
client gives on the form (איפה, מה ציפית, כמה פעמים, חוסם). Other request types
do not ask for it. The portal reads it back to them as כך הבנתי אותך, which is
now literally true: they wrote it.

### ליד (Lead)

A Contact in the active pipeline (`NEW → QUOTED`). `LOST` ends a lead;
`INACTIVE` ends a client. A contact born with a business attached was never a
lead.

Two active states, not four. `CONTACTED` and `MEETING_SCHEDULED` were removed
because neither said anything **פעולה הבאה** did not already say in Itay's own
words, while both had to be advanced by hand. What a lead is waiting on is
prose, not an enum; the only distinction worth a state is whether a price is
already with them.

### דיברתי (Spoke to them)

The single lead action: stamps `lastContactedAt` and captures the **פעולה
הבאה** in one step. It is the *only* writer of `lastContactedAt` — the field
was previously written by the WhatsApp webhooks alone, so without this control
lead staleness in היום would be measured from a value nothing ever sets.

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
