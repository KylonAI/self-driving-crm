/** Kylon's outer middleware verifies Cookies/API keys and overwrites this header,
 * including `anonymous` on public requests. Keep that wrapper outside this code.
 * Raw client identity headers are not an authentication source. */
export function authenticatedCallerId(request: Request): string | null {
  const id = request.headers.get("x-p2-user-id")?.trim();
  return id && id !== "anonymous" ? id : null;
}

type Member = {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  memberType?: string;
  role?: string;
};
type Membership = { members: Member[] } | { status: 401 | 403 | 503 };

async function workspaceMembership(request: Request): Promise<Membership> {
  const callerId = authenticatedCallerId(request);
  if (!callerId) return { status: 401 };
  const base = process.env.KYLON_API_BASE ?? process.env.P2_API_BASE;
  const workspaceId = process.env.KYLON_WORKSPACE_ID ?? process.env.WORKSPACE_ID;
  const token = process.env.KYLON_API_TOKEN ?? process.env.PURECLAW_API_TOKEN;
  if (!base || !workspaceId || !token) return { status: 503 };
  try {
    // Runtime credentials may read the roster, but never establish caller identity.
    const response = await fetch(`${base.replace(/\/+$/, "")}/workspaces/${encodeURIComponent(workspaceId)}/members`, {
      headers: { accept: "application/json", "x-api-key": token },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { status: 503 };
    const body = await response.json();
    if (!Array.isArray(body?.members)) return { status: 503 };
    const members = body.members.filter((member: unknown): member is Record<string, unknown> =>
      member !== null && typeof member === "object" && !Array.isArray(member) &&
      typeof (member as Record<string, unknown>).userId === "string");
    // Both Human and Agent membership qualify. Never filter to Humans before this check.
    if (!members.some((member: Record<string, unknown>) => member.userId === callerId)) return { status: 403 };
    return { members: members
      .filter((member: Record<string, unknown>) => !(member.memberType === "agent" && member.role === "private"))
      .map((member: Record<string, unknown>) => ({
        userId: member.userId as string,
        name: typeof member.userName === "string" && member.userName.trim() ? member.userName : member.userId as string,
        ...(typeof member.userEmail === "string" && member.userEmail ? { email: member.userEmail } : {}),
        ...(typeof member.userAvatarUrl === "string" && member.userAvatarUrl ? { avatarUrl: member.userAvatarUrl } : {}),
        ...(typeof member.memberType === "string" ? { memberType: member.memberType } : {}),
        ...(typeof member.role === "string" ? { role: member.role } : {}),
      })) };
  } catch { return { status: 503 }; }
}

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization, x-api-key" };

/** Used for workspace directory data, never as a blanket business-API gate. */
export async function requireWorkspaceMember(request: Request): Promise<Response | null> {
  const result = await workspaceMembership(request);
  if ("members" in result) return null;
  return Response.json({ error: result.status === 401 ? "App authentication required" : result.status === 403 ? "Workspace membership required" : "Workspace authorization unavailable" },
    { status: result.status, headers: privateHeaders });
}

export async function workspaceMembersResponse(request: Request): Promise<Response> {
  const result = await workspaceMembership(request);
  return Response.json({ members: "members" in result ? result.members : [] },
    { status: "members" in result ? 200 : result.status, headers: privateHeaders });
}

/** The outer platform middleware has already checked this App's visibility. */
export function requireAuthenticatedAppCaller(request: Request): Response | null {
  return authenticatedCallerId(request) ? null : Response.json({ error: "App authentication required" },
    { status: 401, headers: privateHeaders });
}
