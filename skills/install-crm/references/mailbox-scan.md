# Mailbox scan: find the integrations a business runs on

Goal: a list of the tools that send this business email, so the CRM design connects the systems they actually use. Read headers, not content.

## Before you start

- Ask the mailbox owner, in their own words, for permission: which mailbox, how far back (default 90 days), and that you will read sender, recipient, subject and date only.
- Use the owner's own connection (`connection list --toolkit gmail`, `outlook`, or an IMAP connection where the provider supports one). If none exists, `connection create` sends them the sign-in card. Never use another person's access and never grant the connection to yourself or an App.
- For a shared or role inbox (sales@, info@), the person who administers it gives the OK.

## What to read

- Message metadata for the period: From, To, Cc, Date, Subject, List-Id, and the sending domain. Page through the provider's list/search tool; do not fetch bodies or attachments.
- Optional narrow searches to confirm a tool: `from:(notifications@hubspot.com OR noreply@stripe.com)` and similar.

## How to classify

Group sending domains into tools, then into source kinds (see `sources.md`):

| Signal | Usually means |
|---|---|
| hubspot, salesforce, pipedrive, zoho, close, attio | an existing CRM to migrate or sync |
| stripe, chargebee, paddle, quickbooks, xero | billing |
| calendly, cal.com, acuityscheduling, google calendar invites | bookings and calendar |
| read.ai, fireflies, otter, tldv, fathom, zoom recordings | meeting notes |
| chatwoot, intercom, zendesk, freshdesk, helpscout | support desk |
| typeform, jotform, webflow, wordpress form plugins | inbound forms |
| slack, google chat, plane, linear, asana, monday | team chat and tasks (context, usually not CRM data) |
| docusign, pandadoc | contracts |
| mailchimp, beehiiv, substack, convertkit | newsletters and lists |

Also count the external domains people write to and hear from most: these are likely clients and partners, and they show which mailboxes carry client work.

## What to report

One table: tool, kind, what it seems to do for them, message count in the period, which mailboxes receive it. A second short list: top client domains by thread count (domains only, no names or subjects). Then ask which tools matter.

## What never to keep

- No message bodies, attachments or personal threads.
- Do not quote subjects that look personal, medical, legal or financial.
- Delete the raw header pull once the table is agreed; keep only the table in the brief.
