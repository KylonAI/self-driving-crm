import type ts from "typescript";
import { createRequire } from "node:module";

import type {
  AppAutomationChangePredicate,
  AppAutomationDeclaration,
  AppAutomationTarget,
  AppAutomationTrigger,
  AppContractEntity,
  AppContractField,
  AppDataModel,
  AppManifest,
  FieldConfig,
} from "@/lib/app-definition/types";

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const API_PATH_PARAMETER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const MAX_ENTITIES = 50;
const MAX_FIELDS_PER_ENTITY = 200;
const MAX_FIELD_CONFIG_BYTES = 64 * 1024;
const MAX_FIELD_OPTIONS = 200;
const MAX_FIELD_USERS = 1_000;
const MAX_CONFIG_STRING_CHARS = 256;
const FIELD_TYPES = new Set([
  "text",
  "number",
  "currency",
  "percent",
  "select",
  "multi_select",
  "date",
  "user",
  "multi_user",
  "checkbox",
  "url",
  "email",
  "attachment",
  "relation",
  "json",
]);
const FIELD_CONFIG_KEYS = new Set([
  "options",
  "user_source",
  "users",
  "currency",
  "include_time",
  "date_format",
  "max_visible",
  "relation_entity_id",
  "relation_label_field",
  "attachment",
]);
const DATE_FORMATS = new Set(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "MMM D, YYYY"]);
const API_METHODS = {
  list: "get",
  get: "get",
  create: "post",
  update: "patch",
  delete: "delete",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSafeIdentifier(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!SAFE_IDENTIFIER.test(text)) throw new Error(`${label} must be a safe identifier.`);
  return text;
}

function validateOptionalText(value: unknown, label: string): void {
  if (value === undefined) return;
  const text = requireText(value, label).trim();
  if (text.length > MAX_CONFIG_STRING_CHARS) {
    throw new Error(`${label} cannot exceed ${MAX_CONFIG_STRING_CHARS} characters.`);
  }
}

function validateFieldConfig(field: AppContractField, entityId: string): void {
  if (!field.config) return;
  const label = `entity ${entityId} field ${field.id}.config`;
  const config = field.config as FieldConfig & Record<string, unknown>;
  const encoded = JSON.stringify(config);
  if (Buffer.byteLength(encoded, "utf8") > MAX_FIELD_CONFIG_BYTES) {
    throw new Error(`${label} cannot exceed ${MAX_FIELD_CONFIG_BYTES} bytes.`);
  }
  for (const key of Object.keys(config)) {
    if (!FIELD_CONFIG_KEYS.has(key)) throw new Error(`${label}.${key} is unsupported.`);
  }
  if (config.options !== undefined) {
    if (!Array.isArray(config.options)) throw new Error(`${label}.options must be an array.`);
    if (config.options.length > MAX_FIELD_OPTIONS) {
      throw new Error(`${label}.options cannot have more than ${MAX_FIELD_OPTIONS} items.`);
    }
    const optionIds = new Set<string>();
    for (const [index, option] of config.options.entries()) {
      const optionId = requireText(option?.id, `${label}.options[${index}].id`);
      requireText(option?.label, `${label}.options[${index}].label`);
      if (optionIds.has(optionId)) throw new Error(`${label} has duplicate option id ${optionId}.`);
      optionIds.add(optionId);
      validateOptionalText(option?.color, `${label}.options[${index}].color`);
    }
  }
  if (config.users !== undefined) {
    if (!Array.isArray(config.users)) throw new Error(`${label}.users must be an array.`);
    if (config.users.length > MAX_FIELD_USERS) {
      throw new Error(`${label}.users cannot have more than ${MAX_FIELD_USERS} items.`);
    }
    const userIds = new Set<string>();
    for (const [index, user] of config.users.entries()) {
      const userId = requireText(user?.id, `${label}.users[${index}].id`);
      requireText(user?.name, `${label}.users[${index}].name`);
      if (userIds.has(userId)) throw new Error(`${label} has duplicate user id ${userId}.`);
      userIds.add(userId);
      validateOptionalText(user?.email, `${label}.users[${index}].email`);
      validateOptionalText(user?.avatar_url, `${label}.users[${index}].avatar_url`);
    }
  }
  if (config.user_source !== undefined && config.user_source !== "workspace" && config.user_source !== "app") {
    throw new Error(`${label}.user_source must be workspace or app.`);
  }
  if (config.currency !== undefined && !/^[A-Z]{3}$/.test(config.currency)) {
    throw new Error(`${label}.currency must be a 3-letter ISO currency code.`);
  }
  if (config.include_time !== undefined && typeof config.include_time !== "boolean") {
    throw new Error(`${label}.include_time must be a boolean.`);
  }
  if (config.date_format !== undefined && !DATE_FORMATS.has(config.date_format)) {
    throw new Error(`${label}.date_format is unsupported.`);
  }
  if (
    config.max_visible !== undefined &&
    (!Number.isInteger(config.max_visible) || config.max_visible < 1 || config.max_visible > 50)
  ) {
    throw new Error(`${label}.max_visible must be an integer from 1 to 50.`);
  }
  validateOptionalText(config.relation_entity_id, `${label}.relation_entity_id`);
  validateOptionalText(config.relation_label_field, `${label}.relation_label_field`);
}

