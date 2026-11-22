import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { errorResponse } from "@/lib/crm/server";
import { requestActor } from "@/lib/kylon/request-actor";
import { home } from "@/lib/crm/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  noStore();
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    const mine = new URL(request.url).searchParams.get("scope") !== "everyone";
    return Response.json(await home(mine ? requestActor(request).actorId : null));
  } catch (error) {
    return errorResponse(error);
  }
}
