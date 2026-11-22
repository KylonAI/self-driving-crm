# Migrating an existing CRM or customer data

Analyse, propose, wait for the person's choice, trial, then import. Nothing is written to the CRM before the person picks a plan.

## Getting the data

| Where it lives | How to read it |
| --- | --- |
| HubSpot, Salesforce, Pipedrive, Attio, Close, Zoho | The tool's full export (CSV per object) attached in the thread, or its Kylon connection when one exists (`connection search --query "<tool> contacts deals"`) |
| Affinity (VC) | List and organization exports; include notes and the list each organization sits on (it usually maps to deal stage) |
| Airtable, Notion, Google Sheets, Excel | The export or the sheet's connection; ask which tab or base holds customers |
| An App in this workspace | Its own API (`app docs <app_id>`, then `app api get`); never its database directly |

Read only. Keep the raw export in a file in the Room; never paste customer rows into chat.

## Analysis report (one short file)

- Objects and row counts.
- Per field: how many rows have it, three sample values, and the proposed CRM field (or "notes", or "drop").
- Pipelines and stages with deal counts, and the proposed mapping into the CRM's stages (`GET /api/settings`).
- Owners: each old owner and the workspace member they map to; unknown owners stay empty.
- Links: how contacts tie to companies and deals; orphans.
- Duplicates: same email, same domain, same name with no email; how many would merge.
- Quality: rows without email or domain, malformed values, very old records (last activity years ago).
- History: activities and notes, date range, volume; attachments and where they would go.
- Anything that cannot come over (custom objects with no home, formulas, workflows in the old tool).

## Field mapping

| Old (typical) | CRM |
| --- | --- |
| Company name, domain / website, industry, size, country, city, owner, LinkedIn | `company` name, domain, industry, size_band, country, city, owner, linkedin_url |
| Contact name, email, title, phone, company, owner, LinkedIn | `person` name, email, title, phone, company (matched by domain), owner, linkedin_url |
| Lifecycle / lead status | `person.role` or `company.relationship`; the original value goes in notes when it does not fit |
| Deal name, stage, amount, close date, owner, contact, company | `deal` name, stage (mapped), amount, close_date, owner, person_id, company_id |
| Customer / subscription record | `account` name, status, plan, value, renewal_date, account_manager |
| Emails, calls, meetings, notes | `activity` with the original date in `occurred_at` and kind email / call / meeting / note |
| Tasks | `task` with status open or done |
| Custom fields with no home | Appended to the record's notes as "Field: value" |

Every imported item carries `source` = the old tool's name and `source_ref` = its id in the old tool (prefix by object: `hubspot:contact:123`), so re-runs never duplicate.

## Plans to offer

- **Full move:** every object and all history. Best when the old tool is being switched off soon.
- **Active only:** open deals, current customers, and people or companies with activity in the last 12 months, with their history; the rest stays in the old tool as an archive. Best for large, messy exports.
- **Run side by side:** import once now, then keep pulling changes from the old tool on a schedule for an agreed period, then switch. Best when the team cannot change tools in one day.

For each: what moves, counts, what stays behind, the duplicate rule, the stage and owner mapping, the risk, and roughly how long the import takes. Recommend one.

## Running it

1. Trial: 20 records covering every object and an edge case or two; show them in the App; get a final go.
2. Import in the order companies, people, accounts, deals, activities, tasks, in batches, each item through `POST /api/intake`; record progress so a stopped run resumes.
3. Check: counts per object against the export, items in Review, items skipped with reasons. Report in one message with a link to the analysis file.
4. Do not change or delete anything in the old tool.
