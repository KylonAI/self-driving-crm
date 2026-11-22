# Data sources by CRM type

The App's own list is `lib/crm/sources.ts` (`SOURCES`, `KINDS_BY_TYPE`). Use those ids for `sync_sources.source` and `sync_sources.kind`.

| Kind | Who connects | Services | How it syncs | Writes through intake |
| --- | --- | --- | --- | --- |
| email | each person | Gmail, Outlook | Every 15 minutes, cursor on the newest message time (`sync-gmail.md`) | `person` (the outside party), `company` from a work domain, `activity` kind `email` |
| calendar | each person | Google Calendar, Outlook Calendar | Every 30 minutes, events from the cursor to 14 days ahead (`sync-calendar.md`) | `person` per outside guest, `activity` kind `meeting` |
| meeting_notes | each person | Read AI, Fireflies, Otter, Fathom, Granola, tl;dv, Zoom, Google Meet | The provider's webhook when it has one, else every 30 minutes (`sync-meeting-notes.md`) | `activity` kind `meeting` with the summary; `task` for each action item with an owner |
| booking | team | Cal.com, Calendly | Provider webhook on booked / rescheduled / cancelled | `person`, `company`, `activity` kind `meeting` |
| forms | team | Typeform, Tally, Google Forms, website form | Provider webhook per response | `person`, `company`, `activity` kind `form` |
| billing | team (B2B, partners) | Stripe | Stripe webhook (subscription and invoice events) | `account` (status, plan, value), `activity` kind `other` |
| support | team (B2B) | Intercom, Zendesk | Webhook or every hour | `activity` kind `message`; `task` when a ticket waits on the team |
| product | team (B2B) | PostHog, Segment | Daily | `account` health and value fields only; never raw events |
| deal_flow | VC | Intro emails (from Gmail), DocSend | Intro threads detected in the Gmail sync; DocSend webhook | `company`, `person` (founder), `deal` stage `sourced`, `activity` |
| portfolio | VC | Carta, Visible, investor update emails | Monthly import; updates detected in the Gmail sync | `account` (portfolio company) and `activity` kind `note` |
| enrichment | team | Apollo, Crunchbase, Harmonic | On new companies and people, at most once per record | Only empty fields (intake never overwrites); disagreements go to Review |
| import | once | HubSpot, Salesforce, Pipedrive, Affinity, Airtable | One-time export, then import through intake | Every object; `source` = the tool, `source_ref` = its record id |

## Recommended per type

- **B2B sales:** email, calendar, meeting notes, booking, forms, billing (Stripe), support, product usage, enrichment, import from the old CRM.
- **VC / investing:** email (with intro detection), calendar, meeting notes, deal flow (DocSend), portfolio updates, enrichment (Crunchbase / Harmonic), import from Affinity or Airtable.
- **Partnerships:** email, calendar, meeting notes, booking, forms (partner applications), billing when partners are paid, enrichment.
- **Recruiting:** email, calendar, meeting notes (interviews), booking, forms (applications), enrichment.
- **Something else:** email, calendar, meeting notes; add the rest as the team asks.

## Checking a service before promising it

Run `connection search --query "<service> <what you need>"` to see whether Kylon has a sign-in for it, and `connection tool search --toolkit <toolkit> --query <capability>` for the exact tool names before writing code. A service with no connection can still come in by webhook or by a one-time export; say so instead of promising a live sync.
