import type { FieldType, RelationshipManifest, SelectOption } from "@/lib/app-definition/types";
import { SOURCE_KINDS, SOURCES } from "@/lib/crm/sources";

/**
 * The CRM's objects, in one place. The App definition, the list/get/create/
 * update API, the tables and the record pages all read these specs, so a field
 * added here shows up everywhere it should.
 */

export type EntityId =
  | "companies"
  | "people"
  | "accounts"
  | "deals"
  | "activities"
  | "tasks"
  | "lists"
  | "list_members"
  | "review_items"
  | "sync_sources";

export interface CrmFieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  description?: string;
  width?: number;
  options?: SelectOption[];
  /** For relation fields: the entity the id points at. */
  relation?: EntityId;
  /** Shown in the default table. */
  inTable?: boolean;
  /** Date fields that carry a time. */
  includeTime?: boolean;
}

export interface CrmEntitySpec {
  id: EntityId;
  label: string;
  pluralLabel: string;
  description: string;
  table: string;
  titleField: string;
  apiPath: string;
  recordIdParam: string;
  idPrefix: string;
  searchFields: string[];
  defaultSort: { field: string; direction: "asc" | "desc" };
  fields: CrmFieldSpec[];
  relationships: RelationshipManifest[];
}

const opt = (...pairs: Array<[string, string, string?]>): SelectOption[] =>
  pairs.map(([id, label, color]) => ({ id, label, ...(color ? { color } : {}) }));

export const RELATIONSHIP_OPTIONS = opt(
  ["prospect", "Prospect", "blue"],
  ["customer", "Customer", "green"],
  ["partner", "Partner", "purple"],
  ["investor", "Investor", "amber"],
  ["portfolio", "Portfolio", "green"],
  ["vendor", "Vendor", "gray"],
  ["other", "Other", "gray"],
);

export const SIZE_OPTIONS = opt(
  ["1_10", "1-10"],
  ["11_50", "11-50"],
  ["51_200", "51-200"],
  ["201_1000", "201-1,000"],
  ["1000_plus", "1,000+"],
);

export const PERSON_ROLE_OPTIONS = opt(
  ["lead", "Lead", "blue"],
  ["contact", "Contact", "gray"],
  ["champion", "Champion", "green"],
  ["decision_maker", "Decision maker", "purple"],
  ["founder", "Founder", "amber"],
  ["investor", "Investor", "amber"],
  ["candidate", "Candidate", "blue"],
  ["partner", "Partner", "purple"],
  ["other", "Other", "gray"],
);

export const OUTREACH_OPTIONS = opt(
  ["not_contacted", "Not contacted", "gray"],
  ["contacted", "Contacted", "blue"],
  ["replied", "Replied", "green"],
  ["meeting", "Meeting booked", "green"],
  ["do_not_contact", "Do not contact", "red"],
);

export const ACCOUNT_STATUS_OPTIONS = opt(
  ["onboarding", "Onboarding", "blue"],
  ["active", "Active", "green"],
  ["at_risk", "At risk", "orange"],
  ["paused", "Paused", "gray"],
  ["churned", "Churned", "red"],
  ["exited", "Exited", "purple"],
);

export const HEALTH_OPTIONS = opt(["good", "Good", "green"], ["watch", "Watch", "amber"], ["poor", "Poor", "red"]);

export const ACTIVITY_KIND_OPTIONS = opt(
  ["meeting", "Meeting", "green"],
  ["call", "Call", "blue"],
  ["email", "Email", "purple"],
  ["message", "Message", "cyan"],
  ["note", "Note", "gray"],
  ["form", "Form", "amber"],
  ["other", "Other", "gray"],
);

export const TASK_STATUS_OPTIONS = opt(["open", "Open", "blue"], ["done", "Done", "green"], ["skipped", "Skipped", "gray"]);

export const LIST_KIND_OPTIONS = opt(["people", "People"], ["companies", "Companies"]);

export const REVIEW_KIND_OPTIONS = opt(
  ["duplicate", "Possible duplicate", "orange"],
  ["missing", "Missing information", "amber"],
  ["conflict", "Conflicting values", "red"],
  ["suggestion", "Suggested change", "blue"],
);

export const REVIEW_STATUS_OPTIONS = opt(["open", "Open", "blue"], ["accepted", "Accepted", "green"], ["dismissed", "Dismissed", "gray"]);

