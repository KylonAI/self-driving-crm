"use client";

import { Suspense } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { PageLoading } from "@/components/crm/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ObjectPage
        entity="accounts"
        title={(labels) => labels.accounts}
        singular={(labels) => labels.account}
        quickFilters={["status", "health", "account_manager"]}
        createFields={["name", "company_id", "status", "plan", "value", "account_manager", "renewal_date"]}
        createDefaults={{ status: "active" }}
      />
    </Suspense>
  );
}
