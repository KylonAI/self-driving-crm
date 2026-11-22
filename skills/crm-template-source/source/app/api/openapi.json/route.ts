import openapi from "@/generated/openapi.json";
import registration from "@/generated/app-registration.json";
import { agentDocumentHeaders } from "@/lib/app-definition/agent-documents";

export function GET() {
  return Response.json(openapi, {
    headers: agentDocumentHeaders(registration.manifest.docs.revision, "application/json"),
  });
}
