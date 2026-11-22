import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";
import { errorResponse } from "@/lib/crm/server";
import { insights } from "@/lib/crm/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  noStore();
  const denied = requireAuthenticatedAppCaller(request);
  if (denied) return denied;
  try {
    return Response.json(await insights());
  } catch (error) {
    return errorResponse(error);
  }
}
