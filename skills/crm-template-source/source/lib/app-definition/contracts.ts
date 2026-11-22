import { attachAgentDocumentation, type PageRoute } from "@/lib/app-definition/agent-documents";
import type {
  AppDataModel,
  AppDefinition,
  AppContractEntity,
  AppContractField,
  AppContractRelationship,
  AppManifest,
  AppRegistration,
  EntityDefinition,
  ManifestField,
} from "@/lib/app-definition/types";
import {
  validateAutomations,
  validateContractSnapshot,
} from "@/lib/app-definition/contract-validation";
import {
  KYLON_APP_TEMPLATE_ID,
  KYLON_APP_TEMPLATE_VERSION,
} from "@/lib/app-definition/template-version";

export const APP_ID_PLACEHOLDER = "replace_with_real_kylon_app_id";
export const BASE_URL_PLACEHOLDER = "https://replace-with-real-kylon-app-url.invalid";
const ALLOW_PLACEHOLDER_ENV = "KYLON_TEMPLATE_ALLOW_APP_ID_PLACEHOLDER";
const APP_ID_ENV = "KYLON_APP_ID";
const BASE_URL_ENV = "KYLON_APP_BASE_URL";

function injectedValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function placeholdersAllowed(): boolean {
  return process.env[ALLOW_PLACEHOLDER_ENV] === "1";
}

/**
 * The App id the contracts are generated for.
 *
 * Kylon injects KYLON_APP_ID into every build of the App, so an untouched
 * template resolves its id from the environment and needs no source edit. A
 * definition that names an id explicitly must still agree with the injected
 * one: a mismatch means the source was copied from another App.
 */
function validatedAppId(definition: AppDefinition): string {
  const injectedAppId = injectedValue(APP_ID_ENV);
  const declaredAppId = typeof definition.app.id === "string" ? definition.app.id.trim() : "";
  const appId = declaredAppId === APP_ID_PLACEHOLDER && injectedAppId ? injectedAppId : declaredAppId;
  if (appId === APP_ID_PLACEHOLDER && !placeholdersAllowed()) {
    throw new Error(
      `appDefinition.app.id is still the template placeholder. Kylon builds provide ${APP_ID_ENV} automatically; for local contract generation pass the App id from the \`app:\` line of workspace_cli app show: ${APP_ID_ENV}=<app> ${BASE_URL_ENV}=<url> pnpm validate:push. For template repository maintenance only, set ${ALLOW_PLACEHOLDER_ENV}=1.`,
    );
  }
  if (injectedAppId && appId !== injectedAppId) {
    throw new Error("manifest.app.id must match the App id provided by Kylon.");
  }
  return appId;
}

/**
 * The App's public base URL.
 *
 * Kylon injects KYLON_APP_BASE_URL (the App's production URL) into every
 * build and rejects a registered base_url that differs from it, so the
 * injected value always wins. The definition's value is used only when no
 * build environment is present, such as local contract generation.
 */
function validatedBaseUrl(definition: AppDefinition): string {
  const injectedBaseUrl = injectedValue(BASE_URL_ENV);
  const declaredBaseUrl =
    typeof definition.app.baseUrl === "string" ? definition.app.baseUrl.trim() : "";
  if (
    injectedBaseUrl &&
    declaredBaseUrl &&
    declaredBaseUrl !== BASE_URL_PLACEHOLDER &&
    declaredBaseUrl !== injectedBaseUrl
  ) {
    console.warn(
      `appDefinition.app.baseUrl (${declaredBaseUrl}) is superseded by ${BASE_URL_ENV} (${injectedBaseUrl}); the platform registers the injected URL.`,
    );
  }
  const baseUrl = injectedBaseUrl ?? definition.app.baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new Error("appDefinition.app.baseUrl is required.");
  }
  const normalized = baseUrl.trim();
  if (normalized === BASE_URL_PLACEHOLDER && !placeholdersAllowed()) {
    throw new Error(
      `appDefinition.app.baseUrl is still the template placeholder. Kylon builds provide ${BASE_URL_ENV} automatically; for local contract generation pass the App URL from the \`url:\` line of workspace_cli app show: ${APP_ID_ENV}=<app> ${BASE_URL_ENV}=<url> pnpm validate:push. For template repository maintenance only, set ${ALLOW_PLACEHOLDER_ENV}=1.`,
    );
  }
  try {
    new URL(normalized);
  } catch {
    throw new Error(
      injectedBaseUrl
        ? `${BASE_URL_ENV} must be a valid URL.`
        : "appDefinition.app.baseUrl must be a valid URL.",
    );
  }
  return normalized;
}

