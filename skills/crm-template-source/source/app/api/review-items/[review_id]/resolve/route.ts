import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { requestActor } from "@/lib/kylon/request-actor";
import { entitySpec, reviewItems } from "@/lib/crm/entities";
import { CrmError, errorResponse, getRow, toResponse, updateRecord } from "@/lib/crm/server";

export const dynamic = "force-dynamic";

/** Accept applies the proposed value to the record it is about; dismiss only closes the item. */
export async function POST(request: Request, context: { params: Promise<{ review_id: string }> }) {
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    const { review_id } = await context.params;
    const actor = requestActor(request).actorId;
    const body = (await request.json().catch(() => null)) as { decision?: unknown } | null;
    const decision = body?.decision;
    if (decision !== "accept" && decision !== "dismiss") throw new CrmError("decision must be accept or dismiss", 400);
    const item = await getRow(reviewItems, review_id);
    if (!item) throw new CrmError("Review item not found", 404);
    if (item.status !== "open") throw new CrmError("This item was already resolved", 409);
    if (decision === "accept" && item.entity && item.record_id && item.field) {
      const spec = entitySpec(String(item.entity));
      if (!spec) throw new CrmError("The item points at an unknown object", 400);
      await updateRecord(spec, String(item.record_id), { [String(item.field)]: item.proposed_value ?? null }, actor);
    }
    const row = await updateRecord(
      reviewItems,
      review_id,
      { status: decision === "accept" ? "accepted" : "dismissed", resolved_at: new Date().toISOString(), ...(actor ? { resolved_by: actor } : {}) },
      actor,
    );
    return Response.json(toResponse(reviewItems, row));
  } catch (error) {
    return errorResponse(error);
  }
}
