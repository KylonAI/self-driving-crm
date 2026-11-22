import "server-only";

import { randomUUID } from "node:crypto";
import { decodeCursor, encodeCursor } from "@/lib/api/pagination";
import type { AppRecordListResponse, AppRecordResponse, CanonicalFieldValue } from "@/lib/app-definition/types";
import { executeQuery, queryRows, quoteIdentifier, type DbParam, type DbRow } from "@/lib/db";
import { type CrmEntitySpec, type CrmFieldSpec, entitySpec } from "@/lib/crm/entities";

export class CrmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface ListFilter {
  field_id: string;
  operator: "eq" | "neq" | "in" | "contains" | "is_empty" | "is_not_empty" | "lt" | "lte" | "gt" | "gte";
  value?: unknown;
}

export interface ListSort {
  field_id: string;
  direction: "asc" | "desc";
}

export interface ListControls {
  q?: string | null;
  filters?: ListFilter[];
  sorts?: ListSort[];
  limit?: number;
  cursor?: string | null;
}

export interface ListResult {
  rows: DbRow[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

const SYSTEM_FIELDS = new Set(["id", "created_at", "updated_at"]);
const OPERATORS = new Set(["eq", "neq", "in", "contains", "is_empty", "is_not_empty", "lt", "lte", "gt", "gte"]);

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function fieldOf(spec: CrmEntitySpec, key: string): CrmFieldSpec | undefined {
  return spec.fields.find((field) => field.key === key);
}

function column(alias: string, key: string) {
  return `${alias}.${quoteIdentifier(key)}`;
}

/** The SELECT list: every field, dates as plain calendar text, and a label beside each relation id. */
function selectSql(spec: CrmEntitySpec) {
  const parts = [column("t", "id"), column("t", "created_at"), column("t", "updated_at")];
  const joins: string[] = [];
  spec.fields.forEach((field, index) => {
    if (field.type === "date" && !field.includeTime) {
      parts.push(`to_char(${column("t", field.key)}, 'YYYY-MM-DD') AS ${quoteIdentifier(field.key)}`);
    } else {
      parts.push(column("t", field.key));
    }
    if (field.type === "relation" && field.relation) {
      const target = entitySpec(field.relation);
      if (!target) return;
      const alias = `r${index}`;
      joins.push(
        `LEFT JOIN ${quoteIdentifier(target.table)} ${alias} ON ${alias}.id = ${column("t", field.key)}`,
      );
      parts.push(`${alias}.${quoteIdentifier(target.titleField)} AS ${quoteIdentifier(`${field.key}__label`)}`);
    }
  });
  return { select: parts.join(", "), joins: joins.join(" ") };
}

function filterSql(spec: CrmEntitySpec, filter: ListFilter, params: DbParam[]): string {
  if (!OPERATORS.has(filter.operator)) throw new CrmError(`Unknown filter operator ${filter.operator}`, 400);
  const field = fieldOf(spec, filter.field_id);
  if (!field && !SYSTEM_FIELDS.has(filter.field_id)) throw new CrmError(`Unknown filter field ${filter.field_id}`, 400);
  if (field?.type === "json" && !["is_empty", "is_not_empty"].includes(filter.operator))
    throw new CrmError(`${field.label} can only be filtered by is_empty or is_not_empty`, 400);
  const col = column("t", filter.field_id);
  const isArray = field?.type === "multi_select" || field?.type === "multi_user";
  const value = filter.value;
  switch (filter.operator) {
    case "is_empty":
      return isArray ? `(${col} IS NULL OR cardinality(${col}) = 0)` : `(${col} IS NULL OR ${col}::text = '')`;
    case "is_not_empty":
      return isArray ? `(${col} IS NOT NULL AND cardinality(${col}) > 0)` : `(${col} IS NOT NULL AND ${col}::text <> '')`;
    case "in": {
      const values = (Array.isArray(value) ? value : [value]).filter((item) => item !== null && item !== undefined).map(String);
      if (values.length === 0) throw new CrmError("in needs a non-empty array", 400);
      params.push(values as unknown as DbParam);
      return isArray ? `${col} && ?::text[]` : `${col}::text = ANY(?::text[])`;
    }
    case "contains":
      params.push(`%${String(value ?? "")}%`);
      return isArray ? `array_to_string(${col}, ' ') ILIKE ?` : `${col}::text ILIKE ?`;
    case "eq":
      params.push(value === null || value === undefined ? null : String(value));
      return isArray ? `? = ANY(${col})` : `${col}::text = ?`;
    case "neq":
      params.push(value === null || value === undefined ? null : String(value));
      return isArray ? `NOT (? = ANY(coalesce(${col}, '{}')))` : `${col}::text IS DISTINCT FROM ?`;
    default: {
      const op = { lt: "<", lte: "<=", gt: ">", gte: ">=" }[filter.operator];
      const numeric = field && ["number", "currency", "percent"].includes(field.type);
      params.push(numeric ? Number(value) : String(value ?? ""));
      return numeric ? `${col} ${op} ?` : `${col}::text ${op} ?`;
    }
  }
}

function whereSql(spec: CrmEntitySpec, controls: ListControls, params: DbParam[]) {
  const clauses: string[] = [];
  const q = controls.q?.trim();
  if (q) {
    const like = `%${q}%`;
    clauses.push(`(${spec.searchFields.map((key) => `${column("t", key)}::text ILIKE ?`).join(" OR ")})`);
    for (let i = 0; i < spec.searchFields.length; i += 1) params.push(like);
  }
  for (const filter of controls.filters ?? []) clauses.push(filterSql(spec, filter, params));
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function orderSql(spec: CrmEntitySpec, sorts: ListSort[] | undefined) {
  const list = sorts && sorts.length ? sorts : [{ field_id: spec.defaultSort.field, direction: spec.defaultSort.direction }];
  const parts = list.map((sort) => {
    if (!fieldOf(spec, sort.field_id) && !SYSTEM_FIELDS.has(sort.field_id)) throw new CrmError(`Unknown sort field ${sort.field_id}`, 400);
    const field = fieldOf(spec, sort.field_id);
    if (field?.type === "json") throw new CrmError(`${sort.field_id} cannot be sorted`, 400);
    const dir = sort.direction === "asc" ? "ASC" : "DESC";
    return `${column("t", sort.field_id)} ${dir} NULLS LAST`;
  });
  parts.push(`${column("t", "id")} ASC`);
  return `ORDER BY ${parts.join(", ")}`;
}

export function parseListControls(searchParams: URLSearchParams): ListControls {
  const parseJson = <T>(name: string): T[] => {
    const raw = searchParams.get(name);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error();
      return parsed as T[];
    } catch {
      throw new CrmError(`${name} must be a JSON array`, 400);
    }
  };
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new CrmError("limit must be 1 to 500", 400);
  return {
    q: searchParams.get("q"),
    filters: parseJson<ListFilter>("filters"),
    sorts: parseJson<ListSort>("sorts"),
    limit,
    cursor: searchParams.get("cursor"),
  };
}

export async function listRecords(spec: CrmEntitySpec, controls: ListControls): Promise<ListResult> {
  const limit = controls.limit ?? 100;
  const offset = decodeCursor(controls.cursor ?? undefined);
  if (offset === null) throw new CrmError("Invalid cursor", 400);
  const params: DbParam[] = [];
  const where = whereSql(spec, controls, params);
  const { select, joins } = selectSql(spec);
  const table = `${quoteIdentifier(spec.table)} t`;
  const rows = await queryRows<DbRow>(
    `SELECT ${select} FROM ${table} ${joins} ${where} ${orderSql(spec, controls.sorts)} LIMIT ${limit + 1} OFFSET ${offset}`,
    params,
  );
  const [count] = await queryRows<{ total: string }>(`SELECT count(*)::text AS total FROM ${table} ${where}`, params);
  const hasMore = rows.length > limit;
  return {
    rows: rows.slice(0, limit),
    total: Number(count?.total ?? 0),
    hasMore,
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    limit,
  };
}

export async function getRow(spec: CrmEntitySpec, id: string): Promise<DbRow | null> {
  const { select, joins } = selectSql(spec);
  const rows = await queryRows<DbRow>(
    `SELECT ${select} FROM ${quoteIdentifier(spec.table)} t ${joins} WHERE t.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return undefined;
}

/** A database row in the App's record shape: relations as [{ id, label }], numbers as numbers. */
export function rowData(spec: CrmEntitySpec, row: DbRow): Record<string, CanonicalFieldValue> {
  const data: Record<string, CanonicalFieldValue> = { id: String(row.id) };
  for (const field of spec.fields) {
    const value = row[field.key];
    if (value === null || value === undefined) {
      data[field.key] = null;
      continue;
    }
    switch (field.type) {
      case "relation":
        data[field.key] = [{ id: String(value), label: String(row[`${field.key}__label`] ?? "") }];
        break;
      case "number":
      case "currency":
      case "percent":
        data[field.key] = Number(value);
        break;
      case "checkbox":
        data[field.key] = Boolean(value);
        break;
      case "multi_select":
      case "multi_user":
        data[field.key] = Array.isArray(value) ? value.map(String) : [];
        break;
      case "date":
        data[field.key] = field.includeTime ? (iso(value) ?? null) : String(value);
        break;
      case "json":
        data[field.key] = value as CanonicalFieldValue;
        break;
      default:
        data[field.key] = String(value);
    }
  }
  return data;
}

export function toResponse(spec: CrmEntitySpec, row: DbRow): AppRecordResponse {
  const created = iso(row.created_at);
  const updated = iso(row.updated_at);
  return {
    entity_id: spec.id,
    record_id: String(row.id),
    data: rowData(spec, row),
    ...(created ? { created_at: created } : {}),
    ...(updated ? { updated_at: updated } : {}),
  };
}

export function toListResponse(spec: CrmEntitySpec, result: ListResult): AppRecordListResponse {
  return {
    entity_id: spec.id,
    records: result.rows.map((row) => toResponse(spec, row)),
    pagination: {
      limit: result.limit,
      ...(result.nextCursor ? { next_cursor: result.nextCursor } : {}),
      has_more: result.hasMore,
    },
  };
}

function relationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return relationId(value[0]);
  if (typeof value === "object" && "id" in (value as Record<string, unknown>)) return relationId((value as { id: unknown }).id);
  throw new CrmError("Relation values are a record id, [id] or [{ id }]", 400);
}

/** Validates and converts incoming values to database parameters. Unknown keys are refused. */
export function writeValues(spec: CrmEntitySpec, data: Record<string, unknown>, mode: "create" | "update") {
  const values: Record<string, DbParam> = {};
  for (const [key, raw] of Object.entries(data)) {
    if (key === "id") continue;
    const field = fieldOf(spec, key);
    if (!field) throw new CrmError(`${spec.label} has no field ${key}`, 400);
    if (field.readOnly) throw new CrmError(`${field.label} is read-only`, 400);
    if (raw === null || raw === undefined || raw === "") {
      if (field.required) throw new CrmError(`${field.label} is required`, 400);
      values[key] = null;
      continue;
    }
    switch (field.type) {
      case "relation":
        values[key] = relationId(raw);
        break;
      case "user": {
        const id = typeof raw === "string" ? raw : typeof raw === "object" && raw && "id" in raw ? String((raw as { id: unknown }).id) : null;
        if (!id) throw new CrmError(`${field.label} must be a member id`, 400);
        values[key] = id;
        break;
      }
      case "number":
      case "currency":
      case "percent": {
        const number = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(number)) throw new CrmError(`${field.label} must be a number`, 400);
        values[key] = number;
        break;
      }
      case "checkbox":
        values[key] = raw === true || raw === "true";
        break;
      case "select": {
        const value = String(raw);
        if (field.options && !field.options.some((option) => option.id === value))
          throw new CrmError(`${field.label} must be one of ${field.options.map((option) => option.id).join(", ")}`, 400);
        values[key] = value;
        break;
      }
      case "multi_select": {
        const list = (Array.isArray(raw) ? raw : [raw]).map(String);
        const bad = list.find((item) => field.options && !field.options.some((option) => option.id === item));
        if (bad) throw new CrmError(`${field.label} has no option ${bad}`, 400);
        values[key] = list as unknown as DbParam;
        break;
      }
      case "date": {
        const value = String(raw);
        const valid = field.includeTime ? !Number.isNaN(Date.parse(value)) : /^\d{4}-\d{2}-\d{2}$/.test(value);
        if (!valid) throw new CrmError(`${field.label} must be ${field.includeTime ? "an ISO timestamp" : "YYYY-MM-DD"}`, 400);
        values[key] = value;
        break;
      }
      case "json":
        if (typeof raw !== "object") throw new CrmError(`${field.label} must be a JSON object or array`, 400);
        values[key] = JSON.stringify(raw);
        break;
      case "email": {
        const value = String(raw).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new CrmError(`${field.label} is not an email address`, 400);
        values[key] = value;
        break;
      }
      default:
        values[key] = String(raw).trim();
    }
  }
  if (spec.id === "companies" && typeof values.domain === "string") values.domain = normalizeDomain(values.domain);
  if (mode === "create") {
    for (const field of spec.fields) {
      if (field.required && (values[field.key] === null || values[field.key] === undefined))
        throw new CrmError(`${field.label} is required`, 400);
    }
  }
  return values;
}

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] ?? null;
}

function uniqueMessage(spec: CrmEntitySpec, error: unknown): CrmError | null {
  if (typeof error === "object" && error && (error as { code?: string }).code === "23505") {
    const detail = String((error as { constraint?: string }).constraint ?? "");
    if (detail.includes("email")) return new CrmError("A person with this email already exists", 409);
    if (detail.includes("domain")) return new CrmError("A company with this domain already exists", 409);
    if (detail.includes("source")) return new CrmError("This source reference was already recorded", 409);
    return new CrmError(`This ${spec.label.toLowerCase()} already exists`, 409);
  }
  if (typeof error === "object" && error && (error as { code?: string }).code === "23503") {
    return new CrmError("A linked record does not exist", 400);
  }
  return null;
}

async function audit(spec: CrmEntitySpec, id: string, action: string, actor: string | null, changes: unknown) {
  await executeQuery("INSERT INTO crm_audit (entity, record_id, action, actor, changes) VALUES (?, ?, ?, ?, ?::jsonb)", [
    spec.id,
    id,
    action,
    actor,
    JSON.stringify(changes ?? null),
  ]);
}

function sqlParam(field: CrmFieldSpec | undefined) {
  if (field?.type === "json") return "?::jsonb";
  if (field?.type === "multi_select" || field?.type === "multi_user") return "?::text[]";
  return "?";
}

export async function createRecord(spec: CrmEntitySpec, data: Record<string, unknown>, actor: string | null) {
  const values = writeValues(spec, data, "create");
  const id = newId(spec.idPrefix);
  const keys = Object.keys(values);
  try {
    await executeQuery(
      `INSERT INTO ${quoteIdentifier(spec.table)} (id${keys.map((key) => `, ${quoteIdentifier(key)}`).join("")}) VALUES (?${keys
        .map((key) => `, ${sqlParam(fieldOf(spec, key))}`)
        .join("")})`,
      [id, ...keys.map((key) => values[key] ?? null)],
    );
  } catch (error) {
    throw uniqueMessage(spec, error) ?? error;
  }
  await audit(spec, id, "create", actor, values);
  await afterWrite(spec, id);
  return (await getRow(spec, id)) as DbRow;
}

export async function updateRecord(spec: CrmEntitySpec, id: string, data: Record<string, unknown>, actor: string | null) {
  const values = writeValues(spec, data, "update");
  const keys = Object.keys(values);
  const before = await getRow(spec, id);
  if (!before) throw new CrmError(`${spec.label} not found`, 404);
  if (keys.length > 0) {
    try {
      await executeQuery(
        `UPDATE ${quoteIdentifier(spec.table)} SET ${keys
          .map((key) => `${quoteIdentifier(key)} = ${sqlParam(fieldOf(spec, key))}`)
          .join(", ")}, updated_at = now() WHERE id = ?`,
        [...keys.map((key) => values[key] ?? null), id],
      );
    } catch (error) {
      throw uniqueMessage(spec, error) ?? error;
    }
    const changes = Object.fromEntries(keys.map((key) => [key, { from: before[key] ?? null, to: values[key] ?? null }]));
    await audit(spec, id, "update", actor, changes);
    await afterWrite(spec, id);
  }
  return (await getRow(spec, id)) as DbRow;
}

export async function deleteRecord(spec: CrmEntitySpec, id: string, actor: string | null) {
  const rows = await queryRows<DbRow>(`DELETE FROM ${quoteIdentifier(spec.table)} WHERE id = ? RETURNING id`, [id]);
  if (rows.length === 0) throw new CrmError(`${spec.label} not found`, 404);
  await audit(spec, id, "delete", actor, null);
}

/** Small rules that keep linked records in step. */
async function afterWrite(spec: CrmEntitySpec, id: string) {
  if (spec.id === "activities") {
    // A conversation with a person moves their Last contacted date forward, never back.
    await executeQuery(
      `UPDATE crm_people p SET last_contacted_at = a.occurred_at::date, updated_at = now()
         FROM crm_activities a
        WHERE a.id = ? AND p.id = a.person_id AND a.kind IN ('meeting', 'call', 'email', 'message')
          AND (p.last_contacted_at IS NULL OR p.last_contacted_at < a.occurred_at::date)`,
      [id],
    );
    // An activity on a person fills in their company when it was left out.
    await executeQuery(
      `UPDATE crm_activities a SET company_id = p.company_id FROM crm_people p
        WHERE a.id = ? AND a.company_id IS NULL AND p.id = a.person_id AND p.company_id IS NOT NULL`,
      [id],
    );
  }
  if (spec.id === "list_members") {
    await executeQuery(
      `UPDATE crm_list_members m SET label = coalesce(p.name, c.name, m.label)
         FROM crm_list_members x
         LEFT JOIN crm_people p ON p.id = x.person_id
         LEFT JOIN crm_companies c ON c.id = x.company_id
        WHERE m.id = ? AND x.id = m.id`,
      [id],
    );
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof CrmError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[crm] request failed", error);
  return Response.json({ error: "The CRM could not complete this request." }, { status: 500 });
}
