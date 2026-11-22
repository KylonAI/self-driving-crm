import { workspaceMembersResponse } from "@/lib/kylon/app-auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workspaceMembersResponse(request); }
