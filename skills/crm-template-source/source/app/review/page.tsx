"use client";

import { Suspense, useMemo } from "react";
import { toast } from "sonner";
import { PageFrame } from "@/components/crm/page-frame";
import { Segmented } from "@/components/crm/segmented";
import { EmptyState, InlineError, MemberChip, PageLoading, RecordChip, SkeletonRows, StateLabel } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { text, useRecords, useResolveReview } from "@/lib/crm/client";
import { labeled, relativeTime } from "@/lib/crm/display";
import { REVIEW_KIND_OPTIONS, REVIEW_STATUS_OPTIONS } from "@/lib/crm/entities";
import { ENTITY_RECORD, useQueryState } from "@/lib/crm/url";
import { readUrlState } from "@/lib/url-state";
import { RecordPanel } from "@/components/crm/record-view";
import { parseRecordParam } from "@/lib/crm/url";

const VIEWS = ["open", "closed"] as const;

function ReviewPage() {
  const { params, update } = useQueryState();
  const view = readUrlState(params, "view", VIEWS, "open");
  const filters = useMemo(() => [view === "open" ? { field_id: "status", operator: "eq", value: "open" } : { field_id: "status", operator: "neq", value: "open" }], [view]);
  const items = useRecords("review_items", { filters, sorts: [{ field_id: "created_at", direction: "desc" }] });
  const resolve = useResolveReview();
  const record = parseRecordParam(params.get("record"));
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <PageFrame
        title="Review"
        subtitle="What the CRM was not sure about: two sources disagreeing on a value, possible duplicates, missing information. Accept writes the proposed value into the record; dismiss keeps what is there."
        actions={
          <Segmented
            label="Review view"
            value={view}
            onChange={(next) => update({ view: next === "open" ? null : next })}
            options={[
              { id: "open", label: "Open" },
              { id: "closed", label: "Closed" },
            ]}
          />
        }
      >
        {items.isError ? <InlineError message={items.error.message} /> : null}
        {items.isPending ? <SkeletonRows columns={4} /> : null}
        {!items.isPending && items.rows.length === 0 ? (
          <EmptyState title={view === "open" ? "Nothing to review. Conflicts and possible duplicates from your Automations show up here." : "Nothing has been resolved yet."} />
        ) : null}
        <ul className="flex flex-col border-t border-ky-hairline">
          {items.rows.map((item) => {
            const entity = text(item, "entity");
            const type = entity ? ENTITY_RECORD[entity] : undefined;
            const recordId = text(item, "record_id");
            const open = item.data.status === "open";
            return (
              <li key={item.record_id} className="flex flex-col gap-2 border-b border-ky-divider py-3 min-[720px]:flex-row min-[720px]:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ky-ink-3">
                    <StateLabel state={labeled(REVIEW_KIND_OPTIONS, item.data.kind)} plainClassName="text-[12px] text-ky-ink-2" />
                    {!open ? <StateLabel state={labeled(REVIEW_STATUS_OPTIONS, item.data.status)} plainClassName="text-[12px]" /> : null}
                    <span>{relativeTime(item.created_at)}</span>
                    {text(item, "source") ? <span>from {text(item, "source")}</span> : null}
                  </div>
                  <p className="text-[13px] font-semibold text-ky-ink">{String(item.data.title ?? "")}</p>
                  {text(item, "reason") ? <p className="text-[13px] leading-5 text-ky-ink-2">{text(item, "reason")}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {type && recordId ? <RecordChip type={type} id={recordId} name="Open record" /> : null}
                    {!open && text(item, "resolved_by") ? <MemberChip userId={text(item, "resolved_by")} /> : null}
                  </div>
                </div>
                {open ? (
                  <div className="flex shrink-0 gap-1.5">
                    {text(item, "field") ? (
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ id: item.record_id, decision: "accept" }, { onError: (error) => toast.error(error.message) })}
                      >
                        Accept
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: item.record_id, decision: "dismiss" }, { onError: (error) => toast.error(error.message) })}
                    >
                      {text(item, "field") ? "Keep current" : "Done"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {items.hasNextPage ? (
          <Button size="sm" variant="secondary" disabled={items.isFetchingNextPage} onClick={() => void items.fetchNextPage()}>
            Show more
          </Button>
        ) : null}
      </PageFrame>
      {record ? <RecordPanel type={record.type} id={record.id} onClose={() => update({ record: null })} /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReviewPage />
    </Suspense>
  );
}
