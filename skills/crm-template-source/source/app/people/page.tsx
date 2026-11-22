"use client";

import { Suspense } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { PageLoading } from "@/components/crm/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ObjectPage
        entity="people"
        title={(labels) => labels.people}
        singular={(labels) => labels.person}
        quickFilters={["role", "outreach_status", "owner"]}
        createFields={["name", "email", "title", "company_id", "role", "owner"]}
      />
    </Suspense>
  );
}
