# Daily CRM check

A daily saved-code Automation that looks for problems in the CRM and proposes fixes through Review. It never changes records directly.

Code template: `code/automations/daily-check.ts`.

## What it scans

- **Duplicates:** companies with the same normalised name (legal suffixes removed) or the same root domain (public mail domains excluded); people with the same email.
- **Profile gaps:** active companies missing two or more of industry, country, domain; companies whose name is just a domain.
- **Attribution:** people or accounts linked to the wrong company (for example most outside members belong to another company).
- **Sync health (report only):** data sources whose last sync is older than expected; paying accounts without an owner; billing status that disagrees with billing records.
- **Review noise (report only):** suggestions whose value differs only in case or punctuation.

## How it runs

1. Load the current records (paginated) and open Review items. Skip anything already in Review or skipped in the last 14 days.
2. Rank candidates by importance (paying, active, recent meetings) and take the top 20.
3. Code gathers the evidence for each (record context, linked domains, homepage text). One tool-free model call per small batch judges only the supplied evidence and returns structured verdicts within an allowed set of changes per candidate. Code validates every change (ids exist, field allowed, value not empty).
4. Write accepted proposals to Review with the reason and the evidence quote. A person approves or rejects.
5. Post a short summary: new in Review, checked and not proposed (with why), sync issues, and per-rule acceptance so far.

## Learning from decisions

Track how often each rule's proposals are approved. A rule approved 90% of the time or more over at least ten decisions can be proposed for automatic writing; one approved 20% of the time or less should be tightened or dropped. These are suggestions to a named approver, never automatic.

## Pitfall

Our first version used agent sub-steps to verify candidates. When the executing agent changed, their replies leaked into the Room as raw JSON and the script got nothing back. Code plus a tool-free model call with a fixed output shape is the reliable form.
