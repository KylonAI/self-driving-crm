# Data App Template — Usage Guide

This file is the usage guide for the agent building on this template. It is
read-only reference material: do not update it for the app, do not treat it as
an app deliverable, and do not delete it. Read it once before writing code —
it replaces exploring the template source file-by-file.

SPA-style Next.js template for PostgreSQL-backed internal apps that need
custom pages, dashboards, forms, workflow screens, or semantic App APIs beyond
Kylon Data Viewer. It ships a complete demo entity (`opportunities`) that you
clone and rename into the real app's entities.

For a database-to-custom upgrade, `app template pull data-app --database-app`
prefills the existing App definition and data mapping. Treat that definition
as the data contract, then replace the `opportunities` demo with UI and APIs
for its real entities.

Database App imports retain `recordIdField`, mappings, `readOnly` flags and field
`description` text, including empty strings and whitespace.
A business ID names a declared field; omit it for the usual implicit `id`.

## Commands

```bash
pnpm install               # once after template pull; rerun after editing package.json and commit pnpm-lock.yaml
pnpm generate:contracts    # after every lib/app-definition/definition.ts change
pnpm validate:push         # required before pushing
pnpm dev                   # local dev server; rarely needed
```

The checkout ships `pnpm-lock.yaml`, and the platform build installs with a frozen lockfile: after changing `package.json`, run `pnpm install` and commit the updated lockfile, or the push fails at install with `ERR_PNPM_OUTDATED_LOCKFILE`.

The pre-push hook reuses a successful local validation only while source, configuration, environment, dependencies, and generated contracts/types remain unchanged. Deployment builds run their own checks. Validation prints per-stage durations.

`pnpm build` / `pnpm start` exist for the deployment pipeline — do not run
them locally; the preview deployment builds automatically on push and build
errors are retrievable from the deployment logs.
Generated contracts stay uncommitted; provider postbuild uploads the snapshot.

Set `DATABASE_URL` for real data. Without a DB URL the demo serves
deterministic fixtures from `data/opportunities.seed.json`.

## Date And Time Boundaries

- `DateOnly` is a canonical `YYYY-MM-DD` calendar date with no time zone; `Instant` is an ISO timestamp with `Z` or an explicit offset.
- Normalize database, API, workspace, form, or file values before they enter the business model. Add source-specific decoding under `lib/time/adapters/`.
- Converting a `Date` or `Instant` to `DateOnly` requires an explicit time zone.
- Extend `lib/time/` with the installed `date-fns` dependency and native `Date`/`Intl`; do not add another date library.
- After changing date behavior or adding an adapter, run `pnpm test:time`.

## Structure

- `app/page.tsx`: dashboard home (metrics + charts via `dashboard-overview`).
- `app/opportunities/page.tsx`: demo entity list page (table + filters + dialogs).
- `app/calendar/page.tsx`: date-field calendar view over the demo entity.
- `app/api/opportunities/**`: demo entity list/get/update/delete API routes used by the custom UI and by agents for semantic workflows.
- `app/api/manifest`, `app/api/kylon`, `app/api/openapi.json`: platform plumbing; leave as is.
- `app/layout.tsx`: root layout wiring providers and the app shell.
- `components/data-app-shell.tsx`: top-level shell with tab navigation — register new pages here.
- `components/dashboard-overview.tsx`: demo dashboard composition (metrics, status distribution, time-axis chart, drilldowns).
- `components/opportunity-*.tsx`: demo-entity-specific UI (filter, thread action); replace along with the entity.
- `components/kylon-auto-refresh.tsx`, `components/visual-viewport-vars.tsx`: platform glue; keep.
- `components/providers/`: TanStack Query + Kylon workspace provider; keep.
- `components/ui/`: reusable UI primitives (see the component index below); keep and reuse.
- `lib/opportunities/`: the demo entity module — the pattern you clone per entity (see the checklist below).
- `lib/app-definition/definition.ts`: App metadata, entities, field config, relationships, table mapping, API declarations; the single source `pnpm generate:contracts` builds from.
- `lib/kylon/`: Kylon bridge helpers and workspace member profiles; keep.
- `lib/db.ts`: DB connection/query helpers only; keep.
- `lib/query-keys.ts`: TanStack Query key registry; extend per entity.
- `lib/url-state.ts`: builds App-local hrefs without dropping unrelated query
  or fragment state; use it for filters, tabs, selections, and component views
  that must survive refresh or be presented by an agent.
- `db/migrations/`: numbered SQL migrations (schema + seed); see the platform rules in the build-app skill.
- `data/opportunities.seed.json`: no-database demo fixtures; replace or drop with the demo entity.
- `generated/`: disposable output of `pnpm generate:contracts`; never hand-edit.

## URL Reachability And Presentation Routes

