import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { errorResponse } from "@/lib/crm/server";
import { readSettings, updateSettings } from "@/lib/crm/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  noStore();
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    return Response.json(await readSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
    return Response.json(await updateSettings(body));
  } catch (error) {
    return errorResponse(error);
  }
}
