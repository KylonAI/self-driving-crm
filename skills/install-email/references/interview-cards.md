# Interview and approval cards

Ask every question with a card (`ui send --fallback-text "<summary>" --blocks-file <blocks.json> --actions-file <actions.json>`), one card per round, with a markdown lead-in, clickable options, the recommended option described as such, and one submit button. The built-in Other answer covers anything not listed; never add your own Other option. Prefill (`defaultValue`) what you already know, for example from the install-crm brief. After each submission, play back what you understood in one line, then send the next card.

## Round 1 · Mailboxes (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Let's set up email.** First, where your mail lives today. Pick what fits; use Other for anything not listed."
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "provider",
    "options": [
     {
      "label": "Google Workspace (Gmail)",
      "value": "google",
      "description": "Connects directly"
     },
     {
      "label": "Microsoft 365 (Outlook)",
      "value": "microsoft",
      "description": "Connects directly"
     },
     {
      "label": "Hosted IMAP mail (IONOS, GoDaddy, Zoho Mail and similar)",
      "value": "imap",
      "description": "Reaches Kylon by forwarding; tested with one message first"
     },
     {
      "label": "Different providers per brand",
      "value": "mixed"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "shared_addresses",
    "options": [
     {
      "label": "sales@ or hello@",
      "value": "sales"
     },
     {
      "label": "info@",
      "value": "info"
     },
     {
      "label": "support@",
      "value": "support"
     },
     {
      "label": "billing@ or accounts@",
      "value": "billing"
     },
     {
      "label": "No shared addresses",
      "value": "none"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "agent_addresses",
    "options": [
     {
      "label": "Yes, an Agent address per team or brand",
      "value": "per_team",
      "description": "Recommended: Agents receive forwarded mail and draft replies"
     },
     {
      "label": "One Agent address for everything",
      "value": "one"
     },
     {
      "label": "No Agent addresses",
      "value": "none"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "who_has_mailbox",
    "options": [
     {
      "label": "Everyone who talks to clients",
      "value": "all"
     },
     {
      "label": "Only founders and sales",
      "value": "some"
     },
     {
      "label": "Mostly shared addresses",
      "value": "shared"
     }
    ]
   }
  ]
 }
]
```

Actions:

```json
[
 {
  "type": "button",
  "actionId": "email_round1_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Round 2 · Tools around mail (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Which tools sit around your email?**"
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "crm",
    "options": [
     {
      "label": "Kylon CRM (installed or planned)",
      "value": "kylon",
      "description": "Recommended: captured mail lands here"
     },
     {
      "label": "HubSpot",
      "value": "hubspot"
     },
     {
      "label": "Another CRM",
      "value": "other_crm"
     },
     {
      "label": "None yet",
      "value": "none"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "support_tool",
    "options": [
     {
      "label": "Chatwoot",
      "value": "chatwoot"
     },
     {
      "label": "Intercom",
      "value": "intercom"
     },
     {
      "label": "Zendesk",
      "value": "zendesk"
     },
     {
      "label": "Help Scout",
      "value": "helpscout"
     },
     {
      "label": "No support tool",
      "value": "none"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "other_tools",
    "options": [
     {
      "label": "Calendly or Cal.com bookings",
      "value": "booking"
     },
     {
      "label": "Newsletter tool",
      "value": "newsletter"
     },
     {
      "label": "Invoicing tool",
      "value": "invoicing"
     },
     {
      "label": "Contract signing",
      "value": "contracts"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "replace_chat",
    "options": [
     {
      "label": "Yes, move internal email and chat into Kylon",
      "value": "yes"
     },
     {
      "label": "Keep internal chat where it is for now",
      "value": "no"
     }
    ]
   }
  ]
 }
]
```

Actions:

```json
[
 {
  "type": "button",
  "actionId": "email_round2_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Round 3 · Limits (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Last round: privacy and history.**"
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "admin_visibility",
    "options": [
     {
      "label": "Admins see client conversations only",
      "value": "client_only",
      "description": "Recommended: personal mail never enters Kylon"
     },
     {
      "label": "Admins see all captured mail",
      "value": "all"
     },
     {
      "label": "Each person sees only their own",
      "value": "own_only"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "storage",
    "options": [
     {
      "label": "Subject, snippet and a link back",
      "value": "snippet",
      "description": "Recommended"
     },
     {
      "label": "Full bodies",
      "value": "full"
     },
     {
      "label": "Who and when only",
      "value": "meta"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "history",
    "options": [
     {
      "label": "Last 90 days",
      "value": "90",
      "description": "Recommended for a first import"
     },
     {
      "label": "Last 12 months",
      "value": "365"
     },
     {
      "label": "Everything",
      "value": "all"
     },
     {
      "label": "No history",
      "value": "none"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "approver",
    "options": [
     {
      "label": "Whoever owns the mailbox",
      "value": "owner",
      "description": "Recommended"
     },
     {
      "label": "A manager for every outbound email",
      "value": "manager"
     },
     {
      "label": "The account manager of that client",
      "value": "am"
     }
    ]
   }
  ]
 }
]
```

Actions:

```json
[
 {
  "type": "button",
  "actionId": "email_round3_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Mailbox header scan permission (step 2)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Can I look at mailbox headers to see which addresses and tools carry client mail?** I read sender, recipient, subject and date only, never bodies or attachments, and delete the raw list once we agree. Each owner signs in with their own account."
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "scan_scope",
    "options": [
     {
      "label": "Yes, my mailbox",
      "value": "mine",
      "description": "Recommended"
     },
     {
      "label": "Mine and the shared client inboxes",
      "value": "mine_shared"
     },
     {
      "label": "Not now",
      "value": "no",
      "description": "I'll work from your answers"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "scan_period",
    "options": [
     {
      "label": "Last 30 days",
      "value": "30"
     },
     {
      "label": "Last 90 days",
      "value": "90",
      "description": "Recommended"
     }
    ]
   }
  ]
 }
]
```

Actions:

```json
[
 {
  "type": "button",
  "actionId": "email_scan_submit",
  "label": "Continue",
  "style": "primary"
 }
]
```

## Design approval (step 4)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Here is the proposed email design.** Nothing is connected, forwarded or imported until you approve it."
 },
 {
  "type": "item",
  "presentation": "html_preview",
  "title": "Email architecture design",
  "link": "/preview/workspaces/<workspaceId>/files/<fileId>"
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "textarea",
    "fieldId": "email_design_changes",
    "placeholder": "Changes you want (only for Approve with changes)",
    "maxLength": 3000,
    "minRows": 2
   }
  ]
 }
]
```

Actions:

```json
[
 {
  "type": "button",
  "actionId": "email_design_approve",
  "label": "Approve as is",
  "style": "primary"
 },
 {
  "type": "button",
  "actionId": "email_design_changes",
  "label": "Approve with changes"
 },
 {
  "type": "button",
  "actionId": "email_design_not_yet",
  "label": "Not yet"
 }
]
```
