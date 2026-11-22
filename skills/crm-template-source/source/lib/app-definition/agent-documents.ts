import { createHash } from "node:crypto";
import type { AppManifest, AppRegistration } from "@/lib/app-definition/types";

export interface PageRoute {
  path: string;
  parameters: string[];
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const object = record(value);
  return object
    ? Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonical(object[key])]))
    : value;
}

function operations(openapi: Record<string, unknown>) {
  return Object.entries(record(openapi.paths) ?? {}).sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, item]) => METHODS.flatMap((method) => {
      const operation = record(record(item)?.[method]);
      return operation ? [{ path, method, operation, item: record(item)! }] : [];
    }));
}

/** Preserve authored ids. Missing ids are stable under unrelated additions. */
function withOperationIds(openapi: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(openapi);
  const used = new Set<string>();
  for (const { path, method, operation } of operations(result)) {
    const authored = text(operation.operationId);
    const suffix = createHash("sha256").update(`${method} ${path}`).digest("hex").slice(0, 10);
    const id = authored || `${method}_${path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${suffix}`;
    if (used.has(id)) throw new Error(`Duplicate OpenAPI operationId: ${id}`);
    used.add(id);
    operation.operationId = id;
  }
  return result;
}

function validateReferences(openapi: Record<string, unknown>): void {
  const checkReference = (value: unknown): void => {
    const object = record(value);
    if (!object) return;
    if (typeof object.$ref === "string" && object.$ref.startsWith("#/")) {
      let target: unknown = openapi;
      for (const part of object.$ref.slice(2).split("/")) {
        target = target && typeof target === "object"
          ? (target as Record<string, unknown>)[decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~")]
          : undefined;
      }
      if (target === undefined) throw new Error(`Unresolved OpenAPI reference: ${object.$ref}`);
    }
  };
  const visitMap = (value: unknown, visit: (entry: unknown) => void): void => {
    Object.values(record(value) ?? {}).forEach(visit);
  };
  const visitArray = (value: unknown, visit: (entry: unknown) => void): void => {
    if (Array.isArray(value)) value.forEach(visit);
  };

  // Walk schema-valued keywords, not instance data such as example(s), enum,
  // const or default. Map keys are authored names: a property named "example"
  // still contains a schema, and a property named "$ref" is not itself a ref.
  const visitSchema = (value: unknown): void => {
    const schema = record(value);
    if (!schema) return;
    checkReference(schema);
    for (const key of ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas", "dependencies"]) {
      visitMap(schema[key], visitSchema);
    }
    for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
      visitArray(schema[key], visitSchema);
    }
    for (const key of ["items", "additionalItems", "contains", "additionalProperties", "unevaluatedItems", "unevaluatedProperties", "propertyNames", "not", "if", "then", "else", "contentSchema"]) {
      if (Array.isArray(schema[key])) visitArray(schema[key], visitSchema);
      else visitSchema(schema[key]);
    }
  };
  const visitContent = (value: unknown): void => {
    visitMap(value, (entry) => {
      const media = record(entry);
      if (!media) return;
      visitSchema(media.schema);
      // examples.* can be a Reference Object; examples.*.value is literal data.
      visitMap(media.examples, checkReference);
      visitMap(media.encoding, (encoding) => visitMap(record(encoding)?.headers, visitParameter));
    });
  };
  const visitParameter = (value: unknown): void => {
    const parameter = record(value);
    if (!parameter) return;
    checkReference(parameter);
    visitSchema(parameter.schema);
    visitMap(parameter.examples, checkReference);
    visitContent(parameter.content);
  };
  const visitRequestBody = (value: unknown): void => {
    checkReference(value);
    visitContent(record(value)?.content);
  };
  const visitResponse = (value: unknown): void => {
    checkReference(value);
    const response = record(value);
    visitMap(response?.headers, visitParameter);
    visitContent(response?.content);
    // Link parameters and requestBody are expressions or literal values.
    visitMap(response?.links, checkReference);
  };
  const visitCallback = (value: unknown): void => {
    checkReference(value);
    for (const [expression, item] of Object.entries(record(value) ?? {})) {
      if (expression !== "$ref" && !expression.startsWith("x-")) visitPathItem(item);
    }
  };
  const visitPathItem = (value: unknown): void => {
    checkReference(value);
    const item = record(value);
    if (!item) return;
    visitArray(item.parameters, visitParameter);
    for (const method of METHODS) {
      const operation = record(item[method]);
      if (!operation) continue;
      visitArray(operation.parameters, visitParameter);
      visitRequestBody(operation.requestBody);
      for (const [status, response] of Object.entries(record(operation.responses) ?? {})) {
        if (!status.startsWith("x-")) visitResponse(response);
      }
      visitMap(operation.callbacks, visitCallback);
    }
  };

  // Only OpenAPI reference/schema slots have reference semantics. Arbitrary
  // payloads and specification extensions must never be interpreted as docs.
  for (const [path, item] of Object.entries(record(openapi.paths) ?? {})) {
    if (path.startsWith("/")) visitPathItem(item);
  }
  visitMap(openapi.webhooks, visitPathItem);
  const components = record(openapi.components);
  visitMap(components?.schemas, visitSchema);
  visitMap(components?.responses, visitResponse);
  visitMap(components?.parameters, visitParameter);
  visitMap(components?.headers, visitParameter);
  visitMap(components?.requestBodies, visitRequestBody);
  visitMap(components?.examples, checkReference);
  visitMap(components?.links, checkReference);
  visitMap(components?.callbacks, visitCallback);
  visitMap(components?.securitySchemes, checkReference);
  visitMap(components?.pathItems, visitPathItem);
}

