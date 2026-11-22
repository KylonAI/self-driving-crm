# Kylon CRM kit

How the Kylon team runs its customer CRM and email intake inside [Kylon](https://kylon.io), packaged as Skills an Agent can follow to build the same thing for your business.

You upload the Skills to your Kylon workspace and ask your Agent to set up a CRM. The Agent interviews you, looks at which tools you actually use (only with your OK), writes a design for you to approve, and only then builds the CRM App and connects your mail, calendar, forms, booking pages, meeting notes and analytics to it.

![CRM home with made-up demo data](docs/screenshots/01-home.png)

## What's inside

| Folder | What it is |
| --- | --- |
| `skills/install-crm/` | The setup playbook in four phases: ask, look, design, build. Nothing is built before you approve the design. |
| `skills/crm-template-source/` | Source of the blank CRM App: people, companies, accounts, deals, meetings, follow-ups, lists, insights, a Review page and a Data sources page. Every sync writes through one intake API. Starts with an empty database. |
| `skills/install-email/` | The email setup playbook: personal inboxes, Agent mailboxes, shared addresses like sales@, one thread per client, and a person clicks send on every email. Builds on install-crm. |
| `skills/crm-practice/` | Our operating rules plus ready-to-adapt Automation templates for each data source: Gmail and Outlook sync, calendar, booking pages, website forms, meeting recap follow-ups, a daily sign-up digest, an email log per customer, PostHog, Microsoft Clarity and a daily data check. |
| `docs/` | Architecture pages for the CRM and for email, a visual guide (HTML and PDF) and screenshots. All people, companies and email addresses in them are made up. |

## Get started

1. Download this repository.
2. In your Kylon workspace, add the folders under `skills/` as workspace skills. Start with `install-crm` and `crm-template-source`; add `install-email` and `crm-practice` when you get to email and data sources.
3. In the Room where the CRM should live, ask your Agent: "Set up a CRM for us with the install-crm skill."
4. Answer its questions on the cards and review the design. Nothing is built, connected or imported before you approve.

Open `docs/crm-visual-guide.html` in a browser first if you want to see where you will end up.

## Ground rules the Skills follow

- **One write door.** Every sync and import writes through the CRM's `POST /api/intake`, so matching, de-duplication and Review keep working.
- **Each person's account stays theirs.** Personal mailboxes and calendars are connected by their owner and read under that owner's access.
- **Drafts, not sends.** Agents draft customer email as Draft Cards. A person reads and clicks send.
- **Nothing moves without a yes.** Every import, Automation and connection is shown, rehearsed and approved first.

## Status

What has been used for real, and what has not:

| Part | Status |
| --- | --- |
| `install-crm` with `crm-template-source` | Used by a partner team to set up their own CRM. |
| `install-email` | Preview. Gmail and Microsoft 365 connect directly. Hosted IMAP mail (forwarding to an Agent mailbox) and support tools without a connector (webhook) are untested; the Skill proves each with one test message before relying on it. |
| `crm-practice` Automation templates | Pass a strict TypeScript check. None has run against a fresh CRM yet, so every template tells the Agent to rehearse on your real data, writing nothing, before it is saved. |

## Contributing

Issues and pull requests are welcome. Keep demo data synthetic (`example.com` style addresses, made-up companies) and never commit customer data, keys or workspace IDs.

## License

[MIT](LICENSE)
