import "server-only";

import { queryRows, type DbRow } from "@/lib/db";
import { type CrmEntitySpec, accounts, activities, companies, deals, people, reviewItems, tasks } from "@/lib/crm/entities";
import { CrmError, createRecord, normalizeDomain, updateRecord, writeValues } from "@/lib/crm/server";

/**
 * The one door every Automation writes customer data through. It finds the
 * company by domain and the person by email before creating anything, fills
 * only empty fields on records that already exist, sends conflicting values
 * to Review instead of overwriting, and records each activity once per
 * source + source_ref.
 */

const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "163.com",
  "126.com",
]);

type Input = Record<string, unknown>;

export interface IntakeOutcome {
  id: string;
  created: boolean;
  filled: string[];
}

export interface IntakeResult {
  company: IntakeOutcome | null;
  person: IntakeOutcome | null;
  account: IntakeOutcome | null;
  deal: IntakeOutcome | null;
  activity: (IntakeOutcome & { duplicate: boolean }) | null;
  task: IntakeOutcome | null;
  review_items: string[];
}

function objectPart(body: Input, key: string): Input | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new CrmError(`${key} must be an object`, 400);
  return value as Input;
}

function emailDomain(email: unknown): string | null {
  if (typeof email !== "string" || !email.includes("@")) return null;
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return domain && !FREE_MAIL.has(domain) ? domain : null;
}

/** Fills the blanks of an existing record; a different non-empty value becomes a Review item. */
async function mergeInto(
  spec: CrmEntitySpec,
  existing: DbRow,
  incoming: Input,
  source: string,
  actor: string | null,
  reviews: string[],
): Promise<string[]> {
  const values = writeValues(spec, incoming, "update");
  const fill: Input = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    const current = existing[key];
    const empty = current === null || current === undefined || current === "";
    if (empty) {
      fill[key] = value;
      continue;
    }
    const field = spec.fields.find((item) => item.key === key);
    const shown = current instanceof Date ? current.toISOString().slice(0, field?.includeTime ? 19 : 10) : current;
    const numeric = field && ["number", "currency", "percent"].includes(field.type);
    const incomingShown = typeof value === "string" && field?.includeTime ? value.slice(0, 19) : value;
    const same = numeric
      ? Number(shown) === Number(value)
      : String(shown).toLowerCase() === String(incomingShown).toLowerCase();
    if (!same && key !== "source") {
      const title = `${spec.label} ${String(existing[spec.titleField] ?? existing.id)}: ${key} differs`;
      const review = await createRecord(
        reviewItems,
        {
          title,
          kind: "conflict",
          status: "open",
          entity: spec.id,
          record_id: String(existing.id),
          field: key,
          proposed_value: String(value),
          reason: `The CRM has "${String(shown)}"; ${source} sent "${String(value)}".`,
          source,
        },
        actor,
      );
      reviews.push(String(review.id));
    }
  }
  if (Object.keys(fill).length) await updateRecord(spec, String(existing.id), fill, actor);
  return Object.keys(fill);
}

async function findOne(sql: string, params: Array<string | null>): Promise<DbRow | null> {
  const rows = await queryRows<DbRow>(sql, params);
  return rows[0] ?? null;
}