Every page or component an agent may need to present must have a stable
App-local URL. Use path segments for durable identity and query parameters for
view state:

```text
/opportunities/:opportunityId
/opportunities/:opportunityId?view=full
/present/opportunities/:opportunityId?view=full
```

The demo implements the first two routes with the same
`OpportunityDetail` component. The `/present/` route removes App navigation
and unrelated page chrome so a 16:9 Kylon capture spends its first viewport on
the addressed content. Keep normal and presentation routes backed by one
component; do not build a second capture-only version that can drift.

Use `buildUrlStateHref` when a control changes query-backed state. It preserves
unrelated query keys and the fragment, removes only nullish values, and rejects
non-App-relative paths. Use `readUrlState` with an allowlist so an old or
hand-edited URL cannot put the component into an unsupported state. Navigate
with a real Next.js `Link` or router push/replace so browser history and the
Kylon bridge observe the change.

Do not keep a presentable selection, row, modal, tab, filter, or fullscreen
mode only in React state. If the requested state cannot be reconstructed from
the pathname, query, and fragment after a reload, Kylon cannot link to or
capture it. Verify each promised URL directly, after reload, and at a 720×405
viewport before handoff.

## Add An Entity (the core workflow)

Each entity is one module under `lib/<entity>/` plus its API routes and pages.
Clone the `opportunities` demo per entity and rename; every file has a fixed
role, so this is mechanical:

1. `lib/<entity>/types.ts` — record/data interfaces, field union types, list-control types.
2. `lib/<entity>/metadata.ts` — select options, owner/user lists, option label helpers.
3. `lib/<entity>/server.ts` — SQL queries (list/get/update/delete), WHERE/ORDER builders, row↔record mapping, `to<Entity>Response` envelope. Keep the `created_at`/`updated_at` passthrough: server queries select the timestamp columns and the response envelope forwards them (`createdAt`/`updatedAt` on the client) — time-axis charts depend on it.
4. `lib/<entity>/client.ts` — TanStack Query hooks (list/get/create/update/delete) and field-value mapping.
5. `lib/<entity>/table-config.ts` — Data table column definitions.
6. `app/api/<entity>/**` — route handlers delegating to `server.ts`.
7. `app/<entity>/page.tsx` — list page; register the tab in `components/data-app-shell.tsx`.
8. `lib/app-definition/definition.ts` — declare the entity (fields, table mapping, relationships, `api.*` paths), then `pnpm generate:contracts`.
9. `db/migrations/` — add the entity's `CREATE TABLE` (and seed rows if intentional) as a new numbered file.

Replace the full demo set (`lib/opportunities/`, `app/opportunities/`, `app/api/opportunities/`, `components/opportunity-*.tsx`, `data/opportunities.seed.json`, demo migrations) with the real entities. The draft preview should contain the confirmed pages and workflows backed by the prefilled App definition.

## Definition Contracts (read before writing definition.ts)

`lib/app-definition/types.ts` is the single authoritative contract for
`lib/app-definition/definition.ts`. Read that one file before writing or
editing a definition — do not infer shapes from prose or from memory. The
pieces that most often fail typecheck:

- `EntityDefinition` = manifest fields (`id`, `label`, `pluralLabel`,
  `description`, `titleField`, `fields`, `relationships`) plus DB mapping
  (`table`, optional `idColumn`/`createdAtColumn`/`updatedAtColumn`, `api`).
- Every field `type` must come from the `FieldType` union; select options are
  `{ id, label, color? }` objects under `config.options`.
- `relationships` entries are `RelationshipManifest`:
  `{ type: "has_one" | "has_many" | "belongs_to" | "many_to_many", entityId, foreignKey?, label? }`
  — note camelCase `entityId`/`foreignKey`.

Minimal complete entity for reference:

```ts
{
  id: "clients",
  label: "Client",
  pluralLabel: "Clients",
  description: "Companies we sell to.",
  titleField: "name",
  table: "clients",
  fields: [
    { id: "name", label: "Name", type: "text", required: true },
    {
      id: "status",
      label: "Status",
      type: "select",
      config: {
        options: [
          { id: "active", label: "Active", color: "green" },
          { id: "churned", label: "Churned" },
        ],
      },
    },
    { id: "owner", label: "Owner", type: "user" },
  ],
  relationships: [{ type: "has_many", entityId: "deals", foreignKey: "client_id" }],
  api: {
    list: "/api/clients",
    get: "/api/clients/{client_id}",
    update: "/api/clients/{client_id}",
    delete: "/api/clients/{client_id}",
  },
}
```

Table/list UI configs must satisfy the generics in
`components/ui/data-types.ts`: declare columns as
`[...] satisfies DataColumn<YourRecord>[]` so mismatches fail at the
declaration instead of deep inside page typechecking.

## SQL Dialect (PostgreSQL)

