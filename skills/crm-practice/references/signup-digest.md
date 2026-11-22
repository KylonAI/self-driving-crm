# Daily sign-up digest

For a team whose product people sign up for. Once or twice a day, one post in the CRM Room lists everyone who signed up since the last digest. Each entry has a two-sentence background on the person or company, where they came from, and how far they got in the product. The same profiles are written into the CRM, so the CRM holds the only copy.

Code template: `code/automations/signup-digest.ts`. Flow: `diagrams/signup-digest.md`.

## Ask first

1. Where sign-ups are recorded: the product's own database or admin API (best), PostHog events (`posthog.md`, question 1), or both. Analytics alone misses people with ad blockers and native-app sign-ups. Merge the product's own list when there is one.
2. When the digest posts (one or two times a day, in whose time zone) and where (the CRM Room, or a sales Room).
3. Which milestones count as progress (invited a teammate, connected a tool, first key action, started a trial, paid). Use their event names.
4. Priority rules, if any: target countries, company size, plan.

## How it runs (saved code, scheduled)

1. **Window by cursor.** State holds a cursor. The window runs from the cursor (minus a few hours, to catch late records) to now. The cursor advances only after the whole run succeeds, so a failed day is covered by the next run automatically.
2. **Finish any window in flight first.** If the last run stopped after posting but before writing back, finish the write-back; never post again.
3. **Collect sign-ups** from every source, skip ids already handled, drop internal and test accounts, and drop re-fired events for accounts created earlier (onboarding links can fire "account created" again for old accounts).
4. **Research.** Reuse the CRM's existing company profile when there is one; research only the rest (`prompts/company-research.md`), as deterministic fetches plus one tool-free model call that only summarises the fetched material. Two sentences: what they do, where they are (only if a source says so), industry. No usage numbers in the profile.
5. **Lead source** from PostHog (first visit and last touch), and earlier contact from the mailboxes and CRM (operating rules, Attribution).
6. **Post once.** Before posting, check the Room's latest messages for a post that already starts with this window's prefix and adopt it. If the post is longer than the message limit, split on line breaks into a top-level message and replies. Save the message id to state right away.
7. **Write back** one intake call per sign-up (person, company, account if they created one), idempotent on account id plus date. Values a person already set are never overwritten.
8. **Close the window:** add the handled ids to state, advance the cursor, report counts.

## Post format

A header line with counts (signed up, listed, by source). Then the priority group, then the rest. One line per sign-up: name and company linked to the CRM record, the two sentences, place, source, milestone tags. People with no public match are grouped at the end under "No public match yet". No usage details that the team would not want quoted to the customer.

## Two schedules, one state

An Automation has one schedule. For two daily posts, keep one digest Automation and add a tiny second Automation on the other schedule that only triggers the first. Both runs then share one cursor and never double-post.

## Pitfalls we hit

- An analytics query timed out twice in a row and a whole day was lost. Retry with backoff, and let the cursor-based window catch up instead of keeping a list of missed days.
- Once a day was too slow; the CRM fell a day and a half behind. Twice a day, each listing only what is new since the last.
- Long posts hit the message limit. Split deterministically.