export const SYNC_STATUS_OPTIONS = opt(
  ["connecting", "Connecting", "blue"],
  ["syncing", "Syncing", "green"],
  ["paused", "Paused", "gray"],
  ["error", "Needs attention", "red"],
  ["disconnected", "Disconnected", "gray"],
);

export const SOURCE_OPTIONS: SelectOption[] = SOURCES.map((source) => ({ id: source.id, label: source.label }));

export const SOURCE_KIND_OPTIONS: SelectOption[] = (Object.keys(SOURCE_KINDS) as Array<keyof typeof SOURCE_KINDS>).map((id) => ({
  id,
  label: SOURCE_KINDS[id].label,
}));

export const TARGET_ENTITY_OPTIONS = opt(
  ["people", "People"],
  ["companies", "Companies"],
  ["accounts", "Accounts"],
  ["deals", "Deals"],
  ["activities", "Activities"],
  ["tasks", "Follow-ups"],
);

const owner = (key = "owner", label = "Owner"): CrmFieldSpec => ({ key, label, type: "user", width: 160, inTable: true });
const rel = (key: string, label: string, relation: EntityId, inTable = true): CrmFieldSpec => ({
  key,
  label,
  type: "relation",
  relation,
  width: 180,
  inTable,
});
const stageDescription =
  "Stage id from the pipeline set in Setup (GET /api/settings returns deal_stages with id, label and kind open/won/lost).";

export const companies: CrmEntitySpec = {
  id: "companies",
  label: "Company",
  pluralLabel: "Companies",
  description:
    "Organizations: customers, prospects, startups, partners or clients depending on the CRM type. Matched by domain, so one company has one record.",
  table: "crm_companies",
  titleField: "name",
  apiPath: "/api/companies",
  recordIdParam: "company_id",
  idPrefix: "co",
  searchFields: ["name", "domain", "industry", "city"],
  defaultSort: { field: "updated_at", direction: "desc" },
  fields: [
    { key: "name", label: "Name", type: "text", required: true, width: 220, inTable: true },
    { key: "domain", label: "Domain", type: "text", width: 170, inTable: true, description: "Bare domain such as example.com; the matching key." },
    { key: "relationship", label: "Relationship", type: "select", options: RELATIONSHIP_OPTIONS, width: 140, inTable: true },
    { key: "industry", label: "Industry", type: "text", width: 150, inTable: true },
    { key: "size_band", label: "Size", type: "select", options: SIZE_OPTIONS, width: 110, inTable: true },
    { key: "country", label: "Country", type: "text", width: 130, inTable: true },
    { key: "city", label: "City", type: "text", width: 130 },
    owner(),
    { key: "website", label: "Website", type: "url", width: 200 },
    { key: "linkedin_url", label: "LinkedIn", type: "url", width: 200 },
    { key: "logo_url", label: "Logo", type: "url", width: 200 },
    { key: "description", label: "About", type: "text", width: 300 },
    { key: "source", label: "Source", type: "text", width: 140, description: "Where the record came from, such as an Automation name or a form." },
    { key: "notes", label: "Notes", type: "text", width: 300 },
  ],
  relationships: [
    { key: "people", type: "has_many", entityId: "people", foreignKey: "company_id", label: "People" },
    { key: "deals", type: "has_many", entityId: "deals", foreignKey: "company_id", label: "Deals" },
    { key: "accounts", type: "has_many", entityId: "accounts", foreignKey: "company_id", label: "Accounts" },
  ],
};

