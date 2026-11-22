---
name: install-crm
description: Design, then install, a CRM in Kylon that becomes the team's single source of truth for customer data. Works in a fixed order. First interview the person about the business, team, clients and current tools. Then, with the owner's OK, read their mailbox headers to see which tools and integrations the business really runs on. Then write an architecture design (data sources, entities, sync, one thread per client, and how each part maps onto Kylon Rooms, Apps, Automations, Connections and Agents) and get the person to verify it. Only after that build the CRM from the template, migrate existing data, and connect each person's accounts, with one sync Automation per account writing through the CRM's intake. Use when someone wants a CRM in Kylon, installs or forks the CRM template, wants to move from HubSpot, Salesforce, Pipedrive, Affinity, Airtable or a spreadsheet, wants to connect Gmail, Calendar or a note taker, or asks why a data source is not syncing.
human_description: Guides an Agent through designing a CRM with you, getting your sign-off, then building it, bringing in existing data and connecting each person's accounts.
---

# Install CRM

The App is a plain CRM: tables, pages and one write door (`POST /api/intake`). This skill leads the person from a first conversation to a working CRM in four phases: **ask, look, design, build**. Nothing is built until the person has verified the design.

## Ground rules

- **Design before build.** Steps 1 to 4 only ask, read and write a design. No App, Automation, connection grant or import is created before the person approves the design in step 4.
- **One door.** Every sync, import and Automation writes customer data through `POST /api/intake` (see `references/intake.md`). Never write rows any other way, so matching, de-duplication and Review keep working.
- **Each person's own account.** Personal sources (mailboxes, calendars, note takers) are connected by their owner and read under that owner's own access. Never grant a personal connection to the App or to yourself, and never read one person's mailbox with another person's access.
- **Nothing moves without a yes.** Show what you plan to read, import or change and wait for the person's OK. Existing data stays where it is until they confirm the CRM has it.
- **Stay on topic.** When you look through mail or the workspace, mention only what touches customers and tools. Never quote private email content back.
- **Nothing outbound.** This skill never sends email, messages or posts to customers.
- **Ask with cards, never with a list of questions in chat.** Every question goes out as a Kylon card (`ui send`) with clickable options, a recommended option, and a submit button; ready-made cards are in `references/interview-cards.md`. Prefill what you already know. Keep each message short.

## Phase 1 · Ask

### 1. Interview the person first

Before reading anything, understand the business, in three short card rounds from `references/interview-cards.md` (send one, wait for the submission, play it back in one line, send the next):

1. **Business and team:** CRM type, what they sell and to whom, one company or several brands, where clients come from, team size, who touches clients.
2. **Current tools:** email provider (Google Workspace, Microsoft 365, hosted IMAP such as IONOS), existing CRM or sheet, calendar and booking, meeting notetaker, support and billing, team chat.
3. **Pains and limits:** what gets lost today, what an admin may see of each person's mail, how much of each email to store, how much history to bring in.

Ask about the client lifecycle (stages from first contact to delivered work and repeat business, and where handoffs happen) in the design step, where you can propose stages for them to correct instead of asking them to list them.

Write the answers into a short brief file and confirm it in one message.

## Phase 2 · Look

### 2. Read the mailbox to find the integrations

People forget half the tools they run on; their inbox does not. With the mailbox owner's explicit OK, and under their own connection, scan message **headers only** to see which systems send them mail. The full procedure, what to read and what never to keep, is in `references/mailbox-scan.md`.

Result: a table of tools found (tool, what it does for them, how many messages in the period, who receives them), grouped into the source kinds from `references/sources.md`, plus the client domains that appear most. Add the tools named in the interview that never showed up in mail, and the tools that showed up but were never mentioned. Ask the person which ones matter. Discard the raw header data once the table is agreed.

Ask for permission with the mailbox scan card in `references/interview-cards.md`. If the owner says no to a mailbox scan, skip it and work from the interview alone; say what that may miss.

## Phase 3 · Design

### 3. Write the architecture design

Turn the brief and the integration table into one design page the person can read in five minutes. Follow `references/architecture-design.md`; `docs/kylon-crm-architecture.html` in this package is a worked example. The design covers:

1. **Data sources:** each source, the account it comes from, who owns that account, personal or team.
2. **Data structure:** the entities (companies, people, accounts or clients, deals, activities, review items, plus any custom object such as campaigns or events), their key fields and how they link, with the pipeline stages.
3. **Sync:** for each source, how it reaches the intake (schedule, webhook, Agent in a thread), how often, what scope (default scope in step 9), and the matching rule (exact email, domain or id; never by name).
4. **One client, one thread:** which record holds each client's thread, and how events, drafts and recaps find it.
5. **Kylon mapping:** which Rooms, which App, which Automations, which Connections, which Agent runs it, which Skills it uses, and which workspace members own clients.
6. **Migration plan** if they have an existing CRM or sheet (analysis in `references/migration.md`).
7. **Open questions and what is out of scope.**

Use the person's own words for stages and objects. Use made-up example data in any screenshot or mockup, never real client data.

### 4. Get the design verified

Upload the design page and send the design approval card from `references/interview-cards.md` (a live preview of the page plus **Approve as is**, **Approve with changes**, **Not yet**). Revise and resend until approved. The approval message is the authorization for everything in Phase 4; record it in the brief file with the date. Anything that later changes the design (a new source, a different matching rule, a new Room) goes back through this step.

## Phase 4 · Build

### 5. Build the App

