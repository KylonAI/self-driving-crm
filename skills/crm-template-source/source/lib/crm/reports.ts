import "server-only";

import { queryRows, type DbRow } from "@/lib/db";
import {
  type CrmEntitySpec,
  CRM_ENTITIES,
  accounts,
  activities,
  deals,
  entitySpec,
  listMembers,
  people,
  syncSources,
  tasks,
} from "@/lib/crm/entities";
import { readSettings } from "@/lib/crm/settings";
import { getRow, listRecords, toResponse } from "@/lib/crm/server";

const num = (value: unknown) => Number(value ?? 0);

export async function counts() {
  const [row] = await queryRows<DbRow>(`SELECT
      (SELECT count(*) FROM crm_companies) AS companies,
      (SELECT count(*) FROM crm_people) AS people,
      (SELECT count(*) FROM crm_accounts) AS accounts,
      (SELECT count(*) FROM crm_deals) AS deals,
      (SELECT count(*) FROM crm_activities) AS activities,
      (SELECT count(*) FROM crm_tasks WHERE status = 'open' AND due_date <= current_date) AS tasks_due,
      (SELECT count(*) FROM crm_tasks WHERE status = 'open') AS tasks_open,
      (SELECT count(*) FROM crm_lists) AS lists,
      (SELECT count(*) FROM crm_review_items WHERE status = 'open') AS review_open,
      (SELECT count(*) FROM crm_sync_sources WHERE status = 'error' OR (status = 'syncing' AND (last_synced_at IS NULL OR last_synced_at < now() - interval '1 day'))) AS sources_attention`);
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key, num(value)]));
}

export async function insights() {
  const settings = await readSettings();
  const stageRows = await queryRows<DbRow>(
    "SELECT stage, count(*) AS count, coalesce(sum(amount), 0) AS amount FROM crm_deals GROUP BY stage",
  );
  const byStage = new Map(stageRows.map((row) => [String(row.stage ?? ""), row]));
  const pipeline = settings.deal_stages.map((stage) => ({
    stage: stage.id,
    label: stage.label,
    kind: stage.kind,
    count: num(byStage.get(stage.id)?.count),
    amount: num(byStage.get(stage.id)?.amount),
  }));
  const known = new Set(settings.deal_stages.map((stage) => stage.id));
  const unstaged = stageRows.filter((row) => !known.has(String(row.stage ?? "")));
  if (unstaged.length)
    pipeline.push({
      stage: "",
      label: "No stage",
      kind: "open",
      count: unstaged.reduce((sum, row) => sum + num(row.count), 0),
      amount: unstaged.reduce((sum, row) => sum + num(row.amount), 0),
    });
  const wonIds = settings.deal_stages.filter((stage) => stage.kind === "won").map((stage) => stage.id);
  const openIds = settings.deal_stages.filter((stage) => stage.kind === "open").map((stage) => stage.id);

  const weeks = await queryRows<DbRow>(
    `WITH w AS (SELECT generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS week)
     SELECT to_char(w.week, 'YYYY-MM-DD') AS week,
       (SELECT count(*) FROM crm_deals d WHERE date_trunc('week', d.created_at) = w.week) AS deals_created,
       (SELECT count(*) FROM crm_activities a WHERE date_trunc('week', a.occurred_at) = w.week AND a.kind = 'meeting') AS meetings,
       (SELECT count(*) FROM crm_activities a WHERE date_trunc('week', a.occurred_at) = w.week AND a.kind IN ('email', 'message')) AS messages,
       (SELECT count(*) FROM crm_activities a WHERE date_trunc('week', a.occurred_at) = w.week AND coalesce(a.kind, 'other') NOT IN ('meeting', 'email', 'message')) AS other_activity,
       (SELECT count(*) FROM crm_people p WHERE date_trunc('week', p.created_at) = w.week) AS people_added
     FROM w ORDER BY w.week`,
  );
  const owners = await queryRows<DbRow>(
    `SELECT owner, count(*) AS deals, coalesce(sum(amount), 0) AS amount FROM crm_deals
      WHERE stage = ANY(?::text[]) GROUP BY owner ORDER BY count(*) DESC LIMIT 10`,
    [openIds as unknown as string],
  );
  const [totals] = await queryRows<DbRow>(
    `SELECT
       (SELECT count(*) FROM crm_deals WHERE stage = ANY(?::text[])) AS open_deals,
       (SELECT coalesce(sum(amount), 0) FROM crm_deals WHERE stage = ANY(?::text[])) AS pipeline_amount,
       (SELECT count(*) FROM crm_deals WHERE stage = ANY(?::text[]) AND updated_at > now() - interval '90 days') AS won_90d,
       (SELECT coalesce(sum(amount), 0) FROM crm_deals WHERE stage = ANY(?::text[]) AND updated_at > now() - interval '90 days') AS won_amount_90d,
       (SELECT count(*) FROM crm_activities WHERE occurred_at > now() - interval '30 days') AS activities_30d,
       (SELECT count(*) FROM crm_tasks WHERE status = 'open' AND due_date < current_date) AS tasks_overdue`,
    [openIds, openIds, wonIds, wonIds] as unknown as string[],
  );
  return {
    currency: settings.currency,
    pipeline,
    weeks: weeks.map((row) => ({
      week: String(row.week),
      deals_created: num(row.deals_created),
      meetings: num(row.meetings),
      messages: num(row.messages),
      other_activity: num(row.other_activity),
      people_added: num(row.people_added),
    })),
    owners: owners.map((row) => ({ owner: (row.owner as string | null) ?? null, deals: num(row.deals), amount: num(row.amount) })),
    totals: Object.fromEntries(Object.entries(totals ?? {}).map(([key, value]) => [key, num(value)])),
  };
}

