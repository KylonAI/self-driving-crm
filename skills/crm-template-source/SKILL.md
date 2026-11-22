---
name: crm-template-source
description: Source code of the blank CRM template (a Kylon custom App on the data-app template) and the steps to build it into a new App in the current Room with an empty database. People, companies, accounts, deals, meetings, follow-ups, lists, insights, review and a read-only data sources page, with one intake API every sync writes through. Use together with the install-crm skill: run it only after install-crm has interviewed the person, scanned their mailbox for integrations and had the architecture design approved; install-crm then finishes the setup. Use when someone asks to install, rebuild or fork the CRM template from this source.
---

# CRM template source

The App source is in `source/` next to this file. Build it only once the install-crm skill's architecture design (its step 4) is approved; if there is no approved design, go back to install-crm first. Build it into the Room the design names, publish it with the person's OK, then return to install-crm step 5.

1. Read `source/INSTALL.md`, `source/template.yaml` and `source/TEMPLATE_GUIDE.md`, and your build-app and deploy-app skills, before changing anything.
2. Create a new custom App named "CRM" in the current Room with its first draft (custom_app runtime, a lowercase provider project name such as `crm`), then provision its App database.
3. Copy everything inside `source/` into the draft checkout, keeping the checkout's own `.git`, and rename `gitignore.txt` to `.gitignore` (skill packages drop dotfiles; without it node_modules and build output would be committed). Run `pnpm install --frozen-lockfile`, then `validate:push` with this App's own id and URL; fix anything it reports without changing the data model. Commit and push, wait for the preview, and fix build errors the same way.
4. The database starts empty: `db/migrations/0001_init.sql` only creates tables. Never add records, sample people or companies.
5. Share the draft link. Publish only after the person confirms, and ask who should have access (this Room, the workspace, or public).
6. Return to the install-crm skill, step 5 onward.