function validatedRuntimeKind(definition: AppDefinition): "custom_app" {
  const runtimeKind: unknown = definition.runtimeKind;
  if (runtimeKind !== undefined && runtimeKind !== "custom_app") {
    throw new Error("appDefinition.runtimeKind must be custom_app.");
  }
  return "custom_app";
}

function recordIdPathParam(entity: EntityDefinition): string {
  const raw =
    entity.recordIdParam?.trim() ||
    (entity.api?.get ? pathParameterNames(entity.api.get)[0] : undefined) ||
    "record_id";
  const sanitized = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z]/.test(sanitized) ? sanitized : `record_${sanitized}`;
}

function contractField(field: ManifestField): AppContractField {
  return {
    id: field.key,
    label: field.label,
    type: field.type,
    ...(field.description !== undefined ? { description: field.description } : {}),
    ...(field.required ? { required: field.required } : {}),
    ...(field.sortable !== undefined ? { sortable: field.sortable } : {}),
    ...(field.readOnly !== undefined ? { read_only: field.readOnly } : {}),
    ...(field.width ? { width: field.width } : {}),
    ...(field.system ? { system: field.system } : {}),
    ...(field.config ? { config: field.config } : {}),
  };
}

function contractRelationship(relationship: EntityDefinition["relationships"][number]): AppContractRelationship {
  return {
    id: relationship.key ?? relationship.foreignKey ?? relationship.entityId,
    type: relationship.type,
    entity_id: relationship.entityId,
    ...(relationship.foreignKey ? { foreign_key: relationship.foreignKey } : {}),
  };
}

function recordFields(entity: EntityDefinition): ManifestField[] {
  const key = entity.recordIdField ?? "id";
  if (entity.fields.some((field) => field.key === key)) return entity.fields;
  if (key !== "id") throw new Error(`Entity ${entity.id} recordIdField ${key} must reference a declared field.`);
  return [{ key, label: "ID", type: "text", system: true }, ...entity.fields];
}

function contractEntity(entity: EntityDefinition): AppContractEntity {
  const api = entity.api && Object.keys(entity.api).length > 0 ? entity.api : undefined;
  if (entity.fields.some((field) => field.type === "json" && field.sortable)) {
    throw new Error(`Entity ${entity.id} JSON fields cannot be sortable.`);
  }
  if (entity.fields.some((field) => field.key === entity.titleField && field.type === "json")) {
    throw new Error(`Entity ${entity.id} titleField cannot use a JSON field.`);
  }
  if (api && (typeof api.get !== "string" || !api.get.trim())) {
    throw new Error(`Entity ${entity.id} api.get is required when api is configured.`);
  }
  return {
    id: entity.id,
    label: entity.pluralLabel,
    description: entity.description,
    record_id_field: entity.recordIdField ?? "id",
    ...(entity.readOnly !== undefined ? { read_only: entity.readOnly } : {}),
    title_field: entity.titleField,
    fields: recordFields(entity).map(contractField),
    relationships: entity.relationships.map(contractRelationship),
    ...(api ? { api } : {}),
  };
}

function hasOpenApiDocument(definition: AppDefinition): boolean {
  return Boolean(
    definition.openapi ||
      definition.entities.some((entity) => entity.api && Object.keys(entity.api).length > 0),
  );
}

