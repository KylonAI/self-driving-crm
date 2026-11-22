# HubSpot (or another existing CRM)

The person decides what happens to HubSpot. Present three options in one card and recommend the first or second. Kylon's own practice is to keep one system of record, and to make it the Kylon CRM, so that every sync, research note, Draft Card and thread hangs off one record.

## The three options

1. **Full move (recommended when HubSpot holds mainly contacts, companies and deals).** Import everything once, check counts, then HubSpot goes read-only. The team works in Kylon from day one.
2. **Side by side for a set period (recommended when marketing still runs in HubSpot: forms, sequences, lists).** Import once, then a scheduled Automation pulls new and changed HubSpot records into the CRM through the intake every hour. Pick an end date (for example 30 days) when the team switches fully. Nothing is written back to HubSpot.
3. **Two-way sync (not recommended).** Changes flow both ways. It doubles the matching rules, creates conflicts every time two people edit the same deal, and is the most work to keep running. Offer it only if the person insists, and say so plainly.

## Connecting

- `connection search --query "hubspot crm contacts deals"` returns the HubSpot toolkit. The person who administers the HubSpot account connects it (`connection create --toolkit hubspot`); it is a team source, connected once.
- Find exact tool names with `connection tool search --toolkit hubspot --query "list contacts"`, then the same for companies, deals, engagements (notes, emails, meetings, calls) and owners. Do not write code against tool names you have not seen returned.
- If the person prefers not to connect it, ask for a full export (HubSpot: Settings › Import & Export › Export, one CSV per object) attached in this Room.

## What maps where

| HubSpot | CRM | Notes |
| --- | --- | --- |
| Company (domain, name, industry, size, owner) | company | Matched by domain |
| Contact (email, name, title, phone, company) | person | Matched by email |
| Deal (name, pipeline, stage, amount, close date, owner) | deal | Stages mapped into the stages chosen in setup; unmapped stages are listed for the person |
| Engagements (email, meeting, call, note) | activity | `source` = "HubSpot", `source_ref` = engagement id |
| Tasks | follow-up | Only open tasks |
| Owners | workspace members | Matched by email; unmatched owners are listed, not invented |
| Lists | lists | Static lists only; active lists are rules, so describe them instead |
| Custom properties | fields or notes | Show fill rate first; move only the ones the person picks |

Follow `migration.md` for the analysis report, plan card, 20-record trial and batched import. During a side-by-side period the scheduled pull uses the same mapping and `source_ref`, so a record imported once is never duplicated.

## Things to tell the person up front

- HubSpot workflows, sequences and forms do not move. Their Kylon equivalents are set up in later steps (forms and booking intake, follow-up drafts).
- Email history only comes over as HubSpot logged it. Each person's mailbox sync (step 4) fills in the rest going forward and for the backfill window.
- Nothing is deleted in HubSpot. Switching it off is the person's call after they confirm the counts.