function apiPath(pathOrConfig: string | { path: string }): string {
  return typeof pathOrConfig === "string" ? pathOrConfig : pathOrConfig.path;
}

function validateApiPath(path: unknown, label: string, recordPath = false): string {
  const text = requireText(path, label);
  if (!text.startsWith("/")) throw new Error(`${label} must be a relative API path.`);
  if (recordPath) {
    const parameters = [...text.matchAll(API_PATH_PARAMETER_PATTERN)];
    if (parameters.length !== 1) {
      throw new Error(`${label} must include exactly one record id path parameter.`);
    }
  }
  return text;
}

function validateEntity(entity: AppContractEntity): void {
  const entityId = requireSafeIdentifier(entity.id, "entity.id");
  requireText(entity.label, `entity ${entityId}.label`);
  const recordIdField = requireSafeIdentifier(entity.record_id_field, `entity ${entityId}.record_id_field`);
  const titleField = requireSafeIdentifier(entity.title_field, `entity ${entityId}.title_field`);
  if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
    throw new Error(`entity ${entityId}.fields must include at least one field.`);
  }
  if (entity.fields.length > MAX_FIELDS_PER_ENTITY) {
    throw new Error(`entity ${entityId}.fields cannot exceed ${MAX_FIELDS_PER_ENTITY} fields.`);
  }
  const fieldIds = new Set<string>();
  for (const field of entity.fields) {
    const fieldId = requireSafeIdentifier(field.id, `entity ${entityId}.field.id`);
    requireText(field.label, `entity ${entityId}.field ${fieldId}.label`);
    if (field.description !== undefined && typeof field.description !== "string") {
      throw new Error(`entity ${entityId} field ${fieldId}.description must be a string.`);
    }
    if (!FIELD_TYPES.has(field.type)) throw new Error(`entity ${entityId} field ${fieldId}.type is unsupported.`);
    if (fieldIds.has(fieldId)) throw new Error(`entity ${entityId} has duplicate field ${fieldId}.`);
    fieldIds.add(fieldId);
    if (field.read_only !== undefined && typeof field.read_only !== "boolean") {
      throw new Error(`entity ${entityId} field ${fieldId}.read_only must be a boolean.`);
    }
    validateFieldConfig(field, entityId);
  }
  if (!fieldIds.has(recordIdField)) throw new Error(`entity ${entityId}.record_id_field must reference a declared field.`);
  if (!fieldIds.has(titleField)) throw new Error(`entity ${entityId}.title_field must reference a declared field.`);

  if (entity.api) {
    validateApiPath(entity.api.get, `entity ${entityId}.api.get`, true);
    if (entity.api.list !== undefined) validateApiPath(entity.api.list, `entity ${entityId}.api.list`);
    if (entity.api.create !== undefined) validateApiPath(apiPath(entity.api.create), `entity ${entityId}.api.create`);
    if (entity.api.update !== undefined) validateApiPath(entity.api.update, `entity ${entityId}.api.update`, true);
    if (entity.api.delete !== undefined) validateApiPath(entity.api.delete, `entity ${entityId}.api.delete`, true);
  }
  for (const relationship of entity.relationships ?? []) {
    requireText(relationship.id, `entity ${entityId}.relationship.id`);
    requireText(relationship.entity_id, `entity ${entityId}.relationship.entity_id`);
  }
}

