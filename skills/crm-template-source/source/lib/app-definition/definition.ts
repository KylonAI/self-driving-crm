import type { AppDefinition, EntityDefinition, FieldConfig, ManifestField } from "@/lib/app-definition/types";
import { type CrmEntitySpec, type CrmFieldSpec, CRM_ENTITIES, entitySpec } from "@/lib/crm/entities";

function fieldConfig(field: CrmFieldSpec): FieldConfig | undefined {
  switch (field.type) {
    case "select":
    case "multi_select":
      return { options: field.options ?? [] };
    case "user":
    case "multi_user":
      return { user_source: "workspace" };
    case "date":
      return { include_time: Boolean(field.includeTime), date_format: "YYYY-MM-DD" };
    case "currency":
      return { currency: "USD" };
    case "relation": {
      const target = field.relation ? entitySpec(field.relation) : undefined;
      return { relation_entity_id: field.relation, relation_label_field: target?.titleField ?? "name" };
    }
    default:
      return undefined;
  }
}

function manifestField(field: CrmFieldSpec): ManifestField {
  const config = fieldConfig(field);
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    ...(field.description ? { description: field.description } : {}),
    ...(field.required ? { required: true } : {}),
    ...(field.readOnly ? { readOnly: true } : {}),
    sortable: field.type !== "json" && field.type !== "attachment",
    ...(field.width ? { width: field.width } : {}),
    ...(config ? { config } : {}),
  };
}

function entityDefinition(spec: CrmEntitySpec): EntityDefinition {
  const recordPath = `${spec.apiPath}/{${spec.recordIdParam}}`;
  return {
    id: spec.id,
    label: spec.label,
    pluralLabel: spec.pluralLabel,
    description: spec.description,
    titleField: spec.titleField,
    table: spec.table,
    createdAtColumn: "created_at",
    updatedAtColumn: "updated_at",
    recordIdParam: spec.recordIdParam,
    api: {
      list: spec.apiPath,
      get: recordPath,
      create: spec.apiPath,
      update: recordPath,
      delete: recordPath,
    },
    listQueryParameters: [
      {
        name: "q",
        schema: { type: "string" },
        description: `Optional keyword search across ${spec.searchFields.join(", ")}.`,
      },
      {
        name: "filters",
        schema: { type: "string" },
        description:
          "Optional JSON array of { field_id, operator, value }. Operators: eq, neq, in (value is a non-empty array), contains, is_empty, is_not_empty, lt, lte, gt, gte. Relation fields filter by record id.",
      },
      {
        name: "sorts",
        schema: { type: "string" },
        description: "Optional JSON array of { field_id, direction } with direction asc or desc. Empty values sort last.",
      },
    ],
    fields: spec.fields.map(manifestField),
    relationships: spec.relationships,
  };
}

const error = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/CrmError" } } },
});

const intakeObject = (description: string) => ({ type: "object", additionalProperties: true, description });