The App database speaks PostgreSQL. Write `db/migrations/*.sql` and all query
SQL in PostgreSQL dialect — MySQL habits are the common failure source:

- No enum column types. Inline `status ENUM('todo','done')` is MySQL-only and
  fails the migration with `type "enum" does not exist`; do not reach for
  `CREATE TYPE ... AS ENUM` either. Use `VARCHAR`/`TEXT` plus a `CHECK`
  constraint: `status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done'))`.
- No backtick identifiers and no `AUTO_INCREMENT`. Quote identifiers with
  double quotes only when required; for numeric keys use
  `GENERATED ALWAYS AS IDENTITY` (this template's demo uses app-generated
  string ids instead).
- Timestamps are `TIMESTAMPTZ` with `DEFAULT now()`.
- Keep writing `?` placeholders in server query code — `lib/db.ts` converts
  them to `$1, $2, ...` before execution. Raw SQL in migration files uses no
  placeholders at all.

## UI Component Index

All under `components/ui/`. Before using any component you have not used yet,
read the props interface at the top of its file (one targeted read) — do not
guess props and fix them after typecheck.

- `data-table/` — the table engine: header sort/filter menus, virtualized rows, scroll pagination, card list fallback, column-width persistence (`index.tsx` is the entry; interaction model below).
- `data-types.ts` — canonical field value/type aliases shared by table + field components.
- `field.tsx`, `field-list.tsx`, `field-list-layout.ts` — record detail field grid primitives.
- `field-value.tsx`, `field-value-popover.tsx`, `field-values/` — per-type field renderers/editors (text, number, date, select, checkbox, relation, attachment) with view/edit modes.
- `drilldown-dialog.tsx` — chart→records drilldown dialog (`DrilldownScope` + rows).
- `metrics.tsx` — dashboard summary metric cards (`SummaryMetric[]`).
- `chart.tsx` — Recharts wrapper with themed tooltip/legend.
- `calendar.tsx`, `calendar-view.tsx`, `calendar-utils.ts` — date-picker primitive and month/week event calendar (`CalendarEvent[]`).
- `combobox.tsx` — searchable select for relation/user pickers.
- `overflow-list.tsx` — collapses overflowing chips into a "+N" popover.
- `file-preview.tsx` — attachment preview (image/pdf) with fallback link.
- `alert-dialog.tsx`, `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `hover-card.tsx`, `tooltip.tsx`, `context-menu.tsx`, `dropdown-menu.tsx` — overlay primitives (shadcn-style).
- `button.tsx`, `input.tsx`, `input-group.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `slider.tsx`, `toggle.tsx`, `toggle-group.tsx`, `label.tsx` — form primitives.
- `card.tsx`, `tabs.tsx`, `accordion.tsx`, `separator.tsx`, `scroll-area.tsx`, `skeleton.tsx`, `badge.tsx`, `avatar.tsx`, `alert.tsx`, `item.tsx`, `kbd.tsx`, `sonner.tsx` — layout/display primitives and toasts.
- `use-responsive-input.ts` — hook for mobile-friendly input behavior.

## Data Table Interaction Model

`DataTable` is read-only by default: cells have no click interaction and
clicking a row triggers the primary (first) title action. Key props:

- `editable` — turns on click-to-edit cells (via `onCellCommit`); the title
  cell still triggers the title action unless `titleEditsOnClick` is set. The
  demo page ships without it (read-only) — set it, or wire an app-level
  control for it, only when the app calls for inline editing.
- `titleAction`/`titleActions` — pass exactly one action chosen with
  `useIsKylonShell()`: "Discuss in thread" inside the Kylon shell, "Open in
  dialog" in a plain browser (see `app/opportunities/page.tsx`).
- `sort`/`onSortChange` and `columnFilters`/`onColumnFiltersChange` —
  controlled mode: map them to the list API's `sorts`/`filters` query params so
  they apply to the whole data set (the demo maps UI keys through
  `opportunityApiFieldId` and uses the `in` operator for multi-value filters).
  Omit them (optionally with `defaultSort`/`defaultColumnFilters`) for
  uncontrolled client-side sorting/filtering of already-loaded rows.
- A header shows a sort arrow only on the column currently sorted; idle
  sortable headers carry no icon.
- Filter menu options toggle in place: they pass `onSelect={keepMenuOpen}` so
  the menu stays open across picks and `indicatorPosition="end"` so the check
  sits after the value.
- Every column sorts by default. A header offers Sort ascending/descending
  unless the column is `json` (never sortable, matching the definition
  contract) or sets `sortable: false`. Do not write `sortable: true` per
  column — it is already the default, and spelling it out teaches the next
  reader that omitting it means "off".
- When sort is controlled (server-side), the list API's allowed sort fields
  must cover every column the table still renders sortable. A column the
  header offers but the endpoint rejects turns a click into a failed request,
  so extend the API's allowlist in the same change that adds the column.
