export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "user"
  | "multi_user"
  | "url"
  | "email"
  | "json"
  | "attachment"
  | "relation";

export type RuntimeKind = "database_app" | "custom_app";

export type OptionColor = string;

export interface SelectOption {
  id: string;
  label: string;
  color?: OptionColor;
}

export interface UserOption {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export interface AttachmentFieldConfig {
  source?: "app_file" | "workspace_file";
  label_field?: string;
  url_field?: string;
  file_id_field?: string;
  preview_url_field?: string;
  direct_url_field?: string;
  download_url_field?: string;
  content_type_field?: string;
}

export interface FieldConfig {
  options?: SelectOption[];
  user_source?: "workspace" | "app";
  users?: UserOption[];
  currency?: string;
  include_time?: boolean;
  date_format?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | "MMM D, YYYY";
  max_visible?: number;
  relation_entity_id?: string;
  relation_label_field?: string;
  attachment?: AttachmentFieldConfig;
}

export interface ManifestField {
  key: string;
  column?: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  readOnly?: boolean;
  sortable?: boolean;
  width?: number;
  system?: boolean;
  config?: FieldConfig;
}

export interface RelationshipManifest {
  key?: string;
  type: "has_one" | "has_many" | "belongs_to" | "many_to_many";
  entityId: string;
  foreignKey?: string;
  label?: string;
}

export interface EntityManifest {
  id: string;
  recordIdField?: string;
  readOnly?: boolean;
  label: string;
  pluralLabel: string;
  description: string;
  titleField: string;
  fields: ManifestField[];
  relationships: RelationshipManifest[];
}

export interface EntityListQueryParameter {
  name: string;
  required?: boolean;
  schema: Record<string, unknown>;
  description?: string;
}

/**
 * Whether an Agent's call to this App may carry the person it acts for.
 * `live_human_turn`: while a person is engaging — the Agent's activation was
 * triggered by their own message in a Room they can still write to — Kylon
 * adds `x-p2-on-behalf-of` beside the Agent's `x-p2-user-id`. Never on an
 * Automation, follow-up, heartbeat or agent-to-agent hop. Read it with
 * `requestActor` in `lib/kylon/request-actor.ts`. Absent means `none`.
 */
export type AppDelegationPolicy = "none" | "live_human_turn";

export interface AppMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  delegation?: AppDelegationPolicy;
}

export interface AppContractField {
  id: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  read_only?: boolean;
  sortable?: boolean;
  width?: number;
  system?: boolean;
  config?: FieldConfig;
}

export interface AppContractRelationship {
  id: string;
  type: RelationshipManifest["type"];
  entity_id: string;
  foreign_key?: string;
}

export interface AppContractEntityCreateApi {
  path: string;
  autoLinkDiscussion?: boolean;
}

export interface AppContractEntityApi {
  get: string;
  list?: string;
  create?: string | AppContractEntityCreateApi;
  update?: string;
  delete?: string;
}

export type EntityApiDefinition = AppContractEntityApi;

export interface AppContractEntity {
  id: string;
  read_only?: boolean;
  label: string;
  description?: string;
  record_id_field: string;
  title_field: string;
  fields: AppContractField[];
  relationships: AppContractRelationship[];
  api?: AppContractEntityApi;
}

export interface AppManifest {
  schema_version: "kylon.app_manifest.v1";
  app: {
    id: string;
    name: string;
    version: string;
    base_url: string;
    template_id?: string;
    template_version?: string;
    delegation?: AppDelegationPolicy;
  };
  data: {
    viewer_mode: "required" | "disabled";
    entities: AppContractEntity[];
  };
  docs?: {
    openapi_url?: string;
    llms_url?: string;
    revision?: string;
    page_routes?: string[];
  };
}

export interface AppDataModelField {
  id: string;
  column: string;
}

export interface AppDataModelEntity {
  id: string;
  table: string;
  id_column?: string;
  created_at_column?: string;
  updated_at_column?: string;
  fields: AppDataModelField[];
}

export interface AppDataModel {
  schema_version: "kylon.app_data_model.v1";
  entities: AppDataModelEntity[];
}

export interface AppRegistration {
  runtime_kind: RuntimeKind;
  manifest: AppManifest;
  data_model?: AppDataModel | null;
  openapi?: Record<string, unknown> | null;
  agent_docs?: string | null;
  /** Emitted only when the definition states it — see `AppDefinition.automations`. */
  automations?: AppAutomationDeclaration[];
}

export type FieldPrimitive = string | number | boolean | null;

export type JsonValue =
  | FieldPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CanonicalObjectValue {
  id?: string;
  label?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  url?: string;
}

export interface CanonicalFileBaseValue {
  id?: string;
  label?: string;
  contentType?: string;
  url?: string;
  workspaceId?: string;
  workspaceFileId?: string;
  previewUrl?: string;
  directUrl?: string;
  downloadUrl?: string;
  size?: number;
}

export type CanonicalFileValue =
  | (CanonicalFileBaseValue & { fileName: string; name?: string })
  | (CanonicalFileBaseValue & { name: string; fileName?: string });

