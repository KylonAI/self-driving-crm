import { requestActor } from "@/lib/kylon/request-actor";

export const dynamic = "force-dynamic";

/** Who is looking at the App, for "Mine" filters. */
export function GET(request: Request) {
  const actor = requestActor(request);
  return Response.json({ id: actor.actorId }, { headers: { "Cache-Control": "private, no-store" } });
}