function renderLlms(
  manifest: AppManifest,
  openapi: Record<string, unknown>,
  routes: readonly PageRoute[],
  revision: string,
): string {
  const info = record(openapi.info);
  const lines = [
    `# ${text(manifest.app.name)}`,
    "",
    `> ${text(info?.description) || "Use this App's documented operations and pages."}`,
    "",
    `App version: ${manifest.app.version}. Documentation revision: ${revision}.`,
    "Resolve relative API and page URLs against the origin where you read this file. Keep preview calls on the preview origin.",
    "",
    "## Access",
    "",
    "Access follows the App's current visibility and permissions. For a private App, an external API caller needs a valid Kylon-issued credential supplied by an authorized App owner, sent as `Authorization: Bearer <credential>`. Browser pages use the App's login flow. This document contains no credentials.",
    "If a request returns a login page, a redirect to sign-in, 401 or 403, resolve access before interpreting the response as data.",
    "",
    "## How to call",
    "",
    "Read the linked OpenAPI before an API call. Find the operation by its HTTP method and path, then use its exact parameters, request schema, responses and documented errors. Prefer a documented business operation when it covers the task; a generic record write does not imply a business workflow.",
    "Use record ids returned by the API for subsequent calls and page parameters. Field labels and display names are not record ids.",
    "Pagination, filtering, business workflows and retry guarantees are defined by the operation's description and schemas. If they are not documented, do not invent them. Do not automatically repeat a write whose outcome is unknown unless its contract guarantees idempotency.",
    "Check `X-App-Docs-Revision` on this file and OpenAPI. If they differ, re-read the documents before combining them.",
    "",
  ];
  if (manifest.data.entities.length) {
    lines.push("## Records", "");
    for (const entity of manifest.data.entities) {
      lines.push(`- \`${entity.id}\`: ${text(entity.label)}. ${text(entity.description)} Record id: \`${entity.record_id_field}\`; display field: \`${entity.title_field}\`.`);
      const fields = entity.fields.filter((field) => !field.system);
      if (fields.length) {
        lines.push(`  Fields: ${fields.map((field) => `\`${field.id}\` (${text(field.label)}, ${field.type}${field.required ? ", required" : ""})`).join("; ")}.`);
      }
      for (const relation of entity.relationships) {
        lines.push(`  Relationship: ${relation.type} \`${relation.entity_id}\`${relation.foreign_key ? ` via \`${relation.foreign_key}\`` : ""}.`);
      }
    }
    lines.push("");
  }
  const list = operations(openapi);
  lines.push("## Documented operations", "",
    "This is a quick overview of the operations defined in [API reference](#api-reference). Use it to choose an operation; read OpenAPI for its exact parameters, request and response schemas, and full description before calling.", "");
  if (!list.length) lines.push("No API operations are declared for this version.");
  for (const { path, method, operation, item } of list) {
    lines.push(`- ${method.toUpperCase()} \`${path}\`: ${text(operation.summary) || text(operation.description) || "See OpenAPI."}`);
    const description = text(operation.description);
    if (description && description !== text(operation.summary)) {
      // Keep the entry small; explicitly send the caller to the complete contract.
      lines.push(`  ${description.length > 600 ? `${description.slice(0, 600)}… Full description in OpenAPI.` : description}`);
    }
    const parameters = [...(Array.isArray(item.parameters) ? item.parameters : []),
      ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
    const described = parameters.map(record).filter((p) => p && text(p.description));
    if (described.length) {
      lines.push(`  Parameters: ${described.map((p) => `\`${text(p!.name)}\`: ${text(p!.description)}`).join("; ")}.`);
    }
  }
  lines.push("", "## Page URL patterns", "");
  for (const route of routes) {
    lines.push(`- \`${route.path}\`${route.parameters.length ? `: replace ${route.parameters.map((p) => `\`${p}\``).join(", ")} with real URL-encoded values; a catch-all accepts path segments.` : ": directly addressable page."}`);
  }
  if (!routes.length) lines.push("No standard page routes were discovered.");
  lines.push("Query parameters, transient component state, parallel and intercepted navigation are not inferred from page filenames.",
    "", "## API reference", "",
    `- [OpenAPI](${manifest.docs?.openapi_url ?? "/api/openapi.json"}): Complete API contract for the operations summarized in Documented operations, including parameter types, required fields, request and response schemas, full descriptions and documented errors.`,
    "", "## Pages", "");
  const staticRoutes = routes.filter((route) => !route.parameters.length);
  for (const route of staticRoutes) lines.push(`- [${route.path}](${encodeURI(route.path)}): Browser page; follows App access rules.`);
  if (!staticRoutes.length) lines.push("- [App home](/): Use the URL patterns above for parameterized pages.");
  return `${lines.join("\n")}\n`;
}

