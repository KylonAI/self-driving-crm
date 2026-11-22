"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RecordPage } from "@/components/crm/record-view";
import { PageLoading } from "@/components/crm/ui";

export default function Page() {
  const params = useParams<{ personId: string }>();
  return (
    <Suspense fallback={<PageLoading />}>
      <RecordPage type="person" id={decodeURIComponent(params.personId)} />
    </Suspense>
  );
}