- Header filter menus appear on `select`/`multi_select` columns with options
  and on `user`/`multi_user` columns with people to offer (`config.users`, or
  the workspace members when the column has none); `filterable: false` opts a
  column out. An active filter replaces the header label with the selected
  option badges or person chips. In controlled mode send every header filter
  as `in`: an array column such as a `multi_user` owner only matches by
  overlap, so `eq` with one selected person returns nothing.
- The compact (card list) presentation renders Sort/Filter controls above the
  cards from the same state and callbacks, so narrow screens keep full
  sort/filter access. Its Filter menu drills in rather than opening flyout
  submenus: choosing a column swaps the menu to that column's options with a
  back row, because a phone-width screen has no room beside the menu.
- Rows render through `@tanstack/react-virtual` and page in via
  `hasMoreRows`/`onLoadMoreRows` (wired to `useInfiniteOpportunities`), so
  large lists stay fast — keep both when cloning the entity.

## Automations (scheduled and record-triggered work)

An App can declare the Automations it owns. Publishing a commit that declares
one creates it in the App's Room; changing a declaration updates it; dropping
one retires it; and rolling back to an earlier commit converges the set to
whatever that commit declared. The declaration lives in `definition.ts`, so it
ships and rolls back with the code it belongs to.

```ts
export const appDefinition: AppDefinition = {
  // ...app, dataViewer, entities
  automations: [
    {
      key: "nightly-sweep",
      name: "Nightly sweep",
      trigger: { kind: "cron", expr: "0 2 * * *", timezone: "Asia/Shanghai" },
      target: { kind: "prompt", message: "Close overdue invoices." },
      delivery: { publish: true },
    },
    {
      key: "on-blocked",
      name: "Escalate blocked work",
      trigger: {
        kind: "record_change",
        entity: "opportunities",
        events: ["update"],
        when: { where: { status: "blocked" } },
      },
      target: { kind: "prompt", message: "Summarize what is blocked and who owns it." },
    },
  ],
};
```

Rules worth knowing before you write one:

- **Omitting the field means this version says nothing — which is not always a
  no-op.** When a version does not state `automations`, the platform falls back
  to the App's registration document (what `app register` declared). So:
  - Upgrading to this contract layer without declaring anything is safe: the
    App keeps the Automations it already had, including any created through
    `app register`. That is the normal adoption path.
  - But once an App declares in source, **removing the field again retires those
    Automations** on the next publish, because the fallback is the registration
    document and that document usually declares nothing. Removing a declaration
    is how you retire it; there is no "leave it alone" once source owns it.
  - `automations: []` is the explicit statement "this App owns none" and retires
    everything either way.
- **`key` is the identity.** Renaming `name` keeps the same Automation with its
  run history, credit budget and paused/running state. Changing `key` retires
  the old one and creates a new one, paused. When moving an existing
  registration-declared Automation into source, copy its exact key from
  `app automations <app_id>` first.
- **New Automations are created paused.** Publishing never starts a scheduled
  spend nobody enabled; a person resumes it from the Room.
- **Cron is held to a minimum interval** (10 minutes in production).
  `pnpm validate:push` rejects an expression that certainly fires faster, so
  you find out while writing rather than after a deploy. Standard 5-field
  expressions work, 6 fields with leading seconds work, and the aliases
  `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`/`@annually` are
  accepted. Other `@` forms — `@midnight`, `@minutely`, `@reboot` — are not
  valid cron for the platform.
- **A record trigger's `entity` must be an entity this same contract ships**,
  and `when` narrows which changes wake it.
- **A `code` target must import `@kylon/workflow-sdk`.** A source that does not
  is refused rather than silently run as a prompt, which would pay a per-run
  model tax for a fixed procedure.
- **The definition is the owner.** Once an Automation is declared here, editing
  or deleting it from the Room is refused with a pointer back to this file;
  pause, resume, manual trigger and credit budget stay available there.

## Platform Topics (read the build-app skill references, not template source)

These are platform-wide contracts, documented in the `build-app` skill — read
the referenced file when the app touches the topic; do not reverse-engineer
them from template code:

- Workspace members and `user`/`multi_user` fields → `references/workspace-data.md`.
- Entity/field/relation registration contracts and Data Viewer behavior → `references/data-definition-contracts.md`.
- Build the confirmed Custom UI pages and workflows. For Apps with registered data, Data Viewer is available from the Kylon App header's More menu. Other UI conventions → `references/ui-guidelines.md`.
- `db/migrations` rules, the App id placeholder and registration gates, and the develop→push→publish loop → the build-app skill body.
- **Do not block iframe embedding.** Never add `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` — Kylon previews run in an iframe.

You have now seen the whole template. Start building — do not read template
source files to "understand the project" beyond the targeted reads above.