/** Derived output only: AppDefinition's authoring schema remains unchanged. */
export function attachAgentDocumentation(
  registration: AppRegistration,
  routes: readonly PageRoute[] = [],
): AppRegistration {
  const manifest = structuredClone(registration.manifest);
  manifest.docs = { openapi_url: "/api/openapi.json", llms_url: "/llms.txt",
    page_routes: [...routes].map((route) => route.path).sort() };
  const openapi = withOperationIds(registration.openapi ?? {});
  // Registration retains the production base_url; HTTP API discovery stays same-origin.
  openapi.servers = [{ url: "/" }];
  validateReferences(openapi);
  const sortedRoutes = [...routes].sort((a, b) => a.path.localeCompare(b.path));
  const draft = renderLlms(manifest, openapi, sortedRoutes, "");
  const revision = createHash("sha256")
    .update(JSON.stringify(canonical({ manifest, openapi, llms: draft })))
    .digest("hex");
  manifest.docs.revision = revision;
  openapi["x-kylon-docs-revision"] = revision;
  return { ...registration, manifest, openapi, agent_docs: renderLlms(manifest, openapi, sortedRoutes, revision) };
}

export function agentDocumentHeaders(revision: string | undefined, contentType: string) {
  return {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Cache-Control": "private, no-cache",
    Vary: "Authorization, Cookie",
    Link: '</llms.txt>; rel="describedby"',
    ...(revision ? { "X-App-Docs-Revision": revision, ETag: `"${revision}"` } : {}),
  };
}
