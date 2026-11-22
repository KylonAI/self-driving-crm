# Interview and approval cards

Every question in this skill is asked with a Kylon card (`ui send`), never as a numbered list in a chat message. One card per round, a short markdown lead-in above the fields, concrete options the person can click, a recommendation in the option description, and one button that submits. The card's built-in Other answer covers anything not listed, so never add an Other option or a separate free-text box for it. Use a textarea only for answers that cannot be listed.

Before sending a round, prefill (`defaultValue`) anything you already know from the conversation, the workspace or the company website, so the person only confirms. Skip a question whose answer is already certain. After each submission, reply with one line that plays back what you understood, then send the next card.

Send each card with `ui send --fallback-text "<one-line summary of the questions>" --blocks-file <blocks.json> --actions-file <actions.json>`. When the previous card is still open, add `--replaces <its message id>`.

## Round 1 · Business and team (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Let's set up your CRM.** A few quick questions about the business first. Pick what fits; use Other for anything not listed."
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "crm_type",
    "options": [
     {
      "label": "Client services / agency",
      "value": "services",
      "description": "Projects or events delivered for clients"
     },
     {
      "label": "B2B sales",
      "value": "b2b",
      "description": "Selling a product or subscription to companies"
     },
     {
      "label": "Partnerships",
      "value": "partners"
     },
     {
      "label": "VC / investing",
      "value": "vc"
     },
     {
      "label": "Recruiting",
      "value": "recruiting"
     }
    ]
   },
   {
    "type": "textarea",
    "fieldId": "what_you_sell",
    "placeholder": "One or two lines: what you sell and to whom",
    "maxLength": 500,
    "minRows": 2
   },
   {
    "type": "radio_group",
    "fieldId": "brands",
    "options": [
     {
      "label": "One company",
      "value": "one"
     },
     {
      "label": "Several brands that share clients or staff",
      "value": "shared",
      "description": "One CRM with a brand field"
     },
     {
      "label": "Several separate businesses",
      "value": "separate",
      "description": "Usually one CRM per business"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "lead_sources",
    "options": [
     {
      "label": "Website or inbound form",
      "value": "inbound"
     },
     {
      "label": "Referrals",
      "value": "referral"
     },
     {
      "label": "Outbound",
      "value": "outbound"
     },
     {
      "label": "Marketplace or platform",
      "value": "marketplace"
     },
     {
      "label": "Events",
      "value": "events"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "team_size",
    "options": [
     {
      "label": "1 to 5",
      "value": "1-5"
     },
     {
      "label": "6 to 20",
      "value": "6-20"
     },
     {
      "label": "21 to 50",
      "value": "21-50"
     },
     {
      "label": "More than 50",
      "value": "50+"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "client_roles",
    "options": [
     {
      "label": "Sales",
      "value": "sales"
     },
     {
      "label": "Account management",
      "value": "am"
     },
     {
      "label": "Production or delivery",
      "value": "delivery"
     },
     {
      "label": "Support",
      "value": "support"
     },
     {
      "label": "Founders only",
      "value": "founders"
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
  "actionId": "round1_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Round 2 · Current tools (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Which tools do you use today?** This tells us what the CRM should connect to. Next we can confirm it from your inbox, with your OK."
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "radio_group",
    "fieldId": "email_provider",
    "options": [
     {
      "label": "Google Workspace (Gmail)",
      "value": "google"
     },
     {
      "label": "Microsoft 365 (Outlook)",
      "value": "microsoft"
     },
     {
      "label": "Hosted IMAP mail (IONOS, GoDaddy, Zoho Mail and similar)",
      "value": "imap",
      "description": "Works, but some features need extra setup"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "existing_crm",
    "options": [
     {
      "label": "None yet",
      "value": "none"
     },
     {
      "label": "HubSpot",
      "value": "hubspot"
     },
     {
      "label": "Salesforce",
      "value": "salesforce"
     },
     {
      "label": "Pipedrive",
      "value": "pipedrive"
     },
     {
      "label": "A spreadsheet, Airtable or Notion",
      "value": "sheet"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "calendar_booking",
    "options": [
     {
      "label": "Google Calendar",
      "value": "gcal"
     },
     {
      "label": "Outlook Calendar",
      "value": "outlook_cal"
     },
     {
      "label": "Calendly",
      "value": "calendly"
     },
     {
      "label": "Cal.com",
      "value": "calcom"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "meeting_notes",
    "options": [
     {
      "label": "Read AI",
      "value": "readai"
     },
     {
      "label": "Fireflies",
      "value": "fireflies"
     },
     {
      "label": "Otter",
      "value": "otter"
     },
     {
      "label": "Fathom",
      "value": "fathom"
     },
     {
      "label": "No notetaker",
      "value": "none"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "support_billing",
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
      "label": "Stripe",
      "value": "stripe"
     },
     {
      "label": "QuickBooks or Xero",
      "value": "accounting"
     }
    ]
   },
   {
    "type": "checkbox_group",
    "fieldId": "team_chat",
    "options": [
     {
      "label": "Slack",
      "value": "slack"
     },
     {
      "label": "Google Chat",
      "value": "gchat"
     },
     {
      "label": "Microsoft Teams",
      "value": "teams"
     },
     {
      "label": "WhatsApp",
      "value": "whatsapp"
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
  "actionId": "round2_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Round 3 · Pains and limits (step 1)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Last round: what should the CRM fix, and what are the limits?**"
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "checkbox_group",
    "fieldId": "pains",
    "options": [
     {
      "label": "Replies get missed",
      "value": "missed_replies"
     },
     {
      "label": "No history of what was said to a client",
      "value": "no_history"
     },
     {
      "label": "Unclear who owns a client",
      "value": "no_owner"
     },
     {
      "label": "Handoff from sales to delivery loses context",
      "value": "handoff"
     },
     {
      "label": "No view of the pipeline or campaigns",
      "value": "no_pipeline"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "admin_visibility",
    "options": [
     {
      "label": "Admins see client conversations only",
      "value": "client_only",
      "description": "Recommended: personal mail never enters the CRM"
     },
     {
      "label": "Admins see everything synced",
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
    "fieldId": "email_storage",
    "options": [
     {
      "label": "Subject, snippet and a link back",
      "value": "snippet",
      "description": "Recommended: enough to work from, little private text stored"
     },
     {
      "label": "Full email bodies",
      "value": "full"
     },
     {
      "label": "Metadata only (who, when)",
      "value": "meta"
     }
    ]
   },
   {
    "type": "radio_group",
    "fieldId": "history",
    "options": [
     {
      "label": "Last 30 days",
      "value": "30"
     },
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
  "actionId": "round3_submit",
  "label": "Next",
  "style": "primary"
 }
]
```

## Mailbox scan permission (step 2)

Blocks:

```json
[
 {
  "type": "markdown",
  "content": "**Can I look at your inbox to see which tools you run on?** I read sender, recipient, subject and date only for the period you pick, never message bodies or attachments, and I delete the raw list once we agree on the tools. You sign in with your own account; nobody else gets access."
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
      "label": "Yes, mine and the shared client inbox",
      "value": "mine_shared"
     },
     {
      "label": "Not now",
      "value": "no",
      "description": "I will work from your answers only"
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
     },
     {
      "label": "Last 12 months",
      "value": "365"
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
  "actionId": "scan_submit",
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
  "content": "**Here is the proposed design for your CRM.** Nothing is built, connected or imported until you approve it."
 },
 {
  "type": "item",
  "presentation": "html_preview",
  "title": "CRM architecture design",
  "link": "/preview/workspaces/<workspaceId>/files/<fileId>"
 },
 {
  "type": "field_group",
  "fields": [
   {
    "type": "textarea",
    "fieldId": "design_changes",
    "placeholder": "Changes you want (only if you pick Approve with changes)",
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
  "actionId": "design_approve",
  "label": "Approve as is",
  "style": "primary"
 },
 {
  "type": "button",
  "actionId": "design_approve_changes",
  "label": "Approve with changes"
 },
 {
  "type": "button",
  "actionId": "design_not_yet",
  "label": "Not yet"
 }
]
```

The same pattern applies to the other choices in this skill: the migration plan (step 6), what to import from the workspace (step 7) and which sources to connect (step 8) are each one card with one option per plan or source, the recommended one described as such.