function validateDataModel(dataModel: AppDataModel, manifest: AppManifest): void {
  if (dataModel.schema_version !== "kylon.app_data_model.v1") {
    throw new Error("data_model.schema_version must be kylon.app_data_model.v1.");
  }
  if (!Array.isArray(dataModel.entities) || dataModel.entities.length === 0) {
    throw new Error("data_model.entities must include at least one entity.");
  }
  const manifestEntities = new Map(manifest.data.entities.map((entity) => [entity.id, entity]));
  const entityIds = new Set<string>();
  for (const entity of dataModel.entities) {
    const entityId = requireSafeIdentifier(entity.id, "data_model entity.id");
    if (entityIds.has(entityId)) throw new Error(`data_model duplicates entity ${entityId}.`);
    entityIds.add(entityId);
    if (!manifestEntities.has(entityId)) throw new Error(`data_model entity ${entityId} is not in manifest.`);
    requireSafeIdentifier(entity.table, `data_model entity ${entityId}.table`);
    if (entity.id_column) requireSafeIdentifier(entity.id_column, `data_model entity ${entityId}.id_column`);
    if (entity.created_at_column) requireSafeIdentifier(entity.created_at_column, `data_model entity ${entityId}.created_at_column`);
    if (entity.updated_at_column) requireSafeIdentifier(entity.updated_at_column, `data_model entity ${entityId}.updated_at_column`);
    if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
      throw new Error(`data_model entity ${entityId}.fields must include at least one mapping.`);
    }
    const manifestFields = new Set(manifestEntities.get(entityId)?.fields.map((field) => field.id));
    const fieldIds = new Set<string>();
    for (const field of entity.fields) {
      const fieldId = requireSafeIdentifier(field.id, `data_model entity ${entityId}.field.id`);
      requireSafeIdentifier(field.column, `data_model entity ${entityId}.field ${fieldId}.column`);
      if (fieldIds.has(fieldId)) throw new Error(`data_model entity ${entityId} duplicates field ${fieldId}.`);
      fieldIds.add(fieldId);
      if (!manifestFields.has(fieldId)) throw new Error(`data_model field ${entityId}.${fieldId} is not in manifest.`);
    }
  }
}

function validateOpenApiCoverage(manifest: AppManifest, openapi: Record<string, unknown>): void {
  const info = isRecord(openapi.info) ? openapi.info : null;
  if (info && typeof info.version === "string" && info.version !== manifest.app.version) {
    throw new Error("openapi is stale: info.version does not match manifest.app.version.");
  }
  const paths = isRecord(openapi.paths) ? openapi.paths : {};
  for (const entity of manifest.data.entities) {
    for (const [name, pathOrConfig] of Object.entries(entity.api ?? {})) {
      const path = apiPath(pathOrConfig);
      const pathItem = isRecord(paths[path]) ? paths[path] : null;
      if (!pathItem) throw new Error(`openapi is stale: missing ${entity.id}.${name} path ${path}.`);
      const method = API_METHODS[name as keyof typeof API_METHODS];
      if (!method || !Object.prototype.hasOwnProperty.call(pathItem, method)) {
        throw new Error(`openapi is stale: missing ${entity.id}.${name} method ${method?.toUpperCase() ?? "UNKNOWN"} ${path}.`);
      }
    }
  }
}

