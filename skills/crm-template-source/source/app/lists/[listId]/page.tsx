"use client";

import { Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { toast } from "sonner";
import { RelationPicker } from "@/components/crm/fields";
import { RecordPanel } from "@/components/crm/record-view";
import { EmptyState, InlineError, PageLoading, RecordAvatar, SkeletonRows } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { api, crmKeys, relationOf, useCreateRecord, useDeleteRecord, useRecords, useSettings, type CrmRecord } from "@/lib/crm/client";
import { DEFAULT_LABELS } from "@/lib/crm/presets";
import { parseRecordParam, recordParam, useQueryState } from "@/lib/crm/url";
import { useQuery } from "@tanstack/react-query";

function ListPage() {
  const params = useParams<{ listId: string }>();
  const listId = decodeURIComponent(params.listId);
  const { params: query, update } = useQueryState();
  const labels = useSettings().data?.labels ?? DEFAULT_LABELS;
  const list = useQuery({
    queryKey: [...crmKeys.lists("lists"), "one", listId],
    queryFn: () => api<CrmRecord>(`/api/lists/${encodeURIComponent(listId)}`),
  });
  const filters = useMemo(() => [{ field_id: "list_id", operator: "eq", value: listId }], [listId]);
  const members = useRecords("list_members", { filters, pageSize: 200 });
  const add = useCreateRecord("list_members");
  const remove = useDeleteRecord("list_members");
  const record = parseRecordParam(query.get("record"));
  const kind = list.data?.data.kind === "companies" ? "companies" : "people";

  if (list.isPending) return <PageLoading />;
  if (list.isError)
    return (
      <div className="p-6">
        <InlineError message={list.error.message} />
      </div>
    );
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 px-6 pt-5 pb-3">
          <Link href={"/lists" as Route} className="text-[12px] text-ky-ink-2 hover:text-ky-ink">
            Lists
          </Link>
          <h1 className="text-[20px] font-semibold tracking-[-0.3px]">{String(list.data.data.name ?? "List")}</h1>
          {list.data.data.description ? <p className="text-[13px] text-ky-ink-2">{String(list.data.data.description)}</p> : null}
        </div>
        <div className="flex items-center gap-2 px-6 pb-3">
          <div className="w-[280px]">
            <RelationPicker
              entity={kind}
              value={null}
              placeholder={`Add ${kind === "people" ? labels.person.toLowerCase() : labels.company.toLowerCase()}`}
              onPick={(picked) => {
                if (!picked) return;
                add.mutate(
                  { list_id: listId, label: picked.label, ...(kind === "people" ? { person_id: picked.id } : { company_id: picked.id }) },
                  { onError: (error) => toast.error(error.message.includes("already") ? "Already on this list" : error.message) },
                );
              }}
            />
          </div>
          <span className="text-[13px] text-ky-ink-3 tabular-nums">{members.total ?? 0} on this list</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-ky-hairline">
          {members.isPending ? (
            <SkeletonRows columns={3} />
          ) : members.rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Nobody on this list yet. Add people above, or ask an Agent to fill it." />
            </div>
          ) : (
            <ul>
              {members.rows.map((member) => {
                const target = relationOf(member.data.person_id) ?? relationOf(member.data.company_id);
                const type = member.data.person_id ? "person" : "company";
                return (
                  <li key={member.record_id} className="crm-row flex h-11 items-center gap-2.5 border-b border-ky-divider px-6">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => target && update({ record: recordParam(type, target.id) }, "push")}
                    >
                      <RecordAvatar type={type} name={String(member.data.label ?? "")} size={22} />
                      <span className="truncate text-[13px] font-semibold">{String(target?.label || member.data.label || "")}</span>
                    </button>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove from list" onClick={() => remove.mutate(member.record_id)}>
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      {record ? <RecordPanel type={record.type} id={record.id} onClose={() => update({ record: null })} /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ListPage />
    </Suspense>
  );
}
