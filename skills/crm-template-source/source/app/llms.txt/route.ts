import registration from "@/generated/app-registration.json";
import { agentDocumentHeaders } from "@/lib/app-definition/agent-documents";

export function GET() {
  return new Response(registration.agent_docs, {
    headers: agentDocumentHeaders(registration.manifest.docs.revision, "text/plain"),
  });
}
