# Kylon CRM practice: how customer data reaches the CRM. Every write goes through POST /api/intake.

Rendered: `architecture.png`. Paste the block below into any Mermaid viewer, or into a Kylon message, to edit it.

```mermaid
flowchart LR
  S["<b>Sources</b><br/>Each person's Gmail or Outlook<br/>or one company-wide mail capture<br/>Each person's calendar<br/>Booking pages: Cal.com, Calendly<br/>Website forms<br/>Note-taker recaps<br/>PostHog: lead source, usage, sign-ups<br/>Old CRM or spreadsheet (one-time import)"]
  A["<b>Automations (saved code)</b><br/>Syncs: cursor + source_ref<br/>Webhooks: forms, bookings<br/>15-minute recap check<br/>Sign-up digest<br/>Daily CRM check"]
  I["<b>CRM intake</b><br/>POST /api/intake<br/>match people by email,<br/>companies by domain<br/>fill empty fields only<br/>conflicts go to Review<br/>each activity once"]
  D[("<b>CRM App</b><br/>People · Companies · Accounts<br/>Deals · Activities · Follow-ups<br/>Review · Data sources")]
  P["<b>Where people work</b><br/>One thread per customer record:<br/>cards, notes, logged emails<br/>Email Draft Cards from the<br/>host's own mailbox<br/>Review page: accept or dismiss"]
  S --> A --> I --> D --> P
  A -. "proposals, one-shot draft turns" .-> P
  C["<b>Microsoft Clarity</b><br/>page behaviour only,<br/>no person records"] --> R["Daily website card"]
  classDef box text-align:left
  class S,A,I,P,C box
```
