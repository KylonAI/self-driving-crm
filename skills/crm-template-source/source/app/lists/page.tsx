"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { PageLoading } from "@/components/crm/ui";

function ListsPage() {
  const router = useRouter();
  return (
    <ObjectPage
      entity="lists"
      title={() => "Lists"}
      singular={() => "List"}
      columns={["name", "kind", "description", "owner"]}
      createFields={["name", "kind", "description", "owner"]}
      createDefaults={{ kind: "people" }}
      emptyText="No lists yet. A list is a named set of people or companies, such as an event guest list or an outreach batch."
      onRowOpen={(row) => router.push(`/lists/${encodeURIComponent(row.record_id)}` as Route)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ListsPage />
    </Suspense>
  );
}
