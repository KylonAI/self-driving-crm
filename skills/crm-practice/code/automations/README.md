# Automation templates

Saved-code templates for every Automation in this practice. Each file is self-contained: it starts with the same block of shared helpers (calling a Connection's tools, the CRM App API, the workspace API and a tool-free model call), then the Automation's own steps. Keep the shared block identical across files so a fix in one is easy to copy to the rest.

Every template writes customer data only through the CRM's `POST /api/intake` (see `references/intake.md`). Activities are idempotent on `source` + `source_ref`, so re-runs and backfills are safe.

## Files

| File | What it does | Trigger | Guide |
|---|---|---|---|
| `gmail-sync.ts` | One person's Gmail into the CRM | every 15 min, per person | `references/sync-gmail.md` |
| `outlook-sync.ts` | One person's Outlook (Inbox and Sent Items) | every 15 min, per person | `references/sync-outlook.md` |
| `calendar-sync.ts` | One person's Google Calendar meetings with outside guests | every 30 min, per person | `references/sync-calendar.md` |
| `mail-gateway-reader.ts` | Company-wide mail capture, instead of per-person sync | cron, every 30 min, runs as the capture agent | `references/mail-gateway.md` |
| `form-intake.ts` | Website form submission: CRM write, one card, research | webhook | `references/forms-and-booking.md` |
| `booking-sync.ts` | Scheduler bookings (Cal.com, Calendly), plus a polling safety net | webhook + every 15 min | `references/forms-and-booking.md` |
| `meeting-recap-check.ts` | Recaps to notes, to-dos and a follow-up Draft Card turn | every 15 min | `references/meeting-follow-up.md` |
| `signup-digest.ts` | Daily sign-up post with backgrounds, written back to the CRM | cron, once or twice a day | `references/signup-digest.md` |
| `posthog-lead-source.ts` | First visit and last touch for each new person | hourly | `references/posthog.md` |
| `posthog-usage.ts` | Weekly usage per account and signals for the owner | daily | `references/posthog.md` |
| `clarity-daily.ts` | Website page and channel snapshot from Microsoft Clarity | daily | `references/clarity.md` |
| `email-log.ts` | Functions to paste into any Automation that emails customers, plus an example | n/a | `references/email-log.md` |
| `daily-check.ts` | Duplicates, profile gaps, stale syncs, proposed into Review | daily | `references/daily-check.md` |

## Placeholders

Fill every `__PLACEHOLDER__` before saving. The shared ones:

- `__WORKSPACE_ID__`, `__CRM_APP_ID__`, `__CRM_ROOM_ID__`: from the workspace and the installed CRM App.
- `__RUNTIME_CREDENTIAL_ENV__`: the variable name the Automation runtime uses for its own credential (see `workflow help`, Data APIs). A name, never a value.
- `__MODEL__`: a fast Claude model for sorting mail and short summaries. Recaps read better with a stronger one; pass it as the last argument of `modelJson`.
- `__TEAM_DOMAINS__`: a JSON array of the team's own email domains, lowercase.

Per-file placeholders are explained in a comment next to each one. Connection ids come from the owner's own `connection list`; never reuse an id from another person or another workspace.

## Rules that apply to every template

1. **Rehearse before saving.** Run the steps once with your own tools on real data, read-only or into a test record, and show the result. Log one item from every provider on that rehearsal and adjust the field mapping: providers rename fields.
2. **Per-person syncs are created in that person's own turn**, so they run under their access. Never sync one person's account under someone else's.
3. **Cursors move only after a run that finished.** A failed run is repeated in full; the intake ignores what already landed.
4. **Nothing is posted twice.** POSTs to the workspace are not retried; cards carry a key in their fallback text and code checks for it first.
5. **Model calls are tool-free** and only judge or summarise material the code supplied. The code validates the JSON and fails closed. No agent sub-steps inside saved code.
6. **Nothing emails a customer by itself** unless the team decided so for that one flow, and then it logs through `email-log.ts`. Follow-up emails are Draft Cards a person sends.
7. **Fail visibly.** A run with failed items exits with an error and records `last_error` on the Data sources row.

## What has and has not run

`gmail-sync.ts` comes from the CRM template's install guide. The others follow Automations the Kylon team runs today, but they were rewritten for this CRM's API and with the team's own names, rules and ids removed. Every template passes a strict TypeScript check against the Automation SDK's interface. None has run against a fresh CRM yet, so the rehearsal in rule 1 matters for every one. Four have no live counterpart at Kylon: the per-person syncs `gmail-sync.ts`, `outlook-sync.ts` and `calendar-sync.ts`, and `clarity-daily.ts`.