export function validateContractSnapshot(
  manifest: AppManifest,
  dataModel: AppDataModel | null,
  openapi: Record<string, unknown>,
): void {
  if (manifest.schema_version !== "kylon.app_manifest.v1") {
    throw new Error("manifest.schema_version must be kylon.app_manifest.v1.");
  }
  requireText(manifest.app.id, "manifest.app.id");
  requireText(manifest.app.name, "manifest.app.name");
  requireText(manifest.app.version, "manifest.app.version");
  requireText(manifest.app.base_url, "manifest.app.base_url");
  if (!Array.isArray(manifest.data.entities)) throw new Error("manifest.data.entities must be an array.");
  if (manifest.data.entities.length > MAX_ENTITIES) {
    throw new Error(`manifest.data.entities cannot exceed ${MAX_ENTITIES} entities.`);
  }
  const entityIds = new Set<string>();
  for (const entity of manifest.data.entities) {
    validateEntity(entity);
    if (entityIds.has(entity.id)) throw new Error(`duplicate entity id ${entity.id}.`);
    entityIds.add(entity.id);
  }
  if (manifest.data.viewer_mode === "required") {
    if (manifest.data.entities.length === 0 || !dataModel) {
      throw new Error("Data Viewer mode required needs manifest entities and a data model.");
    }
    validateDataModel(dataModel, manifest);
  } else if (manifest.data.entities.length > 0 || dataModel) {
    throw new Error("Data Viewer mode disabled requires empty manifest entities and no data model.");
  }
  validateOpenApiCoverage(manifest, openapi);
}

// ---------------------------------------------------------------------------
// Automations
//
// The platform validates declarations again when the build uploads its
// contract, and it is the authority. This runs at author time — inside
// `pnpm validate:push` — so the common mistakes fail where the author is
// looking, with the offending key named, instead of surfacing later as drift
// on a shipped App that nobody is watching.
//
// It is therefore deliberately conservative: it rejects only what the platform
// certainly rejects. Anything ambiguous is left to the platform rather than
// risking a false failure that blocks a legitimate push.
// ---------------------------------------------------------------------------

const AUTOMATION_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const MAX_AUTOMATIONS = 25;
const MAX_AUTOMATION_NAME_CHARS = 120;
const MAX_AUTOMATION_DESCRIPTION_CHARS = 500;
const MAX_AUTOMATION_BODY_CHARS = 100_000;
const RECORD_CHANGE_EVENTS = new Set(["insert", "update", "delete"]);
const ETC_GMT_PATTERN = /^Etc\/GMT[+-]\d/i;
/**
 * Both specifiers the platform accepts. `@kylon/workflow-sdk` is the advertised
 * name; `@p2/workflow-sdk` is a compatibility alias. Matching is exact, so a
 * subpath such as `@kylon/workflow-sdk/x` is not the SDK.
 */
const WORKFLOW_SDK_SPECIFIERS = ["@kylon/workflow-sdk", "@p2/workflow-sdk"] as const;
/**
 * The production floor. Development allows a shorter interval, but an App that
 * passes here has to pass in production too — failing at author time against
 * the looser bound would just move the rejection to the deploy.
 */
const MIN_AUTOMATION_INTERVAL_MINUTES = 10;

/**
 * The minutes-past-the-hour a cron field fires at, or null when the field uses
 * syntax this conservative reader does not model (`L`, `W`, `#`, `?`).
 */
function cronFieldValues(field: string, max: number): number[] | null {
  if (/[^0-9*/,-]/.test(field)) return null;
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    if (stepPart !== undefined && !/^\d+$/.test(stepPart)) return null;
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (step <= 0) return null;
    let start: number;
    let end: number;
    if (rangePart === "*" || rangePart === undefined) {
      start = 0;
      end = max;
    } else if (/^\d+$/.test(rangePart)) {
      start = Number(rangePart);
      // A bare value with a step reads as "from here onwards", as croner does.
      end = stepPart === undefined ? start : max;
    } else {
      const [from, to] = rangePart.split("-");
      if (from === undefined || to === undefined || !/^\d+$/.test(from) || !/^\d+$/.test(to)) {
        return null;
      }
      start = Number(from);
      end = Number(to);
      if (start > end) return null;
    }
    if (start > max || end > max) return null;
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values].sort((left, right) => left - right);
}

/**
 * True when two runs certainly fall closer together than the minimum.
 *
 * Only the sub-hour fields are read. Two firing minutes inside the same hour
 * are that far apart whatever the hour, day and month fields say, so this
 * cannot produce a false rejection — while a coarser expression is left for
 * the platform to judge.
 */
