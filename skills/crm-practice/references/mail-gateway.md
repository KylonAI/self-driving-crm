# Company-wide mail capture (the alternative to per-person mailbox sync)

One rule in the company's mail system copies every email with an outside party to a Kylon agent's own mailbox. One reader Automation turns those copies into CRM activities and then deletes them. Nobody on the team has to connect their own mailbox, and mail that teammates send from their own accounts is covered too.

Code template: `code/automations/mail-gateway-reader.ts`. Flow: `diagrams/mail-gateway.md`.

## When to offer it

- The team has more than a few people, or people keep forgetting to connect their mailboxes.
- Customer mail is spread across shared addresses (hello@, sales@, support@) and personal inboxes, so one person's mailbox never shows the whole conversation.
- Someone with admin rights on Google Workspace or Microsoft 365 will approve it.

Do not offer it as a silent default. It reads company mail; the admin approves it and the team is told before it is switched on (draft the note for the admin, see "Tell the team" below).

## What it covers and what it does not

- Covers mail that passes through the company's mail system from the moment the rule is saved: inbound to any teammate or group, and outbound from any teammate.
- Does not cover history before the rule. For history, use per-person sync with a backfill window, or a one-time import by an admin (Google Workspace needs domain-wide delegation from a super admin; Vault is not included on the smaller plans).
- Does not see mail sent from other tools (a support desk, a marketing tool, a scheduler) unless those tools send through the company's mail system.
- Only subject and a one-sentence summary land in the CRM. Full bodies stay in the mailboxes they came from, and the copies are deleted once handled.

## Setup

### 1. A Kylon agent with its own address

Create a private agent for this job only (for example "Mail capture"), visible to the admin and the setup agent, not the whole workspace. Request its address with `email address request <name>`; a person who manages it approves it. Use the agent's address as the copy destination. Do not use the workspace's default agent: anyone who can talk to it could ask it to search raw mail.

### 2. The routing rule

**Google Workspace.** Admin console › Apps › Google Workspace › Gmail › **Routing** (not "Default routing", which handles inbound only). Add a rule at the top organisational unit ([Google's guide](https://knowledge.workspace.google.com/admin/gmail/advanced/add-gmail-routing-settings)):

- Messages to affect: **Inbound** and **Outbound** (leave Internal-sending and Internal-receiving off: internal mail is not customer mail).
- Account types: users and groups.
- Action: Modify message › **Add more recipients** › Advanced › the capture agent's address.
- Leave "Change envelope recipient", "Remove attachments" and envelope filters off.
- Decide on spam with the team. Consider turning off "Do not deliver spam to this recipient": real customer mail sometimes lands in spam, and the reader drops spam from strangers on its own.
- Save the rule. Rule changes can take up to 24 hours. Check delivery in Admin › Reporting › **Email log search** with the capture address as recipient ([Google's guide](https://knowledge.workspace.google.com/admin/support/troubleshooting/find-messages-with-email-log-search)): no rows means the rule never fired.

**Microsoft 365.** Exchange admin center › Mail flow › **Rules** › Add a rule:

- Apply this rule if: the recipient is located outside the organisation (outbound). Add a second rule for the sender is located outside the organisation (inbound).
- Do the following: **Add recipients › to the Bcc box** (shown as "Bcc the message to") › the capture agent's address. This adds a copy and leaves normal delivery alone ([Microsoft Q&A](https://learn.microsoft.com/en-nz/answers/questions/5974808/help-on-creating-mailbox-rule-or-transport-rule), [second example](https://learn.microsoft.com/en-us/answers/questions/5759471/assistance-on-transport-rule)).
- Set the rule to Enforce. New rules can take a while to apply across the tenant.
- The capture address is outside the tenant. Check with one test email in each direction that the copy arrives; some tenants restrict copies to outside addresses, and the admin may need to allow this one.

### 3. Test both directions before building anything

1. Someone writes from a personal address to a teammate's work address. The capture mailbox should get a copy within minutes.
2. A teammate writes from their work address to an outside address (not to the capture address). The capture mailbox should get that copy too.
3. Ask the capture agent for counts only (how many copies arrived since the test, from which sender domains). Do not have it open the mail for the test.

Two common pitfalls: a rule that was never actually saved, so nothing arrives; check the rule exists after saving. And a Bcc copy's "To" can show only the capture address if the mail system rewrites the envelope; check that outbound copies still show the real outside recipient before you rely on them, because without it outbound mail cannot be matched to a customer.

### 4. The reader Automation

Fill the placeholders in `mail-gateway-reader.ts`, rehearse it once on the real copies with the CRM writes switched to a dry run (print what it would write; write nothing; trash nothing), show the counts to the admin, and save it only after they accept. Then:

- Schedule every 30 minutes, off the hour (`17,47 * * * *`).
- It must **run as the capture agent**: only that agent can read its own mailbox. Create the Automation, then transfer it to the capture agent (`workflow transfer --to-agent <id>`) in a turn where the admin is present.
- First scheduled run: read its result and the CRM's **Settings › Data sources** row before calling it live.

What it does each run:

1. Lists the mailbox and handles up to 150 copies, oldest first.
2. One email often arrives as several copies (one per teammate it touched). It keys on the Message-ID and handles each email once.
3. Drops by rule, with no model call: automated senders (no-reply, notifications, bounces), internal-only mail, and staff writing from personal addresses.
4. Writes mail with people already in the CRM, with a one-sentence summary.
5. Sorts strangers with one tool-free model call: customer (including new leads) or partner is written; everything else is dropped; "unsure" is kept and listed once for a person to decide.
6. Trashes every finished copy, keeps held ones, and updates the Data sources row.

## Tell the team

Before the rule is switched on, the admin sends a short note: from today, a copy of every email with an outside party goes to the CRM's mail capture; only who, when, the subject and one sentence reach the CRM; copies are deleted after processing; personal mail from personal addresses is not captured. Name who to ask with questions.

## Partners and other mail

Ask in setup whether partners live in this CRM. If they do, set `PARTNERS_IN_CRM` to true and partner mail is written with the company marked as a partner. If partners are tracked elsewhere, partner mail is dropped here, and a separate partner tool can read the same copies first. Vendors, recruiters, investors, creators and sponsorships, events and newsletters are never written to the CRM.
