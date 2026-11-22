import "server-only";

import { executeQuery, queryRows, type DbRow } from "@/lib/db";
import { CRM_PRESETS, type CrmType, type ObjectLabels, type Stage, DEFAULT_LABELS, isCrmType } from "@/lib/crm/presets";
import { CrmError } from "@/lib/crm/server";
import type { CrmSettings } from "@/lib/crm/settings-types";

export type { CrmSettings };


const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null);

function fromRow(row: DbRow | undefined): CrmSettings {
  const type = isCrmType(row?.crm_type) ? row.crm_type : null;
  const preset = CRM_PRESETS[type ?? "b2b"];
  const labels = { ...DEFAULT_LABELS, ...preset.labels, ...((row?.labels as Partial<ObjectLabels> | null) ?? {}) };
  const stages = Array.isArray(row?.deal_stages) && row.deal_stages.length ? (row.deal_stages as Stage[]) : preset.stages;
  return {
    crm_type: type,
    org_name: (row?.org_name as string | null) ?? null,
    labels,
    deal_stages: stages,
    currency: (row?.currency as string | null) ?? "USD",
    amount_label: preset.amountLabel,
    installed_at: iso(row?.installed_at),
  };
}

export async function readSettings(): Promise<CrmSettings> {
  const rows = await queryRows<DbRow>("SELECT * FROM crm_settings WHERE id = 'default'");
  return fromRow(rows[0]);
}

async function ensureRow() {
  await executeQuery("INSERT INTO crm_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING");
}

function validStages(value: unknown): Stage[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) throw new CrmError("deal_stages needs 2 to 20 stages", 400);
  const seen = new Set<string>();
  const stages = value.map((item) => {
    const stage = item as Partial<Stage>;
    const id = String(stage.id ?? "").trim();
    const label = String(stage.label ?? "").trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(id)) throw new CrmError(`Stage id ${id || "(empty)"} must be lower_snake_case`, 400);
    if (!label) throw new CrmError(`Stage ${id} needs a label`, 400);
    if (seen.has(id)) throw new CrmError(`Stage ${id} appears twice`, 400);
    if (!["open", "won", "lost"].includes(String(stage.kind))) throw new CrmError(`Stage ${id} kind must be open, won or lost`, 400);
    seen.add(id);
    return { id, label, kind: stage.kind as Stage["kind"] };
  });
  if (!stages.some((stage) => stage.kind === "open")) throw new CrmError("At least one stage must be open", 400);
  return stages;
}

function validLabels(value: unknown): ObjectLabels {
  if (!value || typeof value !== "object") throw new CrmError("labels must be an object", 400);
  const labels = { ...DEFAULT_LABELS };
  for (const key of Object.keys(DEFAULT_LABELS) as Array<keyof ObjectLabels>) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const text = String(raw).trim();
    if (!text || text.length > 40) throw new CrmError(`labels.${key} must be 1 to 40 characters`, 400);
    labels[key] = text;
  }
  return labels;
}

/**
 * Partial update. Choosing a CRM type also resets words and stages to that
 * type's preset unless the same call sends its own.
 */
export async function updateSettings(input: Record<string, unknown>): Promise<CrmSettings> {
  await ensureRow();
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  const put = (sql: string, value: string | number | null) => {
    sets.push(sql);
    params.push(value);
  };
  if ("crm_type" in input) {
    if (!isCrmType(input.crm_type)) throw new CrmError("crm_type must be b2b, vc, partners, recruiting or other", 400);
    put("crm_type = ?", input.crm_type);
    const preset = CRM_PRESETS[input.crm_type];
    if (!("labels" in input)) put("labels = ?::jsonb", JSON.stringify(preset.labels));
    if (!("deal_stages" in input)) put("deal_stages = ?::jsonb", JSON.stringify(preset.stages));
  }
  if ("labels" in input) put("labels = ?::jsonb", JSON.stringify(validLabels(input.labels)));
  if ("deal_stages" in input) put("deal_stages = ?::jsonb", JSON.stringify(validStages(input.deal_stages)));
  if ("org_name" in input) put("org_name = ?", input.org_name ? String(input.org_name).trim().slice(0, 80) : null);
  if ("currency" in input) {
    const currency = String(input.currency ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new CrmError("currency must be a 3-letter code", 400);
    put("currency = ?", currency);
  }
  if (input.installed === true) sets.push("installed_at = coalesce(installed_at, now())");
  if (sets.length) {
    await executeQuery(`UPDATE crm_settings SET ${sets.join(", ")}, updated_at = now() WHERE id = 'default'`, params);
  }
  return readSettings();
}
