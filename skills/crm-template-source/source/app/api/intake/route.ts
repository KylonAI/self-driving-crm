import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { requestActor } from "@/lib/kylon/request-actor";
import { errorResponse } from "@/lib/crm/server";
import { runIntake } from "@/lib/crm/intake";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
    return Response.json(await runIntake(body, requestActor(request).actorId));
  } catch (error) {
    return errorResponse(error);
  }
}
