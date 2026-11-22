---
name: install-email
description: Design, then set up, a team's email system in Kylon so every client email is captured into the CRM, each client's mail lands in that client's one thread, Agents draft replies and a person always clicks send. Works in a fixed order with clickable cards: interview the person about mailboxes, providers, shared inboxes, support tool and privacy; with the owner's OK read mailbox headers to see which addresses and tools carry client mail; write an email architecture design (mailboxes, how each reaches Kylon, capture into the CRM, threads, sending, history import, privacy) and get it verified; only then connect inboxes, set up Agent mailboxes and forwarding, import history and turn on capture. Use with the install-crm skill (it provides the CRM and its intake). Use when someone wants email in Kylon, asks how to capture team email into the CRM, uses Gmail, Microsoft 365 or a hosted IMAP provider such as IONOS, wants Agent email addresses, wants old email imported, or wants a support inbox such as Chatwoot to land in the same CRM.
human_description: Guides an Agent through designing your email setup with you, getting your sign-off, then connecting inboxes, Agent mailboxes and history so client email flows into your CRM.
---

# Install email

Email in Kylon has three kinds of mailbox and one rule. The kinds: **personal inboxes** people connect themselves, **Agent mailboxes** an Agent owns, and **shared role inboxes** (sales@, info@) that reach Kylon through one of the first two. The rule: Agents read, file and draft; a person reads every outbound email and clicks send.

This skill runs in four phases, **ask, look, design, build**, the same as install-crm. Nothing is connected, forwarded or imported until the person approves the design.

## Ground rules

- **Design before build.** Steps 1 to 4 only ask, read headers and write a design. No connection, Agent address, forwarding rule, Automation or import before the person approves the design in step 4.
- **Ask with cards.** Every question goes out as a Kylon card (`ui send`) with clickable options and a recommended one; ready-made cards are in `references/interview-cards.md`. Never post a list of questions in chat.
- **Each person's own access.** A personal inbox is connected and read only under its owner's own access. Never grant a personal connection to an App or to yourself, and never read one person's mail with another person's access.
- **One door into the CRM.** Captured mail is written through the CRM's `POST /api/intake` (install-crm `references/intake.md`), keyed on the provider message id so re-runs create nothing twice.
- **Draft first.** Outbound email is always a Draft Card from the right mailbox, in the client's thread. Never send on your own, and never bypass a draft card by signing in to a provider in a browser.
- **Be honest about support.** Gmail and Microsoft 365 connect directly. Hosted IMAP providers (IONOS and similar) and support tools without a connector (Chatwoot and similar) go through forwarding or a webhook; mark those parts as "not yet tested in your workspace" in the design and prove them with one test message before relying on them.
- **Large files go as links.** Many providers reject attachments that contain scripts or archives; share files as download links.

## Phase 1 · Ask

### 1. Interview

Three card rounds from `references/interview-cards.md`; play each submission back in one line before the next:

1. **Mailboxes:** email provider per brand or company, who has a mailbox, which shared addresses exist (sales@, info@, support@) and who answers them, whether Agents should have their own addresses.
2. **Tools around mail:** existing CRM, support desk (Chatwoot, Intercom, Zendesk), booking tool, newsletter tool, and whether email should replace team chat for anything.
3. **Limits:** what an admin may see, what is never stored (bodies, attachments, personal threads), how much history to import, and who approves outbound mail.

Write a short brief file with the answers.

## Phase 2 · Look

### 2. Read mailbox headers

With each owner's OK (permission card in `references/interview-cards.md`), and under their own connection, read **headers only** for the agreed period: which addresses send and receive client mail, which tools send notifications, which shared addresses forward where. Procedure and what never to keep: install-crm `references/mailbox-scan.md`. Where a provider has no connector (IMAP hosts), ask the person for a short export of folder names and a few sender domains instead, or skip and note what that may miss.

## Phase 3 · Design

### 3. Write the email design

Follow `references/email-design.md`; `docs/kylon-email-architecture.html` in this package is a worked example. Pick each mailbox's route from `references/provider-routes.md`. Use made-up data in any example.

### 4. Get it verified

Upload the design page and send the design approval card (Approve as is / Approve with changes / Not yet). Record the approval in the brief with the date. Changes after approval come back here.

## Phase 4 · Build

Only what the approved design lists, in this order:

5. **Agent mailboxes.** For each Agent that needs an address, request it (`email address request <name>`); a person who manages the Agent approves it. Set up delivery so new mail reaches the Room the design names. See `references/agent-mailboxes.md`.
6. **Personal inboxes.** Each owner connects Gmail or Outlook in their own turn (`connection create --toolkit gmail|outlook`), then you create their capture Automation into the CRM (install-crm `references/sync-gmail.md`; for Outlook use the same template with the Outlook fetch tool found by `connection tool search --toolkit outlook --query "list messages"`).
7. **Forwarded inboxes** (IMAP hosts, shared role addresses). The address owner sets a forwarding or auto-BCC rule in their provider to the Agent mailbox the design names. Send one test message, confirm it arrived and was filed to the right client thread, then report. See `references/provider-routes.md`.
8. **Support tool.** If the design includes one without a connector, create an inbound webhook for the CRM Room (`connection webhook create`); the person pastes its URL into the tool's webhook settings; confirm one test conversation lands in the right client thread. See `references/support-webhook.md`.
9. **History import.** Per `references/history-import.md`: a 20-message trial, the person's go, then the rest in batches through the intake.
10. **Wrap up.** A checklist card: each mailbox, its route, who connected it, first captured message, history counts, anything still untested. Point to the CRM's data sources page for ongoing status.

## When something stops

Check the capture Automation's recent runs and the CRM data sources page. An expired sign-in needs the owner to reconnect in their own turn. Forwarded mail that stops arriving usually means the provider rule was changed or the forwarding address bounced: ask the owner to check the rule and send a test message.