export const appDefinition: AppDefinition = {
  dataViewer: { mode: "required" },
  app: {
    id: "replace_with_real_kylon_app_id",
    name: "CRM",
    description:
      "A blank CRM for B2B sales, VC deal flow, partnerships, recruiting or any relationship work. An Agent installs it with the bundled install-crm skill: asks the CRM type, brings in customer data the Room's Automations already hold, and helps each person connect their own email, calendar and meeting notes, with every sync writing through POST /api/intake.",
    version: "1.0.0",
    baseUrl: "https://replace-with-real-kylon-app-url.invalid",
    delegation: "live_human_turn",
  },
  entities: CRM_ENTITIES.map(entityDefinition),
  openapi: {
    tags: [{ name: "CRM", description: "Setup, intake and reports for the CRM." }],
    schemas: {
      CrmError: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      CrmStage: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          kind: { type: "string", enum: ["open", "won", "lost"] },
        },
        required: ["id", "label", "kind"],
      },
      CrmSettings: {
        type: "object",
        properties: {
          crm_type: { type: ["string", "null"], enum: ["b2b", "vc", "partners", "recruiting", "other", null] },
          org_name: { type: ["string", "null"] },
          labels: { type: "object", additionalProperties: { type: "string" } },
          deal_stages: { type: "array", items: { $ref: "#/components/schemas/CrmStage" } },
          currency: { type: "string" },
          amount_label: { type: "string" },
          installed_at: { type: ["string", "null"], format: "date-time" },
        },
      },
      CrmIntakeOutcome: {
        type: ["object", "null"],
        properties: {
          id: { type: "string" },
          created: { type: "boolean" },
          filled: { type: "array", items: { type: "string" } },
          duplicate: { type: "boolean" },
        },
      },
      CrmRecordList: {
        type: "object",
        properties: {
          total: { type: "integer" },
          records: { type: "array", items: { $ref: "#/components/schemas/AppRecordResponse" } },
        },
      },
    },
    paths: {
      "/api/settings": {
        get: {
          tags: ["CRM"],
          summary: "Read CRM settings",
          description:
            "The CRM type, what each object is called, the deal stages (id, label, kind open/won/lost) and when it was installed. Read this before writing deals: deal.stage must be one of deal_stages[].id.",
          responses: {
            "200": { description: "Settings.", content: { "application/json": { schema: { $ref: "#/components/schemas/CrmSettings" } } } },
          },
        },
        patch: {
          tags: ["CRM"],
          summary: "Change CRM settings",
          description:
            "Partial update. Setting crm_type also resets labels and deal_stages to that type's preset unless the same call sends them. installed true records when the install finished. Existing records are never changed by this call.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    crm_type: { type: "string", enum: ["b2b", "vc", "partners", "recruiting", "other"] },
                    org_name: { type: "string" },
                    labels: { type: "object", additionalProperties: { type: "string" } },
                    deal_stages: { type: "array", items: { $ref: "#/components/schemas/CrmStage" } },
                    currency: { type: "string", description: "Three-letter currency code." },
                    installed: { type: "boolean", description: "true once the person confirmed the CRM type during install." },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated settings.", content: { "application/json": { schema: { $ref: "#/components/schemas/CrmSettings" } } } },
            "400": error("Invalid value, such as an unknown CRM type or a stage without a label."),
          },
        },
      },
      "/api/intake": {
        post: {
          tags: ["CRM"],
          summary: "Write customer data into the CRM",
          description:
            "The single write door for Automations, forms and Agents. Send any of company, person, account, deal, activity and task in one call. Companies match by domain (given, from website, or from the person's work email), else by exact name; people match by email. Existing records only get their empty fields filled; a different non-empty value becomes an open Review item instead of overwriting. An activity with the same source + source_ref is recorded once: a repeat returns duplicate=true and changes nothing, so retries and backfills are safe. A deal matched by name keeps stage, amount and next step moving with the source.",
          "x-side-effects": "Creates or updates companies, people, accounts, deals, activities and follow-ups; may open review items; writes audit rows.",
          "x-idempotency": "Activities are idempotent on source + source_ref. Companies and people are matched before creation.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    source: { type: "string", description: "Who is sending this, such as the Automation's name. Required." },
                    source_ref: { type: "string", description: "The id of this item in the source system, such as a meeting or email id." },
                    company: intakeObject("Company fields (see the companies entity): name, domain, website, industry, country and so on."),
                    person: intakeObject("Person fields: name, email, title, phone, linkedin_url and so on."),
                    account: intakeObject("Account fields; name is required."),
                    deal: intakeObject("Deal fields; name is required. stage is a deal_stages id from GET /api/settings."),
                    activity: intakeObject("Activity fields; subject is required. kind: meeting, call, email, message, note, form or other. occurred_at is an ISO timestamp."),
                    task: intakeObject("Follow-up fields; title is required. due_date is YYYY-MM-DD; owner is a workspace member id."),
                  },
                  required: ["source"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "What was matched, created or filled.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      company: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      person: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      account: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      deal: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      activity: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      task: { $ref: "#/components/schemas/CrmIntakeOutcome" },
                      review_items: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
            "400": error("Missing source, nothing to write, or an invalid field value."),
          },
        },
      },
      "/api/context/{entity_id}/{record_id}": {
        get: {
          tags: ["CRM"],
          summary: "Read a record with everything linked to it",
          description:
            "For companies, people, accounts and deals: the record, its linked people, deals, accounts, follow-ups, list memberships and up to 30 recent activities, plus the last 20 audit rows. Read this before contacting a customer or changing a record instead of making several calls.",
          parameters: [
            { name: "entity_id", in: "path", required: true, schema: { type: "string", enum: ["companies", "people", "accounts", "deals"] } },
            { name: "record_id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Record context.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      record: { $ref: "#/components/schemas/AppRecordResponse" },
                      related: { type: "object", additionalProperties: { $ref: "#/components/schemas/CrmRecordList" } },
                      audit: { type: "array", items: { type: "object", additionalProperties: true } },
                    },
                  },
                },
              },
            },
            "404": error("No such record."),
          },
        },
      },
      "/api/insights": {
        get: {
          tags: ["CRM"],
          summary: "Pipeline and activity report",
          description: "Deals per stage with amounts, twelve weeks of new deals, meetings, messages and new people, open deals per owner, and headline totals.",
          responses: { "200": { description: "Report.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        },
      },
      "/api/home": {
        get: {
          tags: ["CRM"],
          summary: "Home page data",
          description: "The caller's open follow-ups (scope=everyone for the whole team), recent activities, deals closing soon and sidebar counts.",
          parameters: [{ name: "scope", in: "query", required: false, schema: { type: "string", enum: ["mine", "everyone"] } }],
          responses: { "200": { description: "Home data.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        },
      },
      "/api/counts": {
        get: {
          tags: ["CRM"],
          summary: "Record counts",
          description: "How many companies, people, accounts, deals and activities exist, follow-ups due, open review items and Automations still to connect.",
          responses: { "200": { description: "Counts.", content: { "application/json": { schema: { type: "object", additionalProperties: { type: "integer" } } } } } },
        },
      },
      "/api/quality": {
        get: {
          tags: ["CRM"],
          summary: "Field completeness",
          description: "For companies, people, accounts and deals: total records and how many have each field filled, plus counts of likely duplicate names.",
          responses: { "200": { description: "Quality report.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        },
      },
      "/api/data-sources": {
        get: {
          tags: ["CRM"],
          summary: "Data sources and how fresh they are",
          description:
            "Read only. connected: every sync_sources record (one connected account or service, its owner, status, last sync, items, last error). written: per source and object, how many records landed in total and in the last 7 days and when the newest arrived, counted from the records themselves. crm_type tells which kinds of source this CRM should cover.",
          responses: { "200": { description: "{ crm_type, connected, written }.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        },
      },
      "/api/review-items/{review_id}/resolve": {
        post: {
          tags: ["CRM"],
          summary: "Accept or dismiss a review item",
          description: "accept writes proposed_value into the field of the record the item is about, then closes it; dismiss only closes it.",
          "x-side-effects": "May update one record; closes the review item; writes audit rows.",
          parameters: [{ name: "review_id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { decision: { type: "string", enum: ["accept", "dismiss"] } }, required: ["decision"] } } },
          },
          responses: {
            "200": { description: "The closed item.", content: { "application/json": { schema: { $ref: "#/components/schemas/AppRecordResponse" } } } },
            "404": error("No such review item."),
            "409": error("Already resolved."),
          },
        },
      },
    },
  },
  automations: [],
};
