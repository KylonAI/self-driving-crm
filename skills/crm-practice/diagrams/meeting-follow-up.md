# After every customer meeting: notes, to-dos and a follow-up Draft Card. Nothing is sent automatically.

Rendered: `meeting-follow-up.png`. Paste the block below into any Mermaid viewer, or into a Kylon message, to edit it.

```mermaid
flowchart TB
  A["Every 15 minutes"] --> B["Meetings that ended<br/>1 to 48 hours ago"]
  A --> C["Recent recaps from every<br/>note-taker connection"]
  C --> C1{"Every note taker<br/>unreachable?"}
  C1 -- yes --> SKIP["Skip this run<br/>(never write 'not found')"]
  B --> D{"Recap matches?<br/>guest email + start<br/>within 2 hours"}
  C1 -- no --> D
  D -- no, 2h+ after end --> P["Ping the host once<br/>in the guest's thread"]
  D -- yes --> E["One model call:<br/>facts, to-dos, unclear points,<br/>suggested stage, email"]
  E --> F{"Valid JSON?"}
  F -- no --> RETRY["Retry once, then<br/>report as failed"]
  F -- yes --> G["POST /api/intake:<br/>recap activity + to-dos<br/>owned by team members"]
  G --> H["Post notes in the guest's<br/>record thread, mention the host"]
  H --> I["Schedule a one-shot turn<br/>in that thread, due in 1 minute"]
  I --> J["Turn creates an email Draft Card<br/>from the host's mailbox,<br/>replying in their latest thread"]
  J --> K["Host reviews and sends"]
  J -. no access in this turn .-> L["Ask the host to reply here;<br/>their reply starts a turn<br/>with their access"]
```
