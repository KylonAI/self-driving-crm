import { reviewItems } from "@/lib/crm/entities";
import { collectionRoutes } from "@/lib/crm/routes";

export const dynamic = "force-dynamic";
export const { GET, POST } = collectionRoutes(reviewItems);