export type CanonicalFieldValue =
  | FieldPrimitive
  | FieldPrimitive[]
  | JsonValue
  | CanonicalObjectValue
  | CanonicalObjectValue[]
  | CanonicalFileValue
  | CanonicalFileValue[];

export interface CanonicalRecord {
  id: string;
  entity: string;
  values: Record<string, CanonicalFieldValue>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppRecordResponse {
  entity_id: string;
  record_id: string;
  data: Record<string, CanonicalFieldValue>;
  created_at?: string;
  updated_at?: string;
}

export interface PaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginationResult {
  limit: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface AppRecordListResult {
  records: CanonicalRecord[];
  pagination: PaginationResult;
}

export interface AppRecordListResponse {
  entity_id: string;
  records: AppRecordResponse[];
  pagination: {
    limit: number;
    next_cursor?: string;
    has_more: boolean;
  };
}

export interface EntityDefinition extends EntityManifest {
  table: string;
  idColumn?: string;
  recordIdParam?: string;
  createdAtColumn?: string;
  updatedAtColumn?: string;
  api?: EntityApiDefinition;
  listQueryParameters?: EntityListQueryParameter[];
}

// ---------------------------------------------------------------------------
// Automations
//
// An Automation this App declares. Publishing a commit that declares one
// creates it in the App's Room, paused; changing a declaration updates it;
// dropping one retires it; and rolling back to an earlier commit converges the
// set to whatever that commit declared. `key` is the stable identity — renaming
// `name` keeps the same Automation, changing `key` retires the old one.
//
// Deliberately snake_case, unlike the rest of `AppDefinition`: this block is
// handed to the platform verbatim rather than translated by `buildManifest`,
// and it is documented in `app --help` in exactly this shape. A camelCase
// mirror would be a second schema to keep in step with the platform parser,
// and the translation layer is where that drift would hide.
// ---------------------------------------------------------------------------

export type AppRecordChangeEvent = "insert" | "update" | "delete";

/** Fires on a schedule. Held to the platform's minimum interval. */
export interface AppAutomationCronTrigger {
  kind: "cron";
  /** Standard 5-field cron, or 6-field with leading seconds. */
  expr: string;
  /** IANA name, e.g. "Asia/Shanghai". Defaults to UTC. */
  timezone?: string;
}

/** A value a `where` field is compared against: equality, or membership in a list. */
export type AppAutomationPredicateScalar = string | number | boolean | null;
export type AppAutomationPredicateValue =
  | AppAutomationPredicateScalar
  | AppAutomationPredicateScalar[];

/**
 * Narrows which changes wake the Automation, so it does not spend an activation
 * to decide it has nothing to do.
 *
 * `where` is the only supported key, it is required, and it must name at least
 * one field: a predicate that parsed to "match everything" would reintroduce
 * exactly the cost it exists to remove. Fields are ANDed; a scalar means
 * equality and an array means membership; comparison is strict, with no
 * string/number coercion; and a field absent from the payload never matches, so
 * a delete never satisfies a `where`.
 */
export interface AppAutomationChangePredicate {
  where: Record<string, AppAutomationPredicateValue>;
}

/** Fires when records of one manifest entity change. */
export interface AppAutomationRecordChangeTrigger {
  kind: "record_change";
  /** Must be an entity id this same contract ships. */
  entity: string;
  events: AppRecordChangeEvent[];
  when?: AppAutomationChangePredicate;
}

export type AppAutomationTrigger =
  | AppAutomationCronTrigger
  | AppAutomationRecordChangeTrigger;

/** A natural-language instruction the Room's agent carries out. */
export interface AppAutomationPromptTarget {
  kind: "prompt";
  message: string;
}

/**
 * A TypeScript program. It MUST import `@kylon/workflow-sdk`; a source that
 * does not is refused rather than silently run as a prompt, which would pay a
 * per-run model tax for a fixed procedure.
 */
export interface AppAutomationCodeTarget {
  kind: "code";
  source: string;
}

export type AppAutomationTarget = AppAutomationPromptTarget | AppAutomationCodeTarget;

export interface AppAutomationDeclaration {
  /** Stable identity: lowercase letters, digits and hyphens, 3-64 chars. */
  key: string;
  name: string;
  description?: string | null;
  trigger: AppAutomationTrigger;
  target: AppAutomationTarget;
  /** `{ publish: true }` posts run results to the Room; omit for internal-only. */
  delivery?: { publish?: boolean };
}

export interface AppDefinition {
  runtimeKind?: "custom_app";
  app: AppMetadata;
  dataViewer: {
    mode: "required" | "disabled";
  };
  entities: EntityDefinition[];
  openapi?: {
    paths?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
    tags?: Array<Record<string, unknown>>;
  };
  /**
   * Automations this App owns.
   *
   * Leaving the field out means this version states nothing, and the platform
   * then falls back to the App's registration document (`app register`). That
   * makes adoption safe — an App that upgrades this contract layer without
   * declaring anything keeps the Automations it already had — but it is NOT a
   * general no-op: once an App declares here, removing the field retires those
   * Automations on the next publish, because the registration document it falls
   * back to usually declares none.
   *
   * An explicit `[]` is the statement "this App declares none" and retires
   * everything either way.
   */
  automations?: AppAutomationDeclaration[];
}
