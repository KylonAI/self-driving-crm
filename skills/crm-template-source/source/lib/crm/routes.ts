import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { requestActor } from "@/lib/kylon/request-actor";
import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { type CrmEntitySpec } from "@/lib/crm/entities";
import {
  CrmError,
  createRecord,
  deleteRecord,
  errorResponse,
  getRow,
  listRecords,
  parseListControls,
  toListResponse,
  toResponse,
  updateRecord,
} from "@/lib/crm/server";

type Params = { params: Promise<Record<string, string>> };

async function readData(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CrmError("Body must be JSON", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CrmError("Body must be a JSON object", 400);
  const data = "data" in body ? (body as { data: unknown }).data : body;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new CrmError("data must be an object", 400);
  return data as Record<string, unknown>;
}

export function collectionRoutes(spec: CrmEntitySpec) {
  return {
    async GET(request: Request) {
      noStore();
      const denied = requireAuthenticatedAppCaller(request);
      if (denied) return denied;
      try {
        const result = await listRecords(spec, parseListControls(new URL(request.url).searchParams));
        return Response.json(toListResponse(spec, result), { headers: { "x-total-count": String(result.total) } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    async POST(request: Request) {
      const denied = requireAuthenticatedAppCaller(request);
      if (denied) return denied;
      try {
        const row = await createRecord(spec, await readData(request), requestActor(request).actorId);
        return Response.json(toResponse(spec, row), { status: 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function recordRoutes(spec: CrmEntitySpec) {
  const idOf = async (context: Params) => (await context.params)[spec.recordIdParam] ?? "";
  return {
    async GET(request: Request, context: Params) {
      noStore();
      const denied = requireAuthenticatedAppCaller(request);
      if (denied) return denied;
      try {
        const row = await getRow(spec, await idOf(context));
        if (!row) return Response.json({ error: `${spec.label} not found` }, { status: 404 });
        return Response.json(toResponse(spec, row));
      } catch (error) {
        return errorResponse(error);
      }
    },
    async PATCH(request: Request, context: Params) {
      const denied = requireAuthenticatedAppCaller(request);
      if (denied) return denied;
      try {
        const row = await updateRecord(spec, await idOf(context), await readData(request), requestActor(request).actorId);
        return Response.json(toResponse(spec, row));
      } catch (error) {
        return errorResponse(error);
      }
    },
    async DELETE(request: Request, context: Params) {
      const denied = requireAuthenticatedAppCaller(request);
      if (denied) return denied;
      try {
        const id = await idOf(context);
        await deleteRecord(spec, id, requestActor(request).actorId);
        return Response.json({ entity_id: spec.id, record_id: id, deleted: true });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
