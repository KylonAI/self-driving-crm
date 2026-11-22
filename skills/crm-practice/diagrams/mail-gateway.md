# Company-wide mail capture: one admin rule copies every external email to a Kylon agent's address.

Rendered: `mail-gateway.png`. Paste the block below into any Mermaid viewer, or into a Kylon message, to edit it.

```mermaid
flowchart LR
  subgraph Mail["Company mail system"]
    direction TB
    IN["Inbound mail to any<br/>teammate or group"]
    OUT["Outbound mail from<br/>any teammate"]
    RULE["Admin rule<br/>Google: Routing, Add more recipients<br/>Microsoft 365: mail flow rule, Bcc"]
    IN --> RULE
    OUT --> RULE
  end
  RULE -- a copy --> BOX["Capture agent's<br/>Kylon mailbox"]
  BOX --> R["Reader Automation<br/>every 30 minutes,<br/>runs as the capture agent"]
  R --> K{"Same Message-ID<br/>already done?"}
  K -- yes --> TR["Trash the copy"]
  K -- no --> RU{"Machine, internal,<br/>staff personal?"}
  RU -- yes --> TR
  RU -- no --> KN{"Party already<br/>in the CRM?"}
  KN -- yes --> W["POST /api/intake<br/>email activity: subject +<br/>one-sentence summary"]
  KN -- no --> AI{"Model sorts the stranger"}
  AI -- customer / partner --> W
  AI -- other --> TR
  AI -- unsure --> HOLD["Keep the copy; list it once<br/>for a person to decide"]
  W --> TR
```
