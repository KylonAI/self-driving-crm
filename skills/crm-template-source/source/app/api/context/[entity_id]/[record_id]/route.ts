import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { errorResponse } from "@/lib/crm/server";
import { recordContext } from "@/lib/crm/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ entity_id: string; record_id: string }> }) {
  noStore();
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    const { entity_id, record_id } = await context.params;
    const result = await recordContext(entity_id, record_id);
    if (!result) return Response.json({ error: "Record not found" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