function cronFiresTooOften(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) return false;
  if (fields.length === 6) {
    const seconds = cronFieldValues(fields[0]!, 59);
    // More than one firing second means at most a minute between runs.
    if (seconds && seconds.length > 1) return true;
  }
  const minuteField = fields.length === 6 ? fields[1] : fields[0];
  const minutes = cronFieldValues(minuteField!, 59);
  if (!minutes) return false;
  for (let index = 1; index < minutes.length; index++) {
    if (minutes[index]! - minutes[index - 1]! < MIN_AUTOMATION_INTERVAL_MINUTES) return true;
  }
  // The gap across the hour boundary is a real gap only when two consecutive
  // hours both fire: `0,55 * * * *` runs at :55 and then five minutes later at
  // the top of the next hour, while `0,55 3 * * *` runs twice a day, 23 hours
  // apart. Checking the wrap unconditionally would reject the second, which the
  // platform accepts — so it is gated on the hour field admitting an adjacent
  // pair. The 23→00 case crosses a day boundary and is left to the platform.
  const hours = cronFieldValues(fields[fields.length === 6 ? 2 : 1]!, 23);
  const hasAdjacentHours =
    !!hours && hours.some((hour, index) => index > 0 && hour - hours[index - 1]! === 1);
  if (hasAdjacentHours && minutes.length > 0) {
    const wrapGapMinutes = 60 + minutes[0]! - minutes[minutes.length - 1]!;
    if (wrapGapMinutes < MIN_AUTOMATION_INTERVAL_MINUTES) return true;
  }
  return false;
}

const MAX_PREDICATE_FIELDS = 24;
const MAX_PREDICATE_VALUES = 50;

function isPredicateScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * Mirrors the platform's `when` predicate exactly.
 *
 * `where` is the only key it supports, it is required, and it must name at
 * least one field — a predicate that parsed to "match everything" would
 * reintroduce the wake-up cost it exists to remove, so the platform refuses it
 * rather than saving it.
 */
function validateChangePredicate(when: AppAutomationChangePredicate, key: string): void {
  if (typeof when !== "object" || when === null || Array.isArray(when)) {
    throw new Error(`automation "${key}".trigger.when must be an object.`);
  }
  const unknownKeys = Object.keys(when).filter((name) => name !== "where");
  if (unknownKeys.length > 0) {
    throw new Error(
      `automation "${key}".trigger.when contains unsupported key(s) ${unknownKeys
        .map((name) => `"${name}"`)
        .join(", ")}. Only "where" is supported.`,
    );
  }
  const where = when.where;
  if (where === undefined) {
    throw new Error(`automation "${key}".trigger.when requires "where".`);
  }
  if (typeof where !== "object" || where === null || Array.isArray(where)) {
    throw new Error(`automation "${key}".trigger.when.where must be an object.`);
  }
  const fields = Object.keys(where);
  if (fields.length === 0) {
    throw new Error(`automation "${key}".trigger.when.where must declare at least one field.`);
  }
  if (fields.length > MAX_PREDICATE_FIELDS) {
    throw new Error(
      `automation "${key}".trigger.when.where supports at most ${MAX_PREDICATE_FIELDS} fields.`,
    );
  }
  for (const field of fields) {
    const value = where[field];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error(
          `automation "${key}".trigger.when.where["${field}"] must not be an empty array.`,
        );
      }
      if (value.length > MAX_PREDICATE_VALUES) {
        throw new Error(
          `automation "${key}".trigger.when.where["${field}"] supports at most ${MAX_PREDICATE_VALUES} values.`,
        );
      }
      for (const entry of value) {
        if (!isPredicateScalar(entry)) {
          throw new Error(
            `automation "${key}".trigger.when.where["${field}"] accepts only string, number, boolean or null values.`,
          );
        }
      }
      continue;
    }
    if (!isPredicateScalar(value)) {
      throw new Error(
        `automation "${key}".trigger.when.where["${field}"] accepts only string, number, boolean, null, or an array of those.`,
      );
    }
  }
}

function requireAutomationText(value: unknown, label: string, maxChars: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  if (value.length > maxChars) throw new Error(`${label} exceeds ${maxChars} characters.`);
  return value;
}

