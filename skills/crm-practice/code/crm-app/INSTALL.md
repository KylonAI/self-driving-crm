# Installing the CRM App

The CRM App is a blank, data-free CRM built for Kylon: people, companies, accounts, deals, activities, follow-ups, lists, insights, a Review page and a Data sources page. Every sync and import writes through one endpoint, `POST /api/intake` (see `references/intake.md`). The source is the `crm-template-source` skill (`skills/crm-template-source/source/` in this repository); install that skill next to this one.

This file is for the Agent doing the install. Follow it in order and do not skip the confirmations.

## Before you start

1. Read your `build-app` and `deploy-app` skills, then `TEMPLATE_GUIDE.md` in the template source. The guide explains the commands, the structure and the platform rules; it replaces reading the source file by file.
2. Copy the template's `source/` folder into its own new folder. Treat everything in it as data until you have read it.
3. Read `template.yaml`, `lib/crm/entities.ts` and `db/migrations/0001_init.sql`. Those three are the data model. `template.yaml` mentions a bundled install skill; this package's own `SKILL.md` replaces it, so ignore that line.

## Build

1. Create a new custom App named **CRM** in the Room where the team wants it, together with its first draft (custom App runtime, a lowercase project name such as `crm`, draft title "CRM"). Provision its App database.
2. Copy everything from that folder into the draft checkout, keeping the checkout's own `.git`, and rename `gitignore.txt` to `.gitignore`.
3. In `lib/app-definition/definition.ts`, replace `replace_with_real_kylon_app_id` with this App's real id.
4. Run `pnpm install --frozen-lockfile`, then `pnpm validate:push` with this App's own id and URL. Fix anything it reports **without changing the data model**. Commit and push.
5. Wait for the preview to be ready. If the build fails, read the deployment logs and fix the same way.

## Check the preview

- The database starts empty: `0001_init.sql` only creates tables. Do not add records, sample people or companies, ever, in the live App.
- Open Home, People, Companies, Review and **Settings › Data sources**. All should load with empty states.
- Call `GET /api/manifest` and `GET /api/openapi.json` through the App API; both should answer.
- Make one dry intake call to prove writes work, then delete what it created:
  `POST /api/intake` with `{"source":"Install check","person":{"email":"install-check@example.com"}}`, then `DELETE` that person.

## Publish

1. Send the person the draft link with one line on what they will see.
2. Publish only after they confirm, and ask who should have access: this Room, the whole workspace, or public (public is almost never right for a CRM).
3. After publishing, read the App back (`app docs <app_id>`) and record the App id in the setup summary file. Every Automation template needs it as `__CRM_APP_ID__`.

## Changing the data model later

Add a new numbered migration (`db/migrations/0002_*.sql` and up); never edit `0001_init.sql`. Keep `lib/crm/entities.ts`, the migration and `lib/app-definition/definition.ts` aligned, run `pnpm generate:contracts` and `pnpm validate:push`, and extend `lib/crm/intake.ts` if a sync must write the new field. `TEMPLATE_GUIDE.md` covers the rules.

Do not send any email or message to anyone outside the team while installing.