export function buildManifest(definition: AppDefinition): AppManifest {
  const manifest: AppManifest = {
    schema_version: "kylon.app_manifest.v1",
    app: {
      id: validatedAppId(definition),
      name: definition.app.name,
      version: definition.app.version,
      base_url: validatedBaseUrl(definition),
      template_id: KYLON_APP_TEMPLATE_ID,
      template_version: KYLON_APP_TEMPLATE_VERSION,
      ...(definition.app.delegation ? { delegation: definition.app.delegation } : {}),
    },
    data: {
      viewer_mode: definition.dataViewer.mode,
      entities: definition.entities.map(contractEntity),
    },
  };
  if (hasOpenApiDocument(definition)) {
    manifest.docs = { openapi_url: "/api/openapi.json" };
  }
  return manifest;
}

export function buildDataModel(definition: AppDefinition): AppDataModel | null {
  if (definition.dataViewer.mode === "disabled") return null;
  if (definition.entities.length === 0) {
    throw new Error("Data Viewer mode required needs at least one entity.");
  }
  return {
    schema_version: "kylon.app_data_model.v1",
    entities: definition.entities.map((entity) => {
      const recordIdField = entity.recordIdField ?? "id";
      const recordField = recordFields(entity).find((field) => field.key === recordIdField)!;
      const idColumn = entity.idColumn ?? recordField.column ?? recordIdField;
      if (recordField.column && recordField.column !== idColumn) {
        throw new Error(`Entity ${entity.id} record ID column must match idColumn.`);
      }
      const fields = new Map<string, string>([[recordIdField, idColumn]]);
      for (const field of entity.fields) {
        fields.set(field.key, field.key === recordIdField ? idColumn : field.column ?? field.key);
      }
      return {
        id: entity.id,
        table: entity.table,
        id_column: idColumn,
        ...(entity.createdAtColumn ? { created_at_column: entity.createdAtColumn } : {}),
        ...(entity.updatedAtColumn ? { updated_at_column: entity.updatedAtColumn } : {}),
        fields: Array.from(fields, ([id, column]) => ({ id, column })),
      };
    }),
  };
}

export function validateContractParity(
  manifest: AppManifest,
  dataModel: AppDataModel | null,
): void {
  const manifestIds = manifest.data.entities.map((entity) => entity.id);
  const modelIds = dataModel?.entities.map((entity) => entity.id) ?? [];
  if (manifest.data.viewer_mode === "required") {
    if (manifestIds.length === 0 || !dataModel) {
      throw new Error("Data Viewer mode required needs manifest entities and a data model.");
    }
  } else if (manifestIds.length > 0 || dataModel) {
    throw new Error("Data Viewer mode disabled requires empty manifest entities and no data model.");
  }
  if (
    new Set(manifestIds).size !== manifestIds.length ||
    new Set(modelIds).size !== modelIds.length ||
    manifestIds.length !== modelIds.length ||
    manifestIds.some((id) => !modelIds.includes(id))
  ) {
    throw new Error("Manifest and data model entity ids must match.");
  }
  for (const modelEntity of dataModel?.entities ?? []) {
    const manifestEntity = manifest.data.entities.find((entity) => entity.id === modelEntity.id);
    const manifestFields = new Set(manifestEntity?.fields.map((field) => field.id));
    for (const field of modelEntity.fields) {
      if (!manifestFields.has(field.id)) {
        throw new Error(`Data model field ${modelEntity.id}.${field.id} is missing from manifest.`);
      }
    }
  }
}

export function buildAppRegistration(definition: AppDefinition, routes: readonly PageRoute[] = []): AppRegistration {
  const openapi = buildOpenApiDocument(definition);
  const manifest = buildManifest(definition);
  const dataModel = buildDataModel(definition);
  validateContractParity(manifest, dataModel);
  validateContractSnapshot(manifest, dataModel, openapi ?? {});
  validateAutomations(manifest, definition.automations);
  return attachAgentDocumentation({
    runtime_kind: validatedRuntimeKind(definition),
    manifest,
    data_model: dataModel,
    ...(openapi ? { openapi } : {}),
    // Emitted ONLY when the definition states the field.
    //
    // The platform reads a present `automations` as this version's complete
    // statement of what the App owns, so an unconditional `automations: []`
    // here would mean every App that adopts this contract layer without
    // declaring anything tells the platform "I own none" — and the first
    // publish after the upgrade would archive every Automation that App had
    // declared through `app register`, including enabled ones. Silence has to
    // stay silence; `[]` stays available for an App that means it.
    ...(definition.automations !== undefined ? { automations: definition.automations } : {}),
  }, routes);
}

