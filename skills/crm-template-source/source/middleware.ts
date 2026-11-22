import { requireAuthenticatedAppCaller } from "@/lib/kylon/app-auth";

/** The outer platform middleware owns App visibility and credential verification. */
export function middleware(request: Request) {
  let path = new URL(request.url).pathname;
  try { path = decodeURIComponent(path).replace(/\/+$/, ""); } catch { return; }
  if (path === "/api/openapi.json" || path === "/llms.txt")
    return requireAuthenticatedAppCaller(request) ?? undefined;
  // Directory handlers check membership themselves; business handlers keep their ACLs.
}

export const config = { matcher: ["/:path*"] };