export async function home(me: string | null) {
  const myTasks = await listRecords(tasks, {
    filters: [
      { field_id: "status", operator: "eq", value: "open" },
      ...(me ? [{ field_id: "owner", operator: "eq" as const, value: me }] : []),
    ],
    sorts: [{ field_id: "due_date", direction: "asc" }],
    limit: 12,
  });
  const recent = await listRecords(activities, { sorts: [{ field_id: "occurred_at", direction: "desc" }], limit: 10 });
  const settings = await readSettings();
  const openIds = settings.deal_stages.filter((stage) => stage.kind === "open").map((stage) => stage.id);
  const closing = await listRecords(deals, {
    filters: [
      { field_id: "stage", operator: "in", value: openIds.length ? openIds : ["__none__"] },
      { field_id: "close_date", operator: "is_not_empty" },
    ],
    sorts: [{ field_id: "close_date", direction: "asc" }],
    limit: 8,
  });
  return {
    tasks: myTasks.rows.map((row) => toResponse(tasks, row)),
    tasks_total: myTasks.total,
    recent_activities: recent.rows.map((row) => toResponse(activities, row)),
    closing_deals: closing.rows.map((row) => toResponse(deals, row)),
    counts: await counts(),
  };
}

const RELATED: Record<string, Array<{ key: string; spec: CrmEntitySpec; field: string; limit?: number }>> = {
  companies: [
    { key: "people", spec: people, field: "company_id" },
    { key: "deals", spec: deals, field: "company_id" },
    { key: "accounts", spec: accounts, field: "company_id" },
    { key: "tasks", spec: tasks, field: "company_id" },
    { key: "activities", spec: activities, field: "company_id", limit: 30 },
  ],
  people: [
    { key: "deals", spec: deals, field: "person_id" },
    { key: "tasks", spec: tasks, field: "person_id" },
    { key: "activities", spec: activities, field: "person_id", limit: 30 },
    { key: "lists", spec: listMembers, field: "person_id" },
  ],
  accounts: [
    { key: "deals", spec: deals, field: "account_id" },
    { key: "tasks", spec: tasks, field: "account_id" },
    { key: "activities", spec: activities, field: "account_id", limit: 30 },
  ],
  deals: [
    { key: "tasks", spec: tasks, field: "deal_id" },
    { key: "activities", spec: activities, field: "deal_id", limit: 30 },
  ],
};

