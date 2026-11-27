# Operating rules

How we run the CRM day to day. Each rule exists because we got it wrong once. They apply to every step of the setup and to every Automation it creates.

## Data

- **One write door.** Every sync, import and Automation writes customer data through the CRM's `POST /api/intake`. Matching (email for people, domain for companies), de-duplication and Review only work if nothing writes around it.
- **Idempotent by source.** Every write carries `source` and `source_ref` (the original id). A re-run or backfill then creates nothing twice.
- **Fill blanks, never overwrite.** A different value for a field that is already filled goes to Review for a person to decide, unless a learned rule (next) already covers that kind of conflict.
- **Learn from how the team decides.** When people have settled the same kind of Review item the same way three times in a row (same field, same competing source, same choice, none reversed), write it down as a rule in the CRM Room's guideline with links to those decisions and today's date. From then on apply it yourself and say on the record which rule you followed. A new kind of conflict, and anything about money, ownership or who decides, still goes to Review. If anyone decides differently once, drop the rule and send that kind back to Review. Where each kind of rule is written, and the weekly card that shows them, is in `how-it-learns.md`.
- **Read the current record list, not an old one.** Batch work starts from the CRM's current paginated list. A record that comes back deleted or archived is dropped from the run and not retried. A field you do not recognise is checked against the App's contract (`app docs`), never guessed from a similar name.
- **Status comes from the system that owns it.** Paying, trial, cancelled and churned come from billing (Stripe or the billing App), not from analytics events. Analytics shows behaviour. "Churned" means paid before and cancelled now; "trial ended, never paid" is a different group.
- **Check data coverage before comparing history.** Analytics events often start partway through the year or change definition. A drop that lines up with a tracking change is not customer behaviour. Say what the data covers.

## Research on people and companies

- **Follow every trail to the end.** A found website or handle is where research starts: open the site and its About page, the linked LinkedIn, X and GitHub, recent posts. Write company, role, team size, products, location and anything that shows fit, each with its source link.
- **A name plus a region is only a candidate.** Never write someone's job or employer unless an email domain, their own site or a directly linked profile confirms it. Never write a location from a sign-up IP. Unconfirmed goes in as "to verify".
- **Background found later goes in the same turn.** When a thread reveals a company or role, update the record right away.
- **New records get background the same day,** starting from what the workspace already knows (other Apps, earlier threads, research notes).

## Attribution

- **Check our own contact first.** Before saying how someone signed up, booked or paid, search the connected mailboxes, the CRM and workspace history for earlier contact. Analytics only sees tagged clicks. Say "no tracked link", never "nobody contacted them", when only analytics was checked.
- **Separate the cause from the click.** "A teammate emailed them a coupon" and "they booked through the in-product button" can both be true.

## Email to customers

- **Drafts, not sends.** Every customer email is a Draft Card from the right person's mailbox; a person reviews and sends it. Automations prepare drafts; they do not send unless the team explicitly sets up a reviewed send flow.
- **In the customer's own thread.** Draft Cards appear in the conversation where the drafting turn runs. Draft only from a turn running in that customer's record thread. An Automation running in a room's main chat schedules a follow-up turn in the record thread instead.
- **Reply in the existing email thread** with the guest when there is one, from the mailbox of whoever owns the relationship or ran the meeting, with their usual signature.
- **Short, like a personal note.** Do not quote the customer's usage, plan, renewal or payment details back to them ("I noticed you..."). Fix transcription errors in names and products; do not guess unclear names.
- **Open questions first.** While a decision about a draft is still open, put it as the first line of every revision until it is answered. If someone sends anyway, tell the affected owner the same turn.
- **Every automated email is logged** to the customer's thread with what was actually sent and its real status (`email-log.md`).

## Automations

- **Deterministic code for known reads.** API calls, pagination, joins, de-duplication and writes run in saved code. Judgement over fetched material (summaries, classification) is one tool-free model call whose output the code validates.
- **No agent sub-steps inside saved Automation code.** A delegated sub-agent's reply can surface as a raw message in the Room and the code gets nothing back. Keep it to code plus tool-free model calls.
- **Post once, never delete.** A message an Automation posts to a real Room is posted once. Fix the code for next time rather than deleting and reposting.
- **Cards carry what the reader needs.** A booking or form card shows who, when, which company, why they came and the one next step. No internal terms, no process logs, nothing truncated.
- **When an upstream stops, say so.** If a source is paused or disconnected, the reports that depend on it say it and stop, instead of reporting zeros.
- **Each person's access stays theirs.** A personal mailbox or calendar sync runs under its owner's delegation. Never grant a personal connection to an App or to the agent to save a step.

## Working with people

- Ask through cards with concrete options and one recommendation. Ask one good question rather than three vague ones.
- When a task is blocked on access, tell the person who asked what is blocked and whether there is a version that does not need it. Bring in other people only when they agree.
- Continue existing work in its original thread. Open a new thread only for a new topic.
