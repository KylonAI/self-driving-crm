"use client";

import { Check } from "lucide-react";
import { Suspense, useMemo } from "react";
import { ObjectPage } from "@/components/crm/object-page";
import { Segmented } from "@/components/crm/segmented";
import { MemberChip, PageLoading, RecordChip, Tag } from "@/components/crm/ui";
import { type CrmRecord, relationOf, text, useUpdateRecord } from "@/lib/crm/client";
import { formatDate, todayIso } from "@/lib/crm/display";
import { useQueryState } from "@/lib/crm/url";
import { readUrlState } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const VIEWS = ["open", "done"] as const;

function TaskRow({ task, onOpen }: { task: CrmRecord; onOpen: () => void }) {
  const update = useUpdateRecord("tasks");
  const done = task.data.status !== "open";
  const due = text(task, "due_date");
  const overdue = !done && due && due < todayIso();
  const person = relationOf(task.data.person_id);
  const company = relationOf(task.data.company_id);
  const deal = relationOf(task.data.deal_id);
  return (
    <li className="flex items-start gap-3 border-b border-ky-divider px-6 py-3">
      <button
        type="button"
        aria-label={done ? "Reopen" : "Mark done"}
        onClick={() => update.mutate({ id: task.record_id, data: { status: done ? "open" : "done" } })}
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border",
          done ? "border-ky-accent bg-ky-accent text-ky-on-solid" : "border-ky-hairline hover:bg-ky-hover",
        )}
      >
        {done ? <Check className="size-3" /> : null}
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className={cn("text-[13px] text-ky-ink", done && "text-ky-ink-3 line-through")}>{String(task.data.title ?? "")}</span>
        <span className="flex flex-wrap items-center gap-2 text-[12px] text-ky-ink-3">
          {due ? overdue ? <Tag tone="clay">Due {formatDate(due)}</Tag> : <span className="tabular-nums">Due {formatDate(due)}</span> : <span>No due date</span>}
          {person ? <RecordChip type="person" id={person.id} name={person.label} /> : null}
          {company ? <RecordChip type="company" id={company.id} name={company.label} /> : null}
          {deal ? <RecordChip type="deal" id={deal.id} name={deal.label} /> : null}
        </span>
      </button>
      <MemberChip userId={text(task, "owner")} className="shrink-0" />
    </li>
  );
}

function FollowUpsPage() {
  const { params, update } = useQueryState();
  const view = readUrlState(params, "view", VIEWS, "open");
  const baseFilters = useMemo(
    () => [view === "open" ? { field_id: "status", operator: "eq", value: "open" } : { field_id: "status", operator: "neq", value: "open" }],
    [view],
  );
  return (
    <ObjectPage
      key={view}
      entity="tasks"
      title={() => "Follow-ups"}
      singular={() => "Follow-up"}
      baseFilters={baseFilters}
      quickFilters={["owner"]}
      createFields={["title", "due_date", "owner", "person_id", "company_id", "deal_id"]}
      createDefaults={{ status: "open" }}
      emptyText={view === "open" ? "Nothing is waiting. Follow-ups you or your Automations add show up here." : "Nothing has been closed yet."}
      toolbarExtra={
        <Segmented
          label="Follow-up view"
          value={view}
          onChange={(next) => update({ view: next === "open" ? null : next })}
          options={[
            { id: "open", label: "Open" },
            { id: "done", label: "Closed" },
          ]}
        />
      }
      renderBody={(rows) => (
        <ul>
          {rows.map((task) => {
            const person = relationOf(task.data.person_id);
            const company = relationOf(task.data.company_id);
            const deal = relationOf(task.data.deal_id);
            const target = person ? { type: "person" as const, id: person.id } : deal ? { type: "deal" as const, id: deal.id } : company ? { type: "company" as const, id: company.id } : null;
            return <TaskRow key={task.record_id} task={task} onOpen={() => target && update({ record: `${target.type}:${target.id}` }, "push")} />;
          })}
          {rows.length === 0 ? <li className="px-6 py-6 text-[13px] text-ky-ink-3">Nothing here.</li> : null}
        </ul>
      )}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FollowUpsPage />
    </Suspense>
  );
}
