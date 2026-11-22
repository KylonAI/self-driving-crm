# PostHog

PostHog answers two questions for the CRM: **where did this person come from** (first visit, UTM tags, referrer, landing page, the last touch before signing up or booking) and, for a product people sign up for, **how is this account using it** (active users, key actions, last activity). It never decides whether someone is paying; that comes from billing.

## Connecting

- `connection search --query "posthog analytics events query"` returns PostHog. Whoever administers the PostHog project connects it once (team source).
- Find the tools with `connection tool search --toolkit <posthog toolkit> --query "query sql events persons"`. Prefer a SQL (HogQL) query tool for anything with counts or joins; it is exact and cheap. Confirm the project id from the tool, never from memory.

## Questions to ask first

1. **What do you track today?** Ask for, or look up in PostHog, the event names for: page view, sign-up, workspace or account created, first key action, payment (if sent to PostHog), booking or form submit. Write the list into the setup summary. Do not assume our event names.
2. **How do person and account link?** For a product: is `identify()` called with the user's email or id at sign-up, and are accounts tracked as PostHog groups? Without identify, website visits cannot be tied to the person who signed up.
3. **Since when?** The date each event starts. History before that is not "zero", it is "not tracked".

## Where the numbers go in the CRM

The template has no lead-source or usage columns. Two ways, ask the person:

- **No App change (default):** write each finding as an activity through the intake (kind `other`, subject such as "First visit: Google search, /pricing" or "Usage this week: 4 active users, 31 key actions"). The intake only fills empty fields, so a sync must not try to keep changing a field such as the account's `health`; every change would land in Review. Leave `health` to the account owner and send them the signal instead.
- **Filterable fields:** if they want to sort and filter by lead source or usage, add columns with a new migration (for example `lead_source`, `first_visit_at`, `usage_7d`, `last_active_at`), extend the intake to accept them, and redeploy. Follow `code/crm-app/TEMPLATE_GUIDE.md`; never edit the first migration.

## What to build

### For every team: lead source on each new person

When a person is created through a form, a booking or a sign-up (steps 5 and 7), look them up in PostHog by email (or distinct id), read their first visit (date, landing page, referrer, UTM tags) and their last touch before the conversion, and write them as described above. Keep these as separate facts: first visit and last touch are often different channels.

Before writing "came from X", also check the mailboxes and the CRM for earlier contact (operating rules, Attribution). PostHog only sees tagged links.

### For a product with sign-ups: account usage

A daily scheduled Automation, in code:

1. Read the CRM's current account list (paginated).
2. One SQL query for all of them: active users and key actions in the last 7 and 28 days, last activity time, per account (group) or per person email.
3. Write one weekly usage activity per account through the intake (or the usage columns, if the team added them and made the sync their owner). Never raw events.
4. Flag for the account owner, without changing status: a paying account whose usage fell sharply against its own previous weeks; a cancelled account that is still very active; an unpaid account with high usage. These are signals to check, not conclusions.

### For a services business: website and lead source only

Skip account usage. Use PostHog for lead source on new people and for a weekly channel summary (visits, form submits and bookings by source).

## Pitfalls we hit

- Payment and subscription events in analytics are incomplete for older customers. Paid status always comes from billing.
- Connection or integration events may only start recently and may not record removals; do not call a connection live from analytics alone.
- A privacy fix or tracking change can stop an event or property overnight. Check for a tracking change before reporting a drop.
- Time zones: state the zone of every timestamp you report.