function schemaForField(field: ManifestField) {
  return {
    ...valueSchemaForField(field),
    ...(field.description !== undefined ? { description: field.description } : {}),
    ...(field.readOnly ? { readOnly: true } : {}),
  };
}

function valueSchemaForField(field: ManifestField) {
  const nullable = (schema: Record<string, unknown>) => ({ oneOf: [schema, { type: "null" }] });
  const attachmentItemSchema = () => {
    const attachment = field.config?.attachment;
    const labelField = attachment?.label_field ?? "fileName";
    const fileIdField = attachment?.file_id_field ?? "workspaceFileId";
    const properties: Record<string, unknown> = {
      id: { type: "string" },
      label: { type: "string" },
      name: { type: "string" },
      fileName: { type: "string" },
      contentType: { type: "string" },
      size: { type: "number" },
      url: { type: "string" },
      workspaceId: { type: "string" },
      workspaceFileId: { type: "string" },
      previewUrl: { type: "string" },
      directUrl: { type: "string" },
      downloadUrl: { type: "string" },
    };
    for (const key of [
      labelField,
      fileIdField,
      attachment?.content_type_field,
      attachment?.url_field,
      attachment?.preview_url_field,
      attachment?.direct_url_field,
      attachment?.download_url_field,
    ]) {
      if (key) properties[key] ??= { type: "string" };
    }
    const required = [labelField, attachment?.source === "workspace_file" ? fileIdField : undefined].filter(
      (key): key is string => Boolean(key),
    );
    return {
      type: "object",
      properties,
      required: Array.from(new Set(required)),
      additionalProperties: false,
    };
  };

  switch (field.type) {
    case "number":
    case "currency":
    case "percent":
      return nullable({ type: "number" });
    case "checkbox":
      return nullable({ type: "boolean" });
    case "multi_select":
    case "multi_user":
      return nullable({ type: "array", items: { type: "string" } });
    case "attachment":
      return nullable({
        type: "array",
        items: attachmentItemSchema(),
      });
    case "relation":
      return nullable({
        type: "array",
        items: {
          oneOf: [
            { type: "string" },
            {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                name: { type: "string" },
              },
              additionalProperties: false,
            },
          ],
        },
      });
    case "user":
      return nullable({
        oneOf: [
          { type: "string" },
          {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string", format: "email" },
              avatar_url: { type: "string", format: "uri" },
            },
            additionalProperties: false,
          },
        ],
      });
    case "date":
      return nullable({ type: "string", format: "date" });
    case "url":
      return nullable({ type: "string", format: "uri" });
    case "email":
      return nullable({ type: "string", format: "email" });
    case "json":
      return {
        oneOf: [
          { type: "object", additionalProperties: true },
          { type: "array", items: {} },
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "null" },
        ],
      };
    default:
      return nullable({ type: "string" });
  }
}

function schemaName(entity: EntityDefinition, suffix: string) {
  return `${entity.id.replace(/[^A-Za-z0-9_]/g, "_")}${suffix}`;
}

function schemaRef(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function entityDataProperties(entity: EntityDefinition) {
  return {
    ...Object.fromEntries(recordFields(entity).map((field) => [field.key, schemaForField(field)])),
  };
}

function entityRecordDataSchema(entity: EntityDefinition) {
  return {
    type: "object",
    properties: entityDataProperties(entity),
    required: recordFields(entity).map((field) => field.key),
    additionalProperties: false,
  };
}

function entityWriteDataSchema(entity: EntityDefinition, mode: "create" | "update") {
  const writable = recordFields(entity).filter((field) =>
    !field.readOnly,
  );
  return {
    type: "object",
    properties: Object.fromEntries(writable.map((field) => [field.key, schemaForField(field)])),
    required: mode === "create" ? writable.filter((field) => field.required).map((field) => field.key) : [],
    additionalProperties: false,
  };
}

function oneOfEntitySchemas(entities: EntityDefinition[], suffix: string, fallback: Record<string, unknown>) {
  return entities.length
    ? { oneOf: entities.map((entity) => schemaRef(schemaName(entity, suffix))) }
    : fallback;
}

function pathParameterNames(path: string) {
  return Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1]).filter(
    (name): name is string => Boolean(name),
  );
}

