"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RecordPage } from "@/components/crm/record-view";
import { EmptyState, PageLoading } from "@/components/crm/ui";
import { RECORD_ENTITY, type RecordType } from "@/lib/crm/url";

/** A record without the App's navigation, for Kylon to present in a 16:9 frame. Same view as the full page. */
export default function Page() {
  const params = useParams<{ type: string; id: string }>();
  const type = params.type as RecordType;
  if (!(type in RECORD_ENTITY))
    return (
      <div className="flex-1 p-6">
        <EmptyState title="This kind of record cannot be presented." />
      </div>
    );
  return (
    <Suspense fallback={<PageLoading />}>
      <RecordPage type={type} id={decodeURIComponent(params.id)} present />
    </Suspense>
  );
}