/** One read for a record page: the record, what links to it, and its recent history. */
export async function recordContext(entityId: string, id: string) {
  const spec = entitySpec(entityId);
  if (!spec || !(entityId in RELATED)) return null;
  const row = await getRow(spec, id);
  if (!row) return null;
  const related: Record<string, { total: number; records: ReturnType<typeof toResponse>[] }> = {};
  for (const link of RELATED[entityId] ?? []) {
    const result = await listRecords(link.spec, {
      filters: [{ field_id: link.field, operator: "eq", value: id }],
      limit: link.limit ?? 50,
    });
    related[link.key] = { total: result.total, records: result.rows.map((item) => toResponse(link.spec, item)) };
  }
  const audit = await queryRows<DbRow>(
    "SELECT action, actor, changes, at FROM crm_audit WHERE entity = ? AND record_id = ? ORDER BY at DESC LIMIT 20",
    [entityId, id],
  );
  return {
    record: toResponse(spec, row),
    related,
    audit: audit.map((item) => ({
      action: String(item.action),
      actor: (item.actor as string | null) ?? null,
      changes: item.changes ?? null,
      at: item.at instanceof Date ? item.at.toISOString() : String(item.at),
    })),
  };
}

/** How complete each object's fields are, for the Fields & data quality page. */
export async function quality() {
  const out = [];
  for (const spec of CRM_ENTITIES.filter((entity) => ["companies", "people", "accounts", "deals"].includes(entity.id))) {
    const parts = spec.fields
      .filter((field) => field.type !== "json")
      .map((field) => {
        const col = `"${field.key}"`;
        return field.type === "multi_select"
          ? `count(*) FILTER (WHERE ${col} IS NOT NULL AND cardinality(${col}) > 0) AS "${field.key}"`
          : `count(*) FILTER (WHERE ${col} IS NOT NULL AND ${col}::text <> '') AS "${field.key}"`;
      });
    const [row] = await queryRows<DbRow>(`SELECT count(*) AS total, ${parts.join(", ")} FROM "${spec.table}"`);
    const total = num(row?.total);
    out.push({
      entity: spec.id,
      total,
      fields: spec.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        filled: num(row?.[field.key]),
      })),
    });
  }
  const [dupes] = await queryRows<DbRow>(
    `SELECT
       (SELECT count(*) FROM (SELECT lower(name) FROM crm_companies GROUP BY lower(name) HAVING count(*) > 1) x) AS company_names,
       (SELECT count(*) FROM (SELECT lower(name) FROM crm_people WHERE email IS NULL GROUP BY lower(name) HAVING count(*) > 1) x) AS people_names_without_email`,
  );
  return { objects: out, duplicates: { company_names: num(dupes?.company_names), people_names_without_email: num(dupes?.people_names_without_email) } };
}


/**
 * The Data sources page: every connected account with its sync health, and
 * every source that actually wrote records, read from the records themselves,
 * so a sync that stopped shows as quiet even when its Automation looks fine.
 */
export async function dataSources() {
  const settings = await readSettings();
  const connected = await listRecords(syncSources, { sorts: [{ field_id: "kind", direction: "asc" }], limit: 500 });
  const written = await queryRows<DbRow>(
    `SELECT t, s, count(*) AS total, count(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d, max(created_at) AS last_at FROM (
       SELECT 'activities' AS t, coalesce(source, 'Unknown') AS s, created_at FROM crm_activities
       UNION ALL SELECT 'people', coalesce(source, 'Unknown'), created_at FROM crm_people
       UNION ALL SELECT 'companies', coalesce(source, 'Unknown'), created_at FROM crm_companies
       UNION ALL SELECT 'deals', coalesce(source, 'Unknown'), created_at FROM crm_deals
       UNION ALL SELECT 'tasks', coalesce(source, 'Unknown'), created_at FROM crm_tasks
     ) x GROUP BY t, s ORDER BY max(created_at) DESC`,
  );
  return {
    crm_type: settings.crm_type,
    connected: connected.rows.map((row) => toResponse(syncSources, row)),
    written: written.map((row) => ({
      table: String(row.t),
      source: String(row.s),
      total: num(row.total),
      last_7d: num(row.last_7d),
      last_at: row.last_at instanceof Date ? row.last_at.toISOString() : row.last_at ? String(row.last_at) : null,
    })),
  };
}