function pathParameters(path: string, fallbackName: string) {
  const names = pathParameterNames(path);
  const uniqueNames = names.length > 0 ? Array.from(new Set(names)) : [fallbackName];

  return uniqueNames.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function addPathOperation(
  paths: Record<string, Record<string, unknown>>,
  path: string,
  method: "get" | "post" | "patch" | "delete",
  operation: Record<string, unknown>,
) {
  paths[path] = {
    ...(paths[path] ?? {}),
    [method]: operation,
  };
}

function apiPath(pathOrConfig: string | { path: string }): string {
  return typeof pathOrConfig === "string" ? pathOrConfig : pathOrConfig.path;
}

function mergeOpenApiPaths(
  generatedPaths: Record<string, Record<string, unknown>>,
  extensionPaths: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const paths: Record<string, unknown> = { ...generatedPaths };
  for (const [path, extension] of Object.entries(extensionPaths ?? {})) {
    const generated = paths[path];
    paths[path] =
      typeof generated === "object" && generated !== null && !Array.isArray(generated) &&
      typeof extension === "object" && extension !== null && !Array.isArray(extension)
        ? { ...generated, ...extension }
        : extension;
  }
  return paths;
}

export function buildOpenApiDocument(definition: AppDefinition) {
  const openapiExtension = definition.openapi ?? {};
  const entityPaths: Record<string, Record<string, unknown>> = {};
  const entitiesWithListApi = definition.entities.filter((entity) => Boolean(entity.api?.list));
  const entitiesWithCreateApi = definition.entities.filter((entity) => Boolean(entity.api?.create));
  const entitiesWithUpdateApi = definition.entities.filter((entity) => Boolean(entity.api?.update));

  for (const entity of definition.entities) {
    const api = entity.api;
    if (!api || Object.keys(api).length === 0) continue;
    const recordIdParam = recordIdPathParam(entity);
    const recordResponse = schemaName(entity, "RecordResponse");
    const listResponse = schemaName(entity, "RecordListResponse");
    const createRequest = schemaName(entity, "RecordCreateRequest");
    const updateRequest = schemaName(entity, "RecordUpdateRequest");

    if (api.get) {
      addPathOperation(entityPaths, api.get, "get", {
        summary: `Get ${entity.label}`,
        description: `Use when the App UI or an agent needs one ${entity.label} through the App's own API.`,
        parameters: pathParameters(api.get, recordIdParam),
        responses: {
          "200": {
            description: `${entity.label} response.`,
            content: {
              "application/json": {
                schema: schemaRef(recordResponse),
              },
            },
          },
          "404": {
            description: "Record not found.",
          },
        },
      });
    }

    if (api.list) {
      addPathOperation(entityPaths, api.list, "get", {
        summary: `List ${entity.pluralLabel}`,
        description: `Use when the App UI or an agent needs to browse ${entity.pluralLabel} through the App's own API. Data Viewer uses platform registration instead.`,
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            description: "Maximum records to return.",
          },
          {
            name: "cursor",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Opaque cursor returned from the previous page.",
          },
          ...(entity.listQueryParameters ?? []).map((parameter) => ({
            name: parameter.name,
            in: "query",
            required: parameter.required ?? false,
            schema: parameter.schema,
            ...(parameter.description ? { description: parameter.description } : {}),
          })),
        ],
        responses: {
          "200": {
            description: `${entity.pluralLabel} page.`,
            content: {
              "application/json": {
                schema: schemaRef(listResponse),
              },
            },
          },
          "400": {
            description: "Invalid pagination or filter parameters.",
          },
        },
      });
    }

    if (api.create) {
      addPathOperation(entityPaths, apiPath(api.create), "post", {
        summary: `Create ${entity.label}`,
        description: `Use only when the confirmed App workflow needs the App's own API to create one ${entity.label}.`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: schemaRef(createRequest),
            },
          },
        },
        responses: {
          "201": {
            description: `Created ${entity.label}.`,
            content: {
              "application/json": {
                schema: schemaRef(recordResponse),
              },
            },
          },
          "400": {
            description: "Invalid record data.",
          },
        },
      });
    }

    if (api.update) {
      addPathOperation(entityPaths, api.update, "patch", {
        summary: `Update ${entity.label}`,
        description: `Use only when the confirmed App workflow needs the App's own API to update one ${entity.label}.`,
        parameters: pathParameters(api.update, recordIdParam),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: schemaRef(updateRequest),
            },
          },
        },
        responses: {
          "200": {
            description: `Updated ${entity.label}.`,
            content: {
              "application/json": {
                schema: schemaRef(recordResponse),
              },
            },
          },
          "400": {
            description: "Invalid record data.",
          },
          "404": {
            description: "Record not found.",
          },
        },
      });
    }

    if (api.delete) {
      addPathOperation(entityPaths, api.delete, "delete", {
        summary: `Delete ${entity.label}`,
        description: `Use only when the confirmed App workflow needs the App's own API to delete one ${entity.label}.`,
        parameters: pathParameters(api.delete, recordIdParam),
        responses: {
          "200": {
            description: "Deletion result.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entity_id: { type: "string", enum: [entity.id] },
                    record_id: { type: "string" },
                    deleted: { type: "boolean" },
                  },
                  required: ["entity_id", "record_id", "deleted"],
                  additionalProperties: false,
                },
              },
            },
          },
          "404": {
            description: "Record not found.",
          },
        },
      });
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: definition.app.name,
      version: definition.app.version,
      description: definition.app.description,
    },
    paths: mergeOpenApiPaths({
      "/api/openapi.json": {
        get: {
          summary: "Get OpenAPI document",
          security: [{ appViewerCookie: [] }, { appApiKey: [] }, { appBearer: [] }],
          description:
            "Use as the source of truth for every App-owned API operation the App UI or an agent can call. Data Viewer uses App registration instead.",
          responses: {
            "200": {
              description: "OpenAPI document generated from lib/app-definition/definition.ts.",
            },
          },
        },
      },
      "/api/kylon/workspace-members": {
        get: {
          summary: "List workspace members",
          description:
            "Resolve user ids and populate people pickers after checking the platform-authenticated Human Cookie or Agent API-key caller is a current member of this App workspace. Profiles retain optional emails and roles; private Agent directory entries are omitted. Anonymous and non-member callers receive no members.",
          security: [{ appViewerCookie: [] }, { appApiKey: [] }, { appBearer: [] }],
          responses: {
            "401": { description: "A platform-verified browser or machine App caller is required. Returns an empty members array." },
            "403": { description: "The authenticated caller is not a current member of this App workspace. Returns an empty members array." },
            "503": { description: "Viewer verification is unavailable. Returns an empty members array." },
            "200": {
              description: "Workspace member profiles and optional emails for authenticated workspace members.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WorkspaceMembersResponse" },
                },
              },
            },
          },
        },
      },
      ...entityPaths,
    }, openapiExtension.paths),
    ...(openapiExtension.tags ? { tags: openapiExtension.tags } : {}),
    components: {
      securitySchemes: {
        appApiKey: { type: "apiKey", in: "header", name: "x-api-key" },
        appBearer: { type: "http", scheme: "bearer" },
        appViewerCookie: {
          type: "apiKey",
          in: "cookie",
          name: `p2-app-${definition.app.id}`,
        },
      },
      schemas: {
        WorkspaceMemberProfile: {
          type: "object",
          properties: {
            userId: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            avatarUrl: { type: "string", format: "uri" },
            memberType: { type: "string" },
            role: { type: "string" },
          },
          required: ["userId", "name"],
          additionalProperties: false,
        },
        WorkspaceMembersResponse: {
          type: "object",
          properties: {
            members: {
              type: "array",
              items: { $ref: "#/components/schemas/WorkspaceMemberProfile" },
            },
          },
          required: ["members"],
          additionalProperties: false,
        },
        Pagination: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 500 },
            next_cursor: { type: "string" },
            has_more: { type: "boolean" },
          },
          required: ["limit", "has_more"],
          additionalProperties: false,
        },
        ...(entitiesWithListApi.length
          ? {
              AppRecordListResponse: oneOfEntitySchemas(entitiesWithListApi, "RecordListResponse", {
                type: "object",
                properties: {
                  entity_id: { type: "string" },
                  records: { type: "array", items: { type: "object", additionalProperties: true } },
                  pagination: { $ref: "#/components/schemas/Pagination" },
                },
                required: ["entity_id", "records", "pagination"],
                additionalProperties: false,
              }),
            }
          : {}),
        ...(definition.entities.length
          ? {
              AppRecordResponse: oneOfEntitySchemas(definition.entities, "RecordResponse", {
                type: "object",
                properties: {
                  entity_id: { type: "string" },
                  record_id: { type: "string" },
                  data: { type: "object", additionalProperties: true },
                  created_at: { type: "string", format: "date-time" },
                  updated_at: { type: "string", format: "date-time" },
                },
                required: ["entity_id", "record_id", "data"],
                additionalProperties: false,
              }),
            }
          : {}),
        ...(entitiesWithCreateApi.length
          ? {
              AppRecordCreateRequest: oneOfEntitySchemas(entitiesWithCreateApi, "RecordCreateRequest", {
                type: "object",
                properties: {
                  data: { type: "object", additionalProperties: true },
                },
                required: ["data"],
                additionalProperties: false,
              }),
            }
          : {}),
        ...(entitiesWithUpdateApi.length
          ? {
              AppRecordUpdateRequest: oneOfEntitySchemas(entitiesWithUpdateApi, "RecordUpdateRequest", {
                type: "object",
                properties: {
                  data: { type: "object", additionalProperties: true },
                },
                required: ["data"],
                additionalProperties: false,
              }),
            }
          : {}),
        ...Object.fromEntries(
          definition.entities.flatMap((entity) => {
            const recordData = schemaName(entity, "RecordData");
            const recordResponse = schemaName(entity, "RecordResponse");
            const entries: Array<[string, Record<string, unknown>]> = [
              [recordData, entityRecordDataSchema(entity)],
              [
                recordResponse,
                {
                  type: "object",
                  properties: {
                    entity_id: { type: "string", enum: [entity.id] },
                    record_id: { type: "string" },
                    data: schemaRef(recordData),
                    created_at: { type: "string", format: "date-time" },
                    updated_at: { type: "string", format: "date-time" },
                  },
                  required: ["entity_id", "record_id", "data"],
                  additionalProperties: false,
                },
              ],
            ];

            if (entity.api?.list) {
              const listResponse = schemaName(entity, "RecordListResponse");
              entries.push([
                listResponse,
                {
                  type: "object",
                  properties: {
                    entity_id: { type: "string", enum: [entity.id] },
                    records: { type: "array", items: schemaRef(recordResponse) },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                  required: ["entity_id", "records", "pagination"],
                  additionalProperties: false,
                },
              ]);
            }

            if (entity.api?.create) {
              const createData = schemaName(entity, "RecordCreateData");
              const createRequest = schemaName(entity, "RecordCreateRequest");
              entries.push(
                [createData, entityWriteDataSchema(entity, "create")],
                [
                  createRequest,
                  {
                    type: "object",
                    properties: {
                      data: schemaRef(createData),
                    },
                    required: ["data"],
                    additionalProperties: false,
                  },
                ],
              );
            }

            if (entity.api?.update) {
              const updateData = schemaName(entity, "RecordUpdateData");
              const updateRequest = schemaName(entity, "RecordUpdateRequest");
              entries.push(
                [updateData, entityWriteDataSchema(entity, "update")],
                [
                  updateRequest,
                  {
                    type: "object",
                    properties: {
                      data: schemaRef(updateData),
                    },
                    required: ["data"],
                    additionalProperties: false,
                  },
                ],
              );
            }

            return entries;
          }),
        ),
        ...(openapiExtension.schemas ?? {}),
      },
    },
  };
}