Use the crm-template-source skill to build the CRM App in the Room the design names, with an empty database. Then `PATCH /api/settings` with `{ "crm_type": "...", "org_name": "...", "installed": true }`, plus `deal_stages` from the approved design (ids are lower_snake_case and never change once deals use them). Read the settings back and confirm in one line.

### 6. Migrate an existing CRM or customer data (when the design includes it)

Skip this step when the design has no migration. Otherwise analyse first, propose, and move nothing until the person picks a plan. Details and the analysis checklist are in `references/migration.md`.

1. **Get read access.** Prefer an export file (CSV per object, or the tool's full export) the person attaches here, or the tool's connection when Kylon has one (`connection search`). For an App in this workspace, read it through its own API. Never ask for passwords.
2. **Analyse, read only.** For each object (companies, contacts, deals, activities, notes, tasks, custom objects): row counts, every field with how full it is and sample values, pipelines and stages, owners, how records link, duplicates (same email, same domain, same name), records with no email or domain, date range of the history, and attachments. Write it up as a short report file.
3. **Propose plans.** Send one card with two or three options, each with what moves, what does not, and the risk. Typical:
   - **Full move:** every object and its history; old tool goes read-only after a check.
   - **Active only:** open deals, customers and people touched in the last 12 months, plus their history; the rest stays in the old tool as an archive.
   - **Run side by side:** import once now, keep syncing from the old tool for a set period, then switch.
   With every plan show the field mapping (old field to CRM field, or "kept in notes"), the stage mapping into the stages in the approved design, how owners map to workspace members, the de-duplication rule, and anything that will not come over. Recommend one.
4. **Wait for the person's choice and any corrections.** Their OK is the authorization; without it, import nothing.
5. **Trial first.** Import 20 representative records through `/api/intake` with `source` = the old tool's name and `source_ref` = its record id, show them in the App, and ask for a final go.
6. **Import the rest** in batches through `/api/intake`, idempotent on `source_ref`, so a stopped run resumes without duplicates. Conflicts and possible duplicates go to Review.
7. **Check and report:** counts per object in the old tool and in the CRM, what went to Review, what was skipped and why. Leave the old data untouched; switching the old tool off is the person's call.

### 7. Bring in what the workspace already has

Read, without changing anything:

- The Room's Automations (`workflow list`, then `workflow show` for the likely ones): what each one reads, where it writes, how often.
- Room files and other Apps that hold customer lists, meeting notes, deals or billing.

Pick only the ones that create or change customer information. Send one card listing them, each with one line on what it holds and what you propose: **connect** (change it so it also writes through `/api/intake`, keeping everything else it does), **import once** (copy what it already produced), or **leave**. Default to connect for live syncs and import once for static lists.

After the OK:

- Import: send each record through `/api/intake` with `source` = the Automation or file name and `source_ref` = its original id, so a re-run creates nothing twice. Conflicts and possible duplicates land in Review by themselves; tell the person how many.
- Connect: update the Automation so its customer writes go through `/api/intake` too. Follow the platform's Automation rules (show the change, keep schedule, recipients and other effects).

### 8. Add the data sources in the design

Only the sources the approved design lists. Split them into **personal** (mailboxes, calendars, note takers) and **team** (billing, support desk, booking page, shared inbox). Anything new that came up after approval goes back to step 4 first.

### 9. Connect each person

Split the chosen sources:

- **Personal** (mailboxes, calendars, note takers, intro emails): one per person.
- **Team** (Stripe, a support desk, a booking page, a shared inbox): connected once by the person who owns that account.

For each person who should be covered, open or reuse a thread in the CRM's Room and @mention them: say which accounts to connect and why, and what will sync (the default scope below). Their reply starts a turn under their own access. In that turn:

1. `connection list --toolkit <toolkit>` to see whether they already connected it. Use it if so.
2. Otherwise `connection create --toolkit <toolkit>` sends them the sign-in card. Wait for it to come back authorized.
3. Create their sync Automation from the matching template in `references/` (Gmail: `sync-gmail.md`, Google Calendar: `sync-calendar.md`, note takers: `sync-meeting-notes.md`). Fill the placeholders, keep the code deterministic, run it under their delegation.
4. `POST /api/sync-sources` with `label` (for example "Gmail · <mailbox address>"), `source`, `kind`, `owner` (their user id), `account_label` (the address shown, never a token or id), `automation_id`, `status: "syncing"`, and `scope`.
5. Offer one Run once; check that `last_synced_at` moved and the first records landed (`GET /api/data-sources`).

Team accounts follow the same steps with the account owner, `shared: true`.

Default scope, which the person can change before you save:

- Only conversations and meetings with people outside the team's own domains; skip personal mailbox providers' private threads unless the other side is already in the CRM.
- Store subject, a short snippet and a link back; not full email bodies (`store_body: false`).
- Backfill 30 days on the first run.
- A per-person skip list of domains or addresses (lawyers, family, competitors).

### 10. Wrap up

Send a short checklist: CRM type and stages, the migration result (plan chosen, counts per object, what went to Review), what was imported from the Room (counts and how many went to Review), each data source with who connected it and its first sync, and who still has to connect. Point to **Settings › Data sources** in the App, which shows the same thing and stays current. Offer to come back for anyone who has not connected yet.

## When something stops syncing

`GET /api/data-sources` shows each account's status, last sync and last error, plus how fresh each source's records are. For a stale one: read the Automation's recent runs; an expired sign-in needs the owner to reconnect (their own turn, step 9.2); a code error is fixed in the Automation, never by writing rows by hand.