function validateAutomationTrigger(
  trigger: AppAutomationTrigger,
  key: string,
  entityIds: ReadonlySet<string>,
): void {
  if (!trigger || typeof trigger !== "object") {
    throw new Error(`automation "${key}".trigger must be an object.`);
  }
  if (trigger.kind === "cron") {
    const expr = requireAutomationText(trigger.expr, `automation "${key}".trigger.expr`, 200);
    // Alias forms are not field-counted. The platform's cron parser accepts
    // `@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily` and `@hourly`,
    // all of which are far slower than the minimum — counting fields rejected
    // every one of them as a "1 field" expression, which is precisely the
    // over-rejection this validator exists to avoid. Anything else beginning
    // with `@` (`@midnight`, `@minutely`, `@reboot`) the platform refuses on
    // its own; leaving those to it costs an author a later error message,
    // while guessing here could cost them a valid schedule.
    if (!expr.trim().startsWith("@")) {
      const fieldCount = expr.trim().split(/\s+/).length;
      if (fieldCount !== 5 && fieldCount !== 6) {
        throw new Error(
          `automation "${key}".trigger.expr must have 5 fields (or 6 with leading seconds), got ${fieldCount}.`,
        );
      }
    }
    if (trigger.timezone !== undefined) {
      const timezone = requireAutomationText(
        trigger.timezone,
        `automation "${key}".trigger.timezone`,
        64,
      );
      if (ETC_GMT_PATTERN.test(timezone)) {
        throw new Error(
          `automation "${key}".trigger.timezone "${timezone}" uses the POSIX-inverted sign; use a canonical IANA name such as Asia/Shanghai.`,
        );
      }
    }
    if (cronFiresTooOften(expr)) {
      throw new Error(
        `automation "${key}".trigger.expr fires more often than every ${MIN_AUTOMATION_INTERVAL_MINUTES} minutes, which the platform refuses.`,
      );
    }
    return;
  }
  if (trigger.kind === "record_change") {
    const entity = requireAutomationText(
      trigger.entity,
      `automation "${key}".trigger.entity`,
      200,
    );
    if (!entityIds.has(entity)) {
      throw new Error(
        `automation "${key}".trigger.entity "${entity}" is not an entity in this App's manifest.`,
      );
    }
    if (!Array.isArray(trigger.events) || trigger.events.length === 0) {
      throw new Error(`automation "${key}".trigger.events must be a non-empty array.`);
    }
    for (const event of trigger.events) {
      if (!RECORD_CHANGE_EVENTS.has(event)) {
        throw new Error(
          `automation "${key}".trigger.events contains "${String(event)}"; expected insert, update or delete.`,
        );
      }
    }
    if (trigger.when !== undefined) validateChangePredicate(trigger.when, key);
    return;
  }
  throw new Error(
    `automation "${key}".trigger.kind must be "cron" or "record_change", got "${String(
      (trigger as { kind?: unknown }).kind,
    )}".`,
  );
}

function isSdkSpecifier(text: string): boolean {
  return (WORKFLOW_SDK_SPECIFIERS as readonly string[]).includes(text);
}

/**
 * True when the source imports the workflow SDK, decided the way the platform
 * decides it: string-literal nodes in genuine module-specifier positions.
 *
 * A substring match is not the same question. `console.log("@kylon/workflow-sdk")`
 * contains the name and imports nothing — the platform classifies it as a
 * prompt and then refuses the declaration, so accepting it here would move a
 * certain failure from the author's terminal to a published App's drift
 * report. Reading the same AST positions keeps both answers identical.
 *
 * `typescript` is already a devDependency and this module is imported only by
 * `scripts/generate-contracts.ts`, never by the app bundle, so the compiler
 * costs nothing at runtime.
 *
 * Detection only. The platform additionally requires a code body to do its work
 * at top level (it runs as `node workflow.mjs`, so logic reachable only through
 * `export default` never executes). That check is not mirrored here: this
 * validator's contract is to reject what the platform certainly rejects, not to
 * catch everything it might.
 */
