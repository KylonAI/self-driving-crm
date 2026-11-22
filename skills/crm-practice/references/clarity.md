# Microsoft Clarity

Clarity records how visitors use the website: sessions, scroll depth, rage clicks, dead clicks, quick-backs, JavaScript errors and top pages. It does not identify people by default, so in this practice it never creates or changes person records. It answers questions about pages and channels: which landing page loses visitors, which traffic source brings engaged sessions, what broke after a site change.

## Connecting

- `connection search --query "microsoft clarity analytics"` returns the Microsoft Clarity toolkit. Whoever administers the Clarity project connects it once (team source).
- Confirm the exact tools with `connection tool search --toolkit microsoft_clarity --query "insights metrics"` before writing code. Clarity's data export returns aggregated metrics for the last one to three days, broken down by up to three dimensions (for example URL, source or channel, device, country), and it allows only a small number of calls per project per day. Check the limits the tool reports and design around them.

## What to build

1. **Daily website snapshot (scheduled, once a day).** One call per day for the last day, by URL and by traffic source. Store the result in the CRM's insights or a small "Website daily" table so history builds up past Clarity's three-day window. Never call it more often than the daily limit allows; one scheduled run is enough.
2. **Page health in the daily report.** Add to the team's daily card: sessions, engaged-session share, top three pages by rage clicks or dead clicks, and any page whose numbers changed sharply from its own seven-day average. Link each page.
3. **Optional: account-level behaviour.** Only if the team's website calls Clarity's identify API with a stable customer id after sign-in. Then Clarity sessions can be looked up per account, read-only, for a person investigating a specific customer. Do not write Clarity data into person records.

## Using it with PostHog

When both are installed: PostHog is the source for who signed up and where they came from; Clarity is the source for how a page behaves. A sudden drop in sign-ups is checked in PostHog first (did tracking change?), then in Clarity (did the page break?).

## Things to say plainly

- Clarity numbers are sampled and aggregated; quote them as page trends, not counts of people.
- With a cookie consent banner, visitors who decline are not recorded. Say so when comparing to other sources.
