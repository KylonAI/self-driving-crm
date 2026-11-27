---
name: kylon-crm-practice
description: Rebuild a full CRM practice in this Kylon workspace, the way the Kylon team runs its own: a CRM App that is the single source of truth for customers, every person's mailbox and calendar syncing into it, website forms and booking pages creating records with research attached, meeting recaps turning into follow-up email drafts, a daily sign-up digest, every automated email logged to the customer's own thread, and product and website analytics (PostHog, Microsoft Clarity) tied to accounts. Guides the team step by step through connecting their own tools (Gmail or Outlook, Google or Outlook Calendar, HubSpot or another CRM, Cal.com or Calendly, a form tool, a note taker, PostHog, Clarity, Stripe). Use when someone uploads this package, asks to set up the CRM practice, copy Kylon's CRM and email intake, connect a data source to the CRM, or asks why something is not syncing.
human_description: Walks your team through building a CRM in Kylon and connecting your email, calendar, booking, forms, meeting notes and analytics to it, one step at a time.
---

# Kylon CRM practice

You are setting up a CRM practice for this team: a CRM App that holds every customer, and a set of Automations that keep it current from the tools the team already uses. You lead the conversation and do the work yourself. People decide; you build, show, and ask before anything goes live.

Read `references/operating-rules.md` before step 1. Those rules come from mistakes we made running this ourselves, and they apply to every step.

Read `references/how-it-learns.md` too. From the first run, every correction and every repeated Review decision becomes a rule you write down and follow; that is what makes the CRM run itself.

## How each step runs

Every step below follows the same loop. Do not skip parts of it.

1. **Ask** what you need in one card with concrete options and a recommendation. Keep it to the questions that step needs.
2. **Check the service** before promising it: `connection search --query "<service> <capability>"`, then `connection tool search --toolkit <toolkit> --query <capability>` for exact tool names. If there is no connection, say how it can still come in (webhook, export file) instead of promising a live sync.
3. **Show the plan**: what will be read, what will be written, where results appear, who approves what. For a flow with branches, show it as a Mermaid diagram (sources in `diagrams/*.md`, rendered PNGs beside them).
4. **Rehearse on real data** with your own tools, read-only or into a test record, and show the result.
5. **Save** the Automation only after the person accepts both the plan and the rehearsal. Use the templates in `code/automations/`; keep reads, loops, de-duplication and writes in code.
6. **Verify**: read back what you saved, offer one Run once, and check the first records landed in the CRM.

Progress is tracked in the CRM's **Settings › Data sources** page. Tell people where it is after each step.

## 0. Goals interview

Run the interview in `references/interview.md`. It decides which of the steps below apply and in what order. Write the answers into the CRM App settings once it exists (step 1), and keep a one-page summary file in this Room so later turns can read it.

## 1. Build the CRM App

The App source is the `crm-template-source` skill; install it next to this one. Follow `code/crm-app/INSTALL.md`: create a custom App named "CRM" in this Room, copy the source in, validate, preview, and publish only after the person confirms and says who should have access. The database starts empty. Never add sample people or companies to the live App; the screenshots in this repository's `docs/screenshots/` show what it looks like with made-up data.

Then set the CRM type, organisation name and pipeline stages: `PATCH /api/settings` (see `references/intake.md` for the App's API, and `references/sources.md` for which sources each type needs).

## 2. Decide what happens to the existing CRM

If the team uses HubSpot or another CRM, follow `references/hubspot.md`. The person chooses; recommend making this CRM the system of record (a full move, or a side-by-side period that ends on a set date). Migration itself follows `references/migration.md`: analyse read-only, propose plans, trial 20 records, then import through the intake.

If they keep customers in a spreadsheet or another App, use the same migration steps.

## 3. Bring in what this workspace already holds

Look through this Room's Automations, files and Apps for anything that creates or changes customer information (and nothing else). Propose **connect** (it also writes through the intake), **import once**, or **leave** for each. Details in the install steps of `references/migration.md`.

## 4. Connect each person's mailbox and calendar

Each person connects their own account, in their own turn, and gets their own sync Automation. Never sync one person's mailbox under someone else's access.

- Gmail: `references/sync-gmail.md` with `code/automations/gmail-sync.ts`.
- Outlook: `references/sync-outlook.md` with `code/automations/outlook-sync.ts`.
- Google Calendar or Outlook Calendar: `references/sync-calendar.md`.

Agree the default scope first (outside parties only, subject and snippet rather than full bodies, 30-day backfill, a personal skip list).

A Google Workspace or Microsoft 365 admin can instead set up one company-wide mail capture that covers every teammate's customer mail without each person connecting (`references/mail-gateway.md`). Offer it when the team is large or wants no per-person setup; it needs the admin's approval and covers only mail with outside parties.

Mail from tools the team chose not to connect (scheduler confirmations, note-taker recap emails, form notifications) can be recognised by sender in either path and handled as a booking, recap or submission.

## 5. Inbound intake: website forms and booking pages

`references/forms-and-booking.md`. A form submission or a booking creates or updates the person and company through the intake, runs background research (`prompts/company-research.md`, `prompts/people-search.md`), and posts one alert card in a dedicated thread for whoever handles it. Ask which form tool and scheduler they use (Cal.com, Calendly, HubSpot Meetings, a website form, Typeform, Tally, Google Forms).

## 6. Meeting recaps and follow-up drafts

Ask which note taker they use (Read AI, Fireflies, Otter, Fathom, Granola, tl;dv, Zoom, Google Meet, or none). Sync recaps with `references/sync-meeting-notes.md`. Then add the follow-up step in `references/meeting-follow-up.md`: after each customer meeting, an email **Draft Card** from the mailbox of whoever ran the meeting, in that customer's own thread, replying in their latest email thread with the guest. A person reviews and sends it.

## 7. Product and website analytics

Ask what they sell (`references/interview.md`, question 2): a product people sign up for, or a service where the website is the lead source.

- PostHog: `references/posthog.md`. For a sign-up product, tie product usage to each account; for a services business, use it for website visits and lead source.
- Microsoft Clarity: `references/clarity.md`. Page and session behaviour (rage clicks, dead clicks, scroll depth, top pages), reported by page and source; it does not identify people, so it never writes person records.
- For a sign-up product, add the daily sign-up digest: `references/signup-digest.md`.

## 8. Log every automated email to the customer's thread

`references/email-log.md`. Any email an Automation sends or drafts for a customer appears in that customer's record thread with what was actually sent, when, from which mailbox, and its real delivery status. If an email cannot be matched to one customer safely, the send pauses instead of going out unlogged.

## 9. Daily check and wrap-up

Offer the daily CRM check in `references/daily-check.md` (stale syncs, records missing background, duplicates, open Review items).

Finish with a short checklist: CRM type and stages, migration result with counts, each data source with who connected it and its first sync, which intake Automations are live, who still has to connect. Offer to come back for anyone who has not.

## 10. Learning

Follow `references/how-it-learns.md` from the first day: when someone corrects you, fix the work and write the rule where it belongs, with their name and the date; when the team settles the same kind of Review item the same way three times, write that down too. After the first clean week, offer the Monday "What I learned this week" card, saved paused until someone turns it on.

## When something stops syncing

`GET /api/data-sources` shows each account's status, last sync and last error. An expired sign-in needs the owner to reconnect in their own turn. A code error is fixed in the Automation, never by writing rows by hand.
