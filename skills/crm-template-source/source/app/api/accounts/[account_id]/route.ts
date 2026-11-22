import { accounts } from "@/lib/crm/entities";
import { recordRoutes } from "@/lib/crm/routes";

export const dynamic = "force-dynamic";
export const { GET, PATCH, DELETE } = recordRoutes(accounts);