export const people: CrmEntitySpec = {
  id: "people",
  label: "Person",
  pluralLabel: "People",
  description: "Every person you deal with. Matched by email, so one person has one record.",
  table: "crm_people",
  titleField: "name",
  apiPath: "/api/people",
  recordIdParam: "person_id",
  idPrefix: "pe",
  searchFields: ["name", "email", "title", "location"],
  defaultSort: { field: "updated_at", direction: "desc" },
  fields: [
    { key: "name", label: "Name", type: "text", required: true, width: 200, inTable: true },
    { key: "email", label: "Email", type: "email", width: 220, inTable: true, description: "The matching key." },
    { key: "title", label: "Title", type: "text", width: 170, inTable: true },
    rel("company_id", "Company", "companies"),
    { key: "role", label: "Role", type: "select", options: PERSON_ROLE_OPTIONS, width: 140, inTable: true },
    { key: "outreach_status", label: "Outreach", type: "select", options: OUTREACH_OPTIONS, width: 150, inTable: true },
    owner(),
    { key: "last_contacted_at", label: "Last contacted", type: "date", width: 140, inTable: true },
    { key: "phone", label: "Phone", type: "text", width: 150 },
    { key: "location", label: "Location", type: "text", width: 160 },
    { key: "linkedin_url", label: "LinkedIn", type: "url", width: 200 },
    { key: "x_url", label: "X", type: "url", width: 200 },
    { key: "avatar_url", label: "Photo", type: "url", width: 200 },
    { key: "source", label: "Source", type: "text", width: 140 },
    { key: "notes", label: "Notes", type: "text", width: 300 },
  ],
  relationships: [
    { key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" },
    { key: "deals", type: "has_many", entityId: "deals", foreignKey: "person_id", label: "Deals" },
  ],
};

export const accounts: CrmEntitySpec = {
  id: "accounts",
  label: "Account",
  pluralLabel: "Accounts",
  description:
    "A relationship you already have: a paying customer, a portfolio company, a live partner or a client engagement. Belongs to one company.",
  table: "crm_accounts",
  titleField: "name",
  apiPath: "/api/accounts",
  recordIdParam: "account_id",
  idPrefix: "ac",
  searchFields: ["name", "plan"],
  defaultSort: { field: "updated_at", direction: "desc" },
  fields: [
    { key: "name", label: "Name", type: "text", required: true, width: 220, inTable: true },
    rel("company_id", "Company", "companies"),
    { key: "status", label: "Status", type: "select", options: ACCOUNT_STATUS_OPTIONS, width: 130, inTable: true },
    { key: "health", label: "Health", type: "select", options: HEALTH_OPTIONS, width: 110, inTable: true },
    { key: "plan", label: "Plan", type: "text", width: 130, inTable: true },
    { key: "value", label: "Value", type: "currency", width: 120, inTable: true, description: "Recurring revenue, invested amount or fee, by CRM type." },
    owner("account_manager", "Account manager"),
    { key: "start_date", label: "Start date", type: "date", width: 130 },
    { key: "renewal_date", label: "Renewal date", type: "date", width: 130, inTable: true },
    { key: "source", label: "Source", type: "text", width: 140 },
    { key: "notes", label: "Notes", type: "text", width: 300 },
  ],
  relationships: [{ key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" }],
};

export const deals: CrmEntitySpec = {
  id: "deals",
  label: "Deal",
  pluralLabel: "Deals",
  description: "One opportunity moving through the pipeline: a sale, an investment, a partnership or a placement.",
  table: "crm_deals",
  titleField: "name",
  apiPath: "/api/deals",
  recordIdParam: "deal_id",
  idPrefix: "de",
  searchFields: ["name", "next_step"],
  defaultSort: { field: "updated_at", direction: "desc" },
  fields: [
    { key: "name", label: "Name", type: "text", required: true, width: 220, inTable: true },
    { key: "stage", label: "Stage", type: "text", width: 140, inTable: true, description: stageDescription },
    { key: "amount", label: "Amount", type: "currency", width: 120, inTable: true },
    rel("company_id", "Company", "companies"),
    rel("person_id", "Contact", "people"),
    rel("account_id", "Account", "accounts", false),
    owner(),
    { key: "close_date", label: "Expected close", type: "date", width: 140, inTable: true },
    { key: "probability", label: "Probability", type: "percent", width: 110 },
    { key: "next_step", label: "Next step", type: "text", width: 220, inTable: true },
    { key: "next_step_date", label: "Next step date", type: "date", width: 140 },
    { key: "lost_reason", label: "Lost reason", type: "text", width: 200 },
    { key: "source", label: "Source", type: "text", width: 140 },
    { key: "notes", label: "Notes", type: "text", width: 300 },
  ],
  relationships: [
    { key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" },
    { key: "person", type: "belongs_to", entityId: "people", foreignKey: "person_id", label: "Contact" },
    { key: "account", type: "belongs_to", entityId: "accounts", foreignKey: "account_id", label: "Account" },
  ],
};

export const activities: CrmEntitySpec = {
  id: "activities",
  label: "Activity",
  pluralLabel: "Activities",
  description:
    "Everything that happened with a customer: meetings, calls, emails, messages, notes, forms. source + source_ref make writes from Automations idempotent.",
  table: "crm_activities",
  titleField: "subject",
  apiPath: "/api/activities",
  recordIdParam: "activity_id",
  idPrefix: "act",
  searchFields: ["subject", "summary"],
  defaultSort: { field: "occurred_at", direction: "desc" },
  fields: [
    { key: "subject", label: "Subject", type: "text", required: true, width: 260, inTable: true },
    { key: "kind", label: "Kind", type: "select", options: ACTIVITY_KIND_OPTIONS, width: 110, inTable: true },
    { key: "occurred_at", label: "When", type: "date", includeTime: true, width: 160, inTable: true },
    rel("person_id", "Person", "people"),
    rel("company_id", "Company", "companies"),
    rel("deal_id", "Deal", "deals", false),
    rel("account_id", "Account", "accounts", false),
    { key: "summary", label: "Summary", type: "text", width: 320 },
    owner("recorded_by", "Recorded by"),
    { key: "source", label: "Source", type: "text", width: 160, inTable: true, description: "Who or what wrote it, such as an Automation name." },
    { key: "source_ref", label: "Source reference", type: "text", width: 180, description: "The id in the source system; with source it keeps repeated writes from duplicating." },
  ],
  relationships: [
    { key: "person", type: "belongs_to", entityId: "people", foreignKey: "person_id", label: "Person" },
    { key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" },
    { key: "deal", type: "belongs_to", entityId: "deals", foreignKey: "deal_id", label: "Deal" },
    { key: "account", type: "belongs_to", entityId: "accounts", foreignKey: "account_id", label: "Account" },
  ],
};

export const tasks: CrmEntitySpec = {
  id: "tasks",
  label: "Follow-up",
  pluralLabel: "Follow-ups",
  description: "Something someone owes a customer, with a due date.",
  table: "crm_tasks",
  titleField: "title",
  apiPath: "/api/tasks",
  recordIdParam: "task_id",
  idPrefix: "tk",
  searchFields: ["title", "notes"],
  defaultSort: { field: "due_date", direction: "asc" },
  fields: [
    { key: "title", label: "Follow-up", type: "text", required: true, width: 280, inTable: true },
    { key: "status", label: "Status", type: "select", options: TASK_STATUS_OPTIONS, width: 110, inTable: true },
    { key: "due_date", label: "Due", type: "date", width: 130, inTable: true },
    owner(),
    rel("person_id", "Person", "people"),
    rel("company_id", "Company", "companies"),
    rel("deal_id", "Deal", "deals", false),
    rel("account_id", "Account", "accounts", false),
    { key: "notes", label: "Notes", type: "text", width: 300 },
    { key: "source", label: "Source", type: "text", width: 140 },
  ],
  relationships: [
    { key: "person", type: "belongs_to", entityId: "people", foreignKey: "person_id", label: "Person" },
    { key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" },
    { key: "deal", type: "belongs_to", entityId: "deals", foreignKey: "deal_id", label: "Deal" },
    { key: "account", type: "belongs_to", entityId: "accounts", foreignKey: "account_id", label: "Account" },
  ],
};

export const lists: CrmEntitySpec = {
  id: "lists",
  label: "List",
  pluralLabel: "Lists",
  description: "A named set of people or companies, such as an event guest list or an outreach batch.",
  table: "crm_lists",
  titleField: "name",
  apiPath: "/api/lists",
  recordIdParam: "list_id",
  idPrefix: "ls",
  searchFields: ["name", "description"],
  defaultSort: { field: "updated_at", direction: "desc" },
  fields: [
    { key: "name", label: "Name", type: "text", required: true, width: 240, inTable: true },
    { key: "kind", label: "Holds", type: "select", options: LIST_KIND_OPTIONS, width: 120, inTable: true },
    { key: "description", label: "Description", type: "text", width: 320, inTable: true },
    owner(),
  ],
  relationships: [{ key: "members", type: "has_many", entityId: "list_members", foreignKey: "list_id", label: "Members" }],
};

export const listMembers: CrmEntitySpec = {
  id: "list_members",
  label: "List member",
  pluralLabel: "List members",
  description: "One person or company on a list.",
  table: "crm_list_members",
  titleField: "label",
  apiPath: "/api/list-members",
  recordIdParam: "member_id",
  idPrefix: "lm",
  searchFields: ["label"],
  defaultSort: { field: "created_at", direction: "desc" },
  fields: [
    { key: "label", label: "Name", type: "text", required: true, width: 220, inTable: true },
    rel("list_id", "List", "lists"),
    rel("person_id", "Person", "people"),
    rel("company_id", "Company", "companies"),
  ],
  relationships: [
    { key: "list", type: "belongs_to", entityId: "lists", foreignKey: "list_id", label: "List" },
    { key: "person", type: "belongs_to", entityId: "people", foreignKey: "person_id", label: "Person" },
    { key: "company", type: "belongs_to", entityId: "companies", foreignKey: "company_id", label: "Company" },
  ],
};

export const reviewItems: CrmEntitySpec = {
  id: "review_items",
  label: "Review item",
  pluralLabel: "Review items",
  description:
    "A change the CRM is not sure about, waiting for a person: possible duplicates, conflicting values from two sources, missing information.",
  table: "crm_review_items",
  titleField: "title",
  apiPath: "/api/review-items",
  recordIdParam: "review_id",
  idPrefix: "rv",
  searchFields: ["title", "reason"],
  defaultSort: { field: "created_at", direction: "desc" },
  fields: [
    { key: "title", label: "Item", type: "text", required: true, width: 280, inTable: true },
    { key: "kind", label: "Kind", type: "select", options: REVIEW_KIND_OPTIONS, width: 150, inTable: true },
    { key: "status", label: "Status", type: "select", options: REVIEW_STATUS_OPTIONS, width: 110, inTable: true },
    { key: "entity", label: "Object", type: "select", options: TARGET_ENTITY_OPTIONS, width: 120, inTable: true },
    { key: "record_id", label: "Record id", type: "text", width: 140 },
    { key: "field", label: "Field", type: "text", width: 120 },
    { key: "proposed_value", label: "Proposed value", type: "text", width: 200 },
    { key: "reason", label: "Why", type: "text", width: 300, inTable: true },
    { key: "source", label: "Source", type: "text", width: 140, inTable: true },
    owner("resolved_by", "Resolved by"),
    { key: "resolved_at", label: "Resolved at", type: "date", includeTime: true, width: 160 },
  ],
  relationships: [],
};

export const syncSources: CrmEntitySpec = {
  id: "sync_sources",
  label: "Data source",
  pluralLabel: "Data sources",
  description:
    "One connected account or service feeding the CRM, such as one person's Gmail or the team's Stripe. Each has its own sync Automation, run under the owner's own access; the Automation updates last_synced_at, items and status here after every run.",
  table: "crm_sync_sources",
  titleField: "label",
  apiPath: "/api/sync-sources",
  recordIdParam: "source_id",
  idPrefix: "src",
  searchFields: ["label", "account_label", "notes"],
  defaultSort: { field: "label", direction: "asc" },
  fields: [
    { key: "label", label: "Data source", type: "text", required: true, width: 240, inTable: true },
    { key: "source", label: "Service", type: "select", options: SOURCE_OPTIONS, width: 150, inTable: true },
    { key: "kind", label: "Kind", type: "select", options: SOURCE_KIND_OPTIONS, width: 140, inTable: true },
    owner("owner", "Connected by"),
    { key: "shared", label: "Team account", type: "checkbox", width: 120, description: "A shared inbox or team account rather than one person's." },
    { key: "account_label", label: "Account", type: "text", width: 200, inTable: true, description: "Display name of the account, such as the mailbox address. Never a token or id." },
    { key: "automation_id", label: "Sync Automation", type: "text", width: 160, description: "The Automation that runs this sync." },
    { key: "status", label: "Status", type: "select", options: SYNC_STATUS_OPTIONS, width: 140, inTable: true },
    { key: "scope", label: "Sync scope", type: "json", width: 200, description: "What is synced: { external_only, skip_domains[], store_body, backfill_days }." },
    { key: "last_synced_at", label: "Last synced", type: "date", includeTime: true, width: 160, inTable: true },
    { key: "items_last_run", label: "Items last run", type: "number", width: 120 },
    { key: "items_total", label: "Items total", type: "number", width: 120, inTable: true },
    { key: "last_error", label: "Last error", type: "text", width: 260 },
    { key: "notes", label: "Notes", type: "text", width: 300 },
  ],
  relationships: [],
};

export const CRM_ENTITIES: CrmEntitySpec[] = [
  companies,
  people,
  accounts,
  deals,
  activities,
  tasks,
  lists,
  listMembers,
  reviewItems,
  syncSources,
];

export function entitySpec(id: string): CrmEntitySpec | undefined {
  return CRM_ENTITIES.find((entity) => entity.id === id);
}

export function optionLabel(options: SelectOption[] | undefined, value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return options?.find((option) => option.id === value)?.label ?? value;
}