export async function runIntake(body: Input, actor: string | null): Promise<IntakeResult> {
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim().slice(0, 120) : null;
  if (!source) throw new CrmError("source is required: name the Automation, form or person sending this", 400);
  const sourceRef = typeof body.source_ref === "string" && body.source_ref.trim() ? body.source_ref.trim().slice(0, 240) : null;
  const companyIn = objectPart(body, "company");
  const personIn = objectPart(body, "person");
  const accountIn = objectPart(body, "account");
  const dealIn = objectPart(body, "deal");
  const activityIn = objectPart(body, "activity");
  const taskIn = objectPart(body, "task");
  if (!companyIn && !personIn && !accountIn && !dealIn && !activityIn && !taskIn)
    throw new CrmError("Send at least one of company, person, account, deal, activity or task", 400);

  const reviews: string[] = [];
  const result: IntakeResult = { company: null, person: null, account: null, deal: null, activity: null, task: null, review_items: reviews };

  // Activities are idempotent: the same source + source_ref returns the first write and changes nothing.
  if (activityIn && sourceRef) {
    const existing = await findOne("SELECT id FROM crm_activities WHERE source = ? AND source_ref = ?", [source, sourceRef]);
    if (existing) {
      result.activity = { id: String(existing.id), created: false, filled: [], duplicate: true };
      return result;
    }
  }

  // Company: by domain (given, from its website, or from a work email), else by exact name.
  let companyId: string | null = null;
  const companyDomain =
    normalizeDomain(String(companyIn?.domain ?? "")) ??
    normalizeDomain(String(companyIn?.website ?? "")) ??
    emailDomain(personIn?.email);
  if (companyIn || companyDomain) {
    let existing = companyDomain ? await findOne("SELECT * FROM crm_companies WHERE lower(domain) = ?", [companyDomain]) : null;
    const name = typeof companyIn?.name === "string" ? companyIn.name.trim() : "";
    if (!existing && name) existing = await findOne("SELECT * FROM crm_companies WHERE lower(name) = lower(?) LIMIT 1", [name]);
    const data: Input = { ...(companyIn ?? {}), ...(companyDomain ? { domain: companyDomain } : {}), source };
    if (existing) {
      companyId = String(existing.id);
      result.company = { id: companyId, created: false, filled: await mergeInto(companies, existing, data, source, actor, reviews) };
    } else if (name) {
      const row = await createRecord(companies, data, actor);
      companyId = String(row.id);
      result.company = { id: companyId, created: true, filled: [] };
    }
  }

  // Person: by email, else a new record (a person without email cannot be matched later, so name is required).
  let personId: string | null = null;
  if (personIn) {
    const email = typeof personIn.email === "string" ? personIn.email.trim().toLowerCase() : "";
    const existing = email ? await findOne("SELECT * FROM crm_people WHERE lower(email) = ?", [email]) : null;
    const data: Input = { ...personIn, ...(companyId && !personIn.company_id ? { company_id: companyId } : {}), source };
    if (existing) {
      personId = String(existing.id);
      result.person = { id: personId, created: false, filled: await mergeInto(people, existing, data, source, actor, reviews) };
    } else {
      if (!data.name) data.name = email ? email.split("@")[0] : null;
      const row = await createRecord(people, data, actor);
      personId = String(row.id);
      result.person = { id: personId, created: true, filled: [] };
    }
    if (!companyId && existing?.company_id) companyId = String(existing.company_id);
  }

  // Account: by name within the company.
  let accountId: string | null = null;
  if (accountIn) {
    const name = typeof accountIn.name === "string" ? accountIn.name.trim() : "";
    if (!name) throw new CrmError("account.name is required", 400);
    const existing = await findOne(
      "SELECT * FROM crm_accounts WHERE lower(name) = lower(?) AND company_id IS NOT DISTINCT FROM ? LIMIT 1",
      [name, companyId],
    );
    const data: Input = { ...accountIn, ...(companyId ? { company_id: companyId } : {}), source };
    if (existing) {
      accountId = String(existing.id);
      result.account = { id: accountId, created: false, filled: await mergeInto(accounts, existing, data, source, actor, reviews) };
    } else {
      accountId = String((await createRecord(accounts, data, actor)).id);
      result.account = { id: accountId, created: true, filled: [] };
    }
  }

  // Deal: by name within the company.
  let dealId: string | null = null;
  if (dealIn) {
    const name = typeof dealIn.name === "string" ? dealIn.name.trim() : "";
    if (!name) throw new CrmError("deal.name is required", 400);
    const existing = await findOne(
      "SELECT * FROM crm_deals WHERE lower(name) = lower(?) AND company_id IS NOT DISTINCT FROM ? LIMIT 1",
      [name, companyId],
    );
    const links: Input = {
      ...(companyId ? { company_id: companyId } : {}),
      ...(personId ? { person_id: personId } : {}),
      ...(accountId ? { account_id: accountId } : {}),
    };
    if (existing) {
      dealId = String(existing.id);
      // Stage and amount move forward with the source; other fields only fill blanks.
      const { stage, amount, next_step, next_step_date, ...rest } = dealIn;
      const moving: Input = Object.fromEntries(
        Object.entries({ stage, amount, next_step, next_step_date }).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(moving).length) await updateRecord(deals, dealId, moving, actor);
      const filled = await mergeInto(deals, existing, { ...rest, ...links, source }, source, actor, reviews);
      result.deal = { id: dealId, created: false, filled: [...Object.keys(moving), ...filled] };
    } else {
      dealId = String((await createRecord(deals, { ...dealIn, ...links, source }, actor)).id);
      result.deal = { id: dealId, created: true, filled: [] };
    }
  }

  if (activityIn) {
    const data: Input = {
      kind: "other",
      ...activityIn,
      ...(personId ? { person_id: personId } : {}),
      ...(companyId ? { company_id: companyId } : {}),
      ...(dealId ? { deal_id: dealId } : {}),
      ...(accountId ? { account_id: accountId } : {}),
      source,
      ...(sourceRef ? { source_ref: sourceRef } : {}),
    };
    if (!data.subject) throw new CrmError("activity.subject is required", 400);
    const row = await createRecord(activities, data, actor);
    result.activity = { id: String(row.id), created: true, filled: [], duplicate: false };
  }

  if (taskIn) {
    const title = typeof taskIn.title === "string" ? taskIn.title.trim() : "";
    if (!title) throw new CrmError("task.title is required", 400);
    const existing = await findOne(
      "SELECT id FROM crm_tasks WHERE status = 'open' AND lower(title) = lower(?) AND person_id IS NOT DISTINCT FROM ? AND company_id IS NOT DISTINCT FROM ? LIMIT 1",
      [title, personId, companyId],
    );
    if (existing) {
      result.task = { id: String(existing.id), created: false, filled: [] };
    } else {
      const row = await createRecord(
        tasks,
        {
          status: "open",
          ...taskIn,
          ...(personId ? { person_id: personId } : {}),
          ...(companyId ? { company_id: companyId } : {}),
          ...(dealId ? { deal_id: dealId } : {}),
          ...(accountId ? { account_id: accountId } : {}),
          source,
        },
        actor,
      );
      result.task = { id: String(row.id), created: true, filled: [] };
    }
  }

  return result;
}