function importsWorkflowSdk(source: string): boolean {
  // Most Apps have no code Automations; load the compiler API only for them.
  const ts = createRequire(typeof __filename === "string" ? __filename : import.meta.url)("typescript") as typeof import("typescript");
  const sourceFile = ts.createSourceFile(
    "automation.ts",
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    // import ... from "x" / export ... from "x" / import "x"
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      isSdkSpecifier(node.moduleSpecifier.text)
    ) {
      found = true;
      return;
    }
    // import x = require("x")
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression) &&
      isSdkSpecifier(node.moduleReference.expression.text)
    ) {
      found = true;
      return;
    }
    // import("x") / require("x")
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      const arg = node.arguments[0];
      if (isDynamicImport || isRequire) {
        if (arg && ts.isStringLiteralLike(arg) && isSdkSpecifier(arg.text)) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function validateAutomationTarget(target: AppAutomationTarget, key: string): void {
  if (!target || typeof target !== "object") {
    throw new Error(`automation "${key}".target must be an object.`);
  }
  if (target.kind === "prompt") {
    requireAutomationText(
      target.message,
      `automation "${key}".target.message`,
      MAX_AUTOMATION_BODY_CHARS,
    );
    return;
  }
  if (target.kind === "code") {
    const source = requireAutomationText(
      target.source,
      `automation "${key}".target.source`,
      MAX_AUTOMATION_BODY_CHARS,
    );
    if (!importsWorkflowSdk(source)) {
      throw new Error(
        `automation "${key}".target.source must import ${WORKFLOW_SDK_SPECIFIERS[0]} (or the ${WORKFLOW_SDK_SPECIFIERS[1]} alias); a source that does not is classified as a prompt and refused rather than run as code.`,
      );
    }
    return;
  }
  throw new Error(
    `automation "${key}".target.kind must be "prompt" or "code", got "${String(
      (target as { kind?: unknown }).kind,
    )}".`,
  );
}

/**
 * Validate the declared Automations against the manifest shipped beside them.
 *
 * `undefined` is silence and validates trivially; `[]` is the statement "this
 * App declares none" and is equally valid. The difference matters downstream,
 * not here.
 */
export function validateAutomations(
  manifest: AppManifest,
  automations: AppAutomationDeclaration[] | undefined,
): void {
  if (automations === undefined) return;
  if (!Array.isArray(automations)) throw new Error("automations must be an array.");
  if (automations.length > MAX_AUTOMATIONS) {
    throw new Error(
      `automations declares ${automations.length} entries; at most ${MAX_AUTOMATIONS} are supported.`,
    );
  }
  const entityIds = new Set(manifest.data.entities.map((entity) => entity.id));
  const seen = new Set<string>();
  for (const automation of automations) {
    if (!automation || typeof automation !== "object" || Array.isArray(automation)) {
      throw new Error("automations[] entries must be objects.");
    }
    const key = typeof automation.key === "string" ? automation.key : "";
    if (!AUTOMATION_KEY_PATTERN.test(key)) {
      throw new Error(
        `automation key "${key}" is invalid; use lowercase letters, digits and hyphens (3-64 characters).`,
      );
    }
    if (seen.has(key)) throw new Error(`automation key "${key}" is declared more than once.`);
    seen.add(key);
    requireAutomationText(automation.name, `automation "${key}".name`, MAX_AUTOMATION_NAME_CHARS);
    if (automation.description !== undefined && automation.description !== null) {
      requireAutomationText(
        automation.description,
        `automation "${key}".description`,
        MAX_AUTOMATION_DESCRIPTION_CHARS,
      );
    }
    validateAutomationTrigger(automation.trigger, key, entityIds);
    validateAutomationTarget(automation.target, key);
    if (automation.delivery !== undefined) {
      if (
        typeof automation.delivery !== "object" ||
        automation.delivery === null ||
        Array.isArray(automation.delivery)
      ) {
        throw new Error(`automation "${key}".delivery must be an object.`);
      }
      if (
        automation.delivery.publish !== undefined &&
        typeof automation.delivery.publish !== "boolean"
      ) {
        throw new Error(`automation "${key}".delivery.publish must be a boolean.`);
      }
    }
  }
}
