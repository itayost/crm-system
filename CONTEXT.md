# Context

The ubiquitous language of this CRM. Terms are canonical: code, prompts, and
conversation use these words with exactly these meanings.

## Glossary

### מוצר (Product)

The delivered system a client uses daily — the thing support conversations are
about. Distinct from **פרויקט (Project)**, the CRM's work/billing entity that
built it. A Project has phases and money; a Product has screens and users.

### כרטיס מוצר (ProductCard)

The support bot's authoritative description of a Product: screens, flows,
vocabulary, and what does not exist, in Hebrew. Regenerated from the repo when
its HEAD moves; the owner's manual notes (`manualNotesHe`) survive
regeneration and win on conflict.

### פרופיל לקוח (Client profile, `Client.profileHe`)

What the support bot may know about a client — and may therefore say to them.
Bot-visible by design: nothing goes in it that must not reach the client's
ears.

### הערות (Client.notes)

Owner-private free text about a client. Never reaches any prompt. The
complement of the profile: מה שרק אתה יודע.

### מילון (Glossary)

The section of a client profile mapping the client's own words to canonical
screens and features ("הדבר של התשלומים" → מסך התשלומים). Grown by the bot
itself whenever a clarifying question resolves an ambiguous term.

### פנייה (Request)

A client ticket. Lives on the Client (the business), optionally linked to a
Project and a Contact. One WhatsApp chat carries many separate פניות over
months — a chat is a stream, פניות are spans over it, never partitions of it.

### ליד (Lead)

A Contact in the active pipeline (`NEW → CONTACTED → MEETING_SCHEDULED →
QUOTED`). `LOST` ends a lead; `INACTIVE` ends a client. A contact born with a
business attached was never a lead.
