# Architecture design: what the person signs off before anything is built

One page, written for the business owner, not for engineers. Use their words for stages and objects. A worked example is `docs/kylon-crm-architecture.html` in this package. Any screenshot or mockup uses made-up data, never real clients.

## Sections

1. **Summary.** One paragraph: what the CRM will hold, where people will work, and the one rule that matters most to them (for example "every client has one thread; nothing is sent without a person").
2. **Data sources.** A diagram and a table: source, the account it comes from, owner, personal or team, what it adds (timeline, meeting notes, billing state, support tickets). Mark sources from the interview, from the mailbox scan, or both.
3. **Data structure.** The entities and how they link (company, person, client account, deal, activity, review item, plus custom objects like campaigns or events). Key fields per entity, the pipeline stages, and who owns a record.
4. **Sync.** Per source: trigger (schedule, webhook, Agent in a thread), frequency, scope (which mail or meetings, backfill length, skip list, whether bodies are stored), and the matching rule (exact email, domain or record id; uncertain matches go to Review). All writes go through the intake.
5. **One client, one thread.** Which record holds each client's thread; how a new event finds it; what happens when a prospect becomes a client or a deal closes (the stage changes, the thread stays).
6. **How it maps onto Kylon.** A table: CRM idea, Kylon building block, how it works here. Cover Rooms (split by kind of work), the CRM App and its entities, record threads, Connections, Automations, the Agent that runs the Room, Skills it uses, workspace members as owners, and Draft Cards for outbound email.
7. **Migration plan** when there is an existing CRM or sheet: what moves, what stays, field and stage mapping, de-duplication rule.
8. **Privacy.** What an admin can see, what teammates can see of each other's mail, what is never stored.
9. **Open questions and out of scope.**

## Format

- An HTML page with diagrams (Mermaid is fine) and short tables; under about 1,500 words.
- End with the approval card: Approve as is / Approve with changes / Not yet.
- Save the approved version next to the brief, with the date and who approved.
