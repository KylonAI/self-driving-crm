# Website forms and booking pages

Two kinds of inbound: someone fills in a form ("book a demo", "contact us", an application), or someone books a meeting through a scheduler (Cal.com, Calendly, HubSpot Meetings, Google appointment schedule). Both follow one rule: **one customer, one thread**. Everything about a person (their form, their booking, the recap, the follow-up draft) lands in the same record thread.

Code templates: `code/automations/form-intake.ts` and `code/automations/booking-sync.ts`. Flow: `diagrams/forms-and-booking.md`.

## Ask first

1. Which form tool and which scheduler. Check each with `connection search`; most schedulers have a team webhook, and most form tools can POST to a webhook URL.
2. Who handles new leads and bookings (a person per event type is fine).
3. Qualification rules, if any: which answers mean "offer a call", which mean "self-serve", which countries or company sizes they do not contact proactively. Keep these rules on the website or form side when possible and have the payload carry the verdict; the Automation only displays it.
4. Which fields the form collects, so the payload maps cleanly.

If the team prefers not to connect the scheduler or form tool, their confirmation emails still reach someone's mailbox; the mailbox sync (step 4) can recognise those senders and treat them as bookings or submissions. Offer that path.

## Form intake (webhook Automation, saved code, no model calls)

1. **Receive.** Accept only the expected payload type; a submission without an email fails the run with a clear error.
2. **Normalise.** Lowercase email, derive domain, map answer values to readable labels, mark personal-mailbox addresses.
3. **Key.** Build an idempotency key from email plus submit time (for example `form <email> <submittedAt>`). Put it in the card's fallback text, and before posting search the thread history for it. A retried webhook then never posts twice.
4. **Internal test.** Submissions from the team's own domains go to a test thread and write nothing to the CRM.
5. **Write the CRM** through the intake: person, company from a work domain, an activity of kind `form` with the answers, and a follow-up task for the lead owner if the rules say "offer a call".
6. **Find the home thread**, in order: an existing partner record (if partners live in this CRM), the existing person or account record thread, else the record just created. If every lookup fails, post in the Room's main chat rather than drop it, and log why.
7. **Post one card** in that thread. Lead with who, company and country, what they want help with, and the one next step. Put the rule and reasoning in a collapsed Details section.
8. **Start research** for new companies: schedule a follow-up turn in the record thread that runs `prompts/company-research.md`, or run it in the code with one tool-free model call over fetched pages. Never as an agent sub-step inside the code.

## Booking sync (webhook Automation, saved code)

1. **Receive** booked, rescheduled, cancelled and no-show events from the scheduler's team webhook.
2. **Keep only team-hosted bookings.** Guests are attendees outside the team's domains.
3. **Write the CRM** through the intake: each outside guest as a person (with company from the work domain), and an activity of kind `meeting` with `source_ref` = the booking id. Form answers from the booking go into the activity summary; tracking parameters (utm_*, click ids) are kept out of the summary and recorded as the lead source (see `posthog.md`).
4. **Rescheduled:** mark the old booking's activity cancelled and write the new one. **Cancelled:** mark it cancelled; never delete. **No-show:** record attendance on the activity only when the scheduler reports every outside guest missing.
5. **Card for the host** in the guest's home thread: who, company, when (in the host's time zone), what they asked for, and background research. Mention the host. Nothing internal on the card.
6. **Safety net.** Webhooks get missed. Add a scheduled check every 15 to 30 minutes that lists bookings from the scheduler for the next 14 days and the last day, and repairs anything missing or stale through the same code path.

Group or seated events (a recurring webinar, a tour) are rebuilt from the scheduler's full attendee list each time, never from a single seat event.

## Pre-call reminder (optional)

A scheduled Automation an hour before each customer meeting: posts in the guest's thread a short brief for the host (who they are, what they asked, earlier contact, three questions worth asking). Uses the research already on the record; it does not research again.

## Pitfalls we hit

- The card's fallback text became a contract: a later Automation parsed it to find the form's thread. Keep its line format stable when you redesign the card.
- After cards moved from the main chat into record threads, de-duplication had to search thread replies too.
- A record's create endpoint can silently drop some fields; read back after every write.
- Retry rate limits and server errors with backoff; do not retry other client errors.
- A 404 from an App lookup means "not found", not a failure.
- Check that the scheduler's webhook actually points at this Automation after setup. Ours once pointed elsewhere and only the scheduled safety net kept the data current.
