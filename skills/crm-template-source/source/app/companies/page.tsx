"use client";

import { Suspense } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { PageLoading } from "@/components/crm/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ObjectPage
        entity="companies"
        title={(labels) => labels.companies}
        singular={(labels) => labels.company}
        quickFilters={["relationship", "size_band", "owner"]}
        createFields={["name", "domain", "relationship", "industry", "country", "owner"]}
      />
    </Suspense>
  );
}
