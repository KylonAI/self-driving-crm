"use client";

import { ArrowUpRight, Check, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { FieldDisplay, FieldEditor, MemberPicker, StageTag } from "@/components/crm/fields";
import { EmptyState, InlineError, MemberChip, RecordAvatar, RecordChip, RecordTypeLabel, StateLabel, Tag } from "@/components/crm/ui";
import { useKylonWorkspaceContext } from "@/components/providers/kylon-workspace-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  type CrmRecord,
  type RecordContext,
  relationOf,
  text,
  useCreateRecord,
  useDeleteRecord,
  useRecordContext,
  useSettings,
  useUpdateRecord,
} from "@/lib/crm/client";
import { formatDate, formatDateTime, formatMoney, labeled, relativeTime, todayIso } from "@/lib/crm/display";
import { ACTIVITY_KIND_OPTIONS, type CrmFieldSpec, entitySpec } from "@/lib/crm/entities";
import { DEFAULT_LABELS, type ObjectLabels } from "@/lib/crm/presets";
import { appRecordThreadHref, openKylonUrl } from "@/lib/kylon/bridge";
import { ENTITY_RECORD, RECORD_ENTITY, RECORD_ROUTE, type RecordType, recordParam, useQueryState } from "@/lib/crm/url";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "activity" | "followups" | "related" | "history";

const TYPE_LABEL: Record<RecordType, keyof ObjectLabels> = { company: "company", person: "person", account: "account", deal: "deal" };

function typeLabel(type: RecordType, labels: ObjectLabels) {
  return labels[TYPE_LABEL[type]];
}

function subline(type: RecordType, record: CrmRecord, currency: string): string {
  const parts: string[] = [];
  const company = relationOf(record.data.company_id)?.label;
  if (type === "person") {
    const title = text(record, "title");
    if (title && company) parts.push(`${title} at ${company}`);
    else if (title || company) parts.push((title ?? company) as string);
    const email = text(record, "email");
    if (email) parts.push(email);
  }
  if (type === "company") {
    const domain = text(record, "domain");
    if (domain) parts.push(domain);
    const place = [text(record, "city"), text(record, "country")].filter(Boolean).join(", ");
    if (place) parts.push(place);
  }
  if (type === "deal" || type === "account") {
    if (company) parts.push(company);
    const amount = formatMoney(record.data.amount ?? record.data.value, currency);
    if (amount) parts.push(amount);
  }
  return parts.join(" · ");
}

function useDiscussHref(entity: string, id: string): string | null {
  const context = useKylonWorkspaceContext();
  if (!context || context.channelId === "demo") return null;
  return appRecordThreadHref(context, entity, id);
}

function PropertyRow({
  entity,
  field,
  record,
  currency,
  amountLabel,
}: {
  entity: (typeof RECORD_ENTITY)[RecordType];
  field: CrmFieldSpec;
  record: CrmRecord;
  currency: string;
  amountLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateRecord(entity);
  const value = record.data[field.key];
  const commit = (next: unknown) => {
    setEditing(false);
    update.mutate(
      { id: record.record_id, data: { [field.key]: next } },
      { onError: (error) => toast.error(error.message) },
    );
  };
  const pickerLike = ["select", "user", "relation", "checkbox", "multi_select"].includes(field.type) || (entity === "deals" && field.key === "stage");
  return (
    <div className="grid min-h-8 grid-cols-[120px_minmax(0,1fr)] items-start gap-3 py-1 text-[13px]">
      <span className="pt-1.5 text-[12px] leading-5 text-ky-ink-3">{entity === "deals" && field.key === "amount" ? (amountLabel ?? field.label) : field.label}</span>
      {(pickerLike && !field.readOnly) || editing ? (
        <div className="min-w-0">
          <FieldEditor entity={entity} field={field} value={value} autoFocus={editing} onCommit={commit} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button
          type="button"
          disabled={field.readOnly}
          onClick={() => setEditing(true)}
          className="min-h-8 min-w-0 rounded-[8px] px-2 py-1.5 text-left hover:bg-ky-hover disabled:hover:bg-transparent"
        >
          <FieldDisplay entity={entity} field={field} value={value} currency={currency} />
        </button>
      )}
    </div>
  );
}

function Properties({ type, record }: { type: RecordType; record: CrmRecord }) {
  const entity = RECORD_ENTITY[type];
  const spec = entitySpec(entity);
  const settings = useSettings().data;
  if (!spec) return null;
  return (
    <div className="flex flex-col">
      {spec.fields
        .filter((field) => field.key !== spec.titleField)
        .map((field) => (
          <PropertyRow
            key={`${record.record_id}:${field.key}`}
            entity={entity}
            field={field}
            record={record}
            currency={settings?.currency ?? "USD"}
            amountLabel={settings?.amount_label}
          />
        ))}
    </div>
  );
}

/** The ids a new activity or follow-up on this record should carry. */
function linksFor(type: RecordType, record: CrmRecord): Record<string, unknown> {
  const company = relationOf(record.data.company_id);
  const person = relationOf(record.data.person_id);
  switch (type) {
    case "person":
      return { person_id: record.record_id, ...(company ? { company_id: company.id } : {}) };
    case "company":
      return { company_id: record.record_id };
    case "account":
      return { account_id: record.record_id, ...(company ? { company_id: company.id } : {}) };
    case "deal":
      return { deal_id: record.record_id, ...(company ? { company_id: company.id } : {}), ...(person ? { person_id: person.id } : {}) };
  }
}

function ActivityComposer({ type, record }: { type: RecordType; record: CrmRecord }) {
  const create = useCreateRecord("activities");
  const [kind, setKind] = useState("note");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const submit = () => {
    if (!subject.trim()) return;
    create.mutate(
      { kind, subject: subject.trim(), summary: summary.trim() || null, occurred_at: new Date().toISOString(), source: "CRM", ...linksFor(type, record) },
      {
        onSuccess: () => {
          setSubject("");
          setSummary("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  return (
    <form
      className="flex flex-col gap-2 rounded-[12px] border border-ky-hairline bg-ky-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap gap-1">
        {ACTIVITY_KIND_OPTIONS.filter((option) => ["note", "meeting", "call", "email"].includes(option.id)).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className={cn(
              "h-6 rounded-full px-2.5 text-[12px]",
              kind === option.id ? "bg-ky-selected font-semibold text-ky-ink" : "text-ky-ink-2 hover:bg-ky-hover",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder={kind === "note" ? "Note title" : "What happened"}
        className="h-8 rounded-[8px] border border-ky-hairline bg-transparent px-2.5 text-[13px] outline-none placeholder:text-ky-muted focus:border-ky-accent"
      />
      <textarea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        rows={2}
        placeholder="Details (optional)"
        className="rounded-[8px] border border-ky-hairline bg-transparent px-2.5 py-2 text-[13px] outline-none placeholder:text-ky-muted focus:border-ky-accent"
      />
      <div className="flex justify-end">
        <Button size="sm" type="submit" variant="secondary" disabled={!subject.trim() || create.isPending}>
          Log {labeled(ACTIVITY_KIND_OPTIONS, kind)?.label.toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

function ActivityItem({ activity }: { activity: CrmRecord }) {
  const kind = labeled(ACTIVITY_KIND_OPTIONS, activity.data.kind);
  const person = relationOf(activity.data.person_id);
  return (
    <li className="flex flex-col gap-1 border-b border-ky-divider py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-[12px] text-ky-ink-3">
        {kind ? <StateLabel state={kind} plainClassName="text-[12px] text-ky-ink-2" /> : null}
        <span className="tabular-nums">{formatDateTime(activity.data.occurred_at)}</span>
        {text(activity, "source") ? <span className="truncate">via {text(activity, "source")}</span> : null}
      </div>
      <p className="text-[13px] font-semibold text-ky-ink">{String(activity.data.subject ?? "")}</p>
      {text(activity, "summary") ? <p className="text-[13px] leading-5 whitespace-pre-wrap text-ky-ink-2">{text(activity, "summary")}</p> : null}
      {person ? (
        <span>
          <RecordChip type="person" id={person.id} name={person.label} />
        </span>
      ) : null}
    </li>
  );
}

function FollowUps({ type, record, tasks }: { type: RecordType; record: CrmRecord; tasks: CrmRecord[] }) {
  const create = useCreateRecord("tasks");
  const update = useUpdateRecord("tasks");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const open = tasks.filter((task) => task.data.status === "open");
  const closed = tasks.filter((task) => task.data.status !== "open");
  const today = todayIso();
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2 rounded-[12px] border border-ky-hairline bg-ky-card p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          create.mutate(
            { title: title.trim(), status: "open", due_date: due || null, owner, source: "CRM", ...linksFor(type, record) },
            {
              onSuccess: () => {
                setTitle("");
                setDue("");
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a follow-up"
          className="h-8 rounded-[8px] border border-ky-hairline bg-transparent px-2.5 text-[13px] outline-none placeholder:text-ky-muted focus:border-ky-accent"
        />
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="h-8 rounded-[8px] border border-ky-hairline bg-transparent px-2.5 text-[13px] outline-none focus:border-ky-accent"
          />
          <MemberPicker value={owner} onPick={setOwner} placeholder="Owner" />
          <Button size="sm" type="submit" variant="secondary" disabled={!title.trim() || create.isPending}>
            <Plus />
            Add
          </Button>
        </div>
      </form>
      {open.length === 0 && closed.length === 0 ? <p className="px-1 text-[13px] text-ky-ink-3">No follow-ups yet.</p> : null}
      <ul className="flex flex-col">
        {[...open, ...closed].map((task) => {
          const done = task.data.status !== "open";
          const dueDate = text(task, "due_date");
          const overdue = !done && dueDate && dueDate < today;
          return (
            <li key={task.record_id} className="flex items-start gap-2.5 border-b border-ky-divider py-2.5 last:border-b-0">
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
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("text-[13px]", done && "text-ky-ink-3 line-through")}>{String(task.data.title ?? "")}</span>
                <span className="flex items-center gap-2 text-[12px] text-ky-ink-3">
                  {dueDate ? overdue ? <Tag tone="clay">Due {formatDate(dueDate)}</Tag> : <span>Due {formatDate(dueDate)}</span> : null}
                  {text(task, "owner") ? <MemberChip userId={text(task, "owner")} /> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RelatedSection({
  title,
  type,
  records,
  total,
  meta,
  onOpen,
}: {
  title: string;
  type: RecordType;
  records: CrmRecord[];
  total: number;
  meta?: (record: CrmRecord) => ReactNode;
  onOpen: (type: RecordType, id: string) => void;
}) {
  const spec = entitySpec(RECORD_ENTITY[type]);
  return (
    <section className="flex flex-col gap-1">
      <h3 className="ky-text-product-menu-title px-1 text-ky-muted">
        {title} <span className="tabular-nums">{total}</span>
      </h3>
      {records.length === 0 ? <p className="px-1 pb-2 text-[13px] text-ky-ink-3">None yet.</p> : null}
      {records.map((item) => {
        const name = String(item.data[spec?.titleField ?? "name"] ?? "");
        return (
          <button
            key={item.record_id}
            type="button"
            onClick={() => onOpen(type, item.record_id)}
            className="flex h-10 items-center gap-2.5 rounded-[8px] px-1 text-left hover:bg-ky-hover"
          >
            <RecordAvatar type={type} name={name} size={22} src={(item.data.avatar_url as string | null) ?? (item.data.logo_url as string | null) ?? null} />
            <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
            {meta ? <span className="shrink-0 text-[12px] text-ky-ink-2">{meta(item)}</span> : null}
          </button>
        );
      })}
    </section>
  );
}

function Related({ type, data, labels, onOpen }: { type: RecordType; data: RecordContext; labels: ObjectLabels; onOpen: (type: RecordType, id: string) => void }) {
  const settings = useSettings().data;
  const currency = settings?.currency ?? "USD";
  const sections: ReactNode[] = [];
  const r = data.related;
  if (r.people) sections.push(<RelatedSection key="people" title={labels.people} type="person" records={r.people.records} total={r.people.total} meta={(item) => text(item, "title")} onOpen={onOpen} />);
  if (r.deals)
    sections.push(
      <RelatedSection
        key="deals"
        title={labels.deals}
        type="deal"
        records={r.deals.records}
        total={r.deals.total}
        meta={(item) => (
          <span className="flex items-center gap-2">
            {formatMoney(item.data.amount, currency)}
            <StageTag id={item.data.stage} />
          </span>
        )}
        onOpen={onOpen}
      />,
    );
  if (r.accounts) sections.push(<RelatedSection key="accounts" title={labels.accounts} type="account" records={r.accounts.records} total={r.accounts.total} onOpen={onOpen} />);
  if (r.lists && r.lists.records.length)
    sections.push(
      <section key="lists" className="flex flex-col gap-1">
        <h3 className="ky-text-product-menu-title px-1 text-ky-muted">Lists</h3>
        {r.lists.records.map((member) => {
          const list = relationOf(member.data.list_id);
          return list ? (
            <Link key={member.record_id} href={`/lists/${encodeURIComponent(list.id)}` as Route} className="flex h-8 items-center rounded-[8px] px-1 text-[13px] hover:bg-ky-hover">
              {list.label}
            </Link>
          ) : null;
        })}
      </section>,
    );
  if (!sections.length) return <p className="px-1 text-[13px] text-ky-ink-3">Nothing is linked to this record yet.</p>;
  return <div className="flex flex-col gap-5">{sections}</div>;
}

function History({ data }: { data: RecordContext }) {
  if (!data.audit.length) return <p className="px-1 text-[13px] text-ky-ink-3">No changes recorded yet.</p>;
  return (
    <ul className="flex flex-col">
      {data.audit.map((entry, index) => {
        const changes = entry.changes && typeof entry.changes === "object" ? Object.keys(entry.changes as Record<string, unknown>) : [];
        return (
          <li key={`${entry.at}-${index}`} className="flex flex-col gap-0.5 border-b border-ky-divider py-2.5 last:border-b-0">
            <span className="flex items-center gap-2 text-[12px] text-ky-ink-3">
              <span className="tabular-nums">{relativeTime(entry.at)}</span>
              {entry.actor ? <MemberChip userId={entry.actor} /> : <span>Unknown</span>}
            </span>
            <span className="text-[13px] text-ky-ink">
              {entry.action === "create" ? "Created" : entry.action === "delete" ? "Deleted" : `Changed ${changes.join(", ") || "fields"}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Tabs({ tabs, active, onChange }: { tabs: Array<{ key: TabKey; label: string; count?: number }>; active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="border-b border-ky-hairline">
      <div role="tablist" aria-label="Record sections" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] whitespace-nowrap",
              active === tab.key ? "border-ky-ink font-semibold text-ky-ink" : "border-transparent text-ky-ink-2 hover:text-ky-ink",
            )}
          >
            {tab.label}
            {tab.count ? <span className="text-[11px] font-normal text-ky-ink-3 tabular-nums">{tab.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecordSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading record" className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="size-10 rounded-full bg-ky-recessed motion-safe:animate-pulse" />
        <span className="flex flex-col gap-2">
          <span className="h-4 w-40 rounded-[4px] bg-ky-recessed motion-safe:animate-pulse" />
          <span className="h-3 w-28 rounded-[4px] bg-ky-recessed motion-safe:animate-pulse" />
        </span>
      </div>
      {Array.from({ length: 7 }).map((_, index) => (
        <span key={index} className="h-3 rounded-[4px] bg-ky-recessed motion-safe:animate-pulse" style={{ width: `${55 + ((index * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

const TABS: TabKey[] = ["overview", "activity", "followups", "related", "history"];

/** One record, two widths: the side panel next to a list, or its own page. */
export function RecordView({
  type,
  id,
  compact,
  onOpen,
  onDeleted,
  actions,
}: {
  type: RecordType;
  id: string;
  compact: boolean;
  onOpen: (type: RecordType, id: string) => void;
  onDeleted: () => void;
  actions?: ReactNode;
}) {
  const entity = RECORD_ENTITY[type];
  const context = useRecordContext(entity, id);
  const settings = useSettings().data;
  const labels = settings?.labels ?? DEFAULT_LABELS;
  const { params, update } = useQueryState();
  const tabParam = params.get("tab");
  const tab: TabKey = TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "overview";
  const remove = useDeleteRecord(entity);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const discussHref = useDiscussHref(entity, id);

  if (context.isPending) return <RecordSkeleton />;
  if (context.isError)
    return (
      <div className="p-5">
        <InlineError message={context.error.message} onRetry={() => void context.refetch()} />
      </div>
    );
  const data = context.data;
  const record = data.record;
  const spec = entitySpec(entity);
  const name = String(record.data[spec?.titleField ?? "name"] ?? typeLabel(type, labels));
  const activities = data.related.activities?.records ?? [];
  const tasks = data.related.tasks?.records ?? [];
  const relatedCount = ["people", "deals", "accounts"].reduce((sum, key) => sum + (data.related[key]?.total ?? 0), 0);
  const ownerKey = type === "account" ? "account_manager" : "owner";
  const openTasks = tasks.filter((task) => task.data.status === "open").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex flex-col gap-3", compact ? "px-5 pt-4 pb-4" : "pb-5")}>
        <div className="flex items-start gap-3">
          <RecordAvatar type={type} name={name} size={40} src={(record.data.avatar_url as string | null) ?? (record.data.logo_url as string | null) ?? null} />
          <div className="min-w-0 flex-1">
            <div className="mb-1">
              <RecordTypeLabel type={type} label={typeLabel(type, labels)} />
            </div>
            <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.2px] break-words text-ky-ink">{name}</h2>
            <p className="mt-0.5 truncate text-[12px] text-ky-ink-2">{subline(type, record, settings?.currency ?? "USD")}</p>
          </div>
          {actions}
        </div>
        <div>
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-[13px]">
            <span className="text-[12px] leading-5 text-ky-ink-3">{type === "account" ? "Account manager" : "Owner"}</span>
            <MemberChip userId={text(record, ownerKey)} />
          </div>
          {type === "deal" ? (
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-[13px]">
              <span className="text-[12px] leading-5 text-ky-ink-3">Next step</span>
              <span className="min-w-0 truncate text-[13px]">
                {text(record, "next_step") ?? <span className="text-ky-muted">None</span>}
                {text(record, "next_step_date") ? <span className="text-ky-ink-3"> · {formatDate(text(record, "next_step_date"))}</span> : null}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {discussHref ? (
            <Button size="sm" variant="secondary" asChild>
              <a
                href={discussHref}
                onClick={(event) => {
                  if (openKylonUrl(discussHref)) event.preventDefault();
                }}
                target="_blank"
                rel="noreferrer"
              >
                <MessageSquare />
                Discuss
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled title="Open this App inside Kylon to discuss a record">
              <MessageSquare />
              Discuss
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-ky-ink-2" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <div className={cn(compact && "px-5")}>
        <Tabs
          active={tab}
          onChange={(next) => update({ tab: next === "overview" ? null : next })}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "activity", label: "Activity", count: data.related.activities?.total },
            { key: "followups", label: "Follow-ups", count: openTasks },
            ...(type === "deal" ? [] : [{ key: "related" as const, label: "Related", count: relatedCount }]),
            { key: "history", label: "History" },
          ]}
        />
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto py-4", compact && "px-5")}>
        {tab === "overview" ? <Properties type={type} record={record} /> : null}
        {tab === "activity" ? (
          <div className="flex flex-col gap-3">
            <ActivityComposer type={type} record={record} />
            {activities.length === 0 ? (
              <EmptyState title="Nothing logged yet. Meetings, emails and notes from your Automations land here once they write to the CRM." />
            ) : (
              <ul className="flex flex-col">
                {activities.map((activity) => (
                  <ActivityItem key={activity.record_id} activity={activity} />
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {tab === "followups" ? <FollowUps type={type} record={record} tasks={tasks} /> : null}
        {tab === "related" ? <Related type={type} data={data} labels={labels} onOpen={onOpen} /> : null}
        {tab === "history" ? <History data={data} /> : null}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The record is removed for everyone. Activities and follow-ups linked to it stay, without the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(record.record_id, {
                  onSuccess: () => {
                    toast.success(`${name} deleted`);
                    onDeleted();
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The side panel beside a list. Linked records open in the same panel. */
export function RecordPanel({ type, id, onClose }: { type: RecordType; id: string; onClose: () => void }) {
  const { update } = useQueryState();
  return (
    <aside
      aria-label="Record"
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-ky-chrome min-[900px]:static min-[900px]:w-[440px] min-[900px]:shrink-0 min-[900px]:border-l min-[900px]:border-ky-hairline"
    >
      <RecordView
        type={type}
        id={id}
        compact
        onOpen={(nextType, nextId) => update({ record: recordParam(nextType, nextId), tab: null }, "push")}
        onDeleted={onClose}
        actions={
          <span className="flex shrink-0 gap-0.5">
            <Button size="icon-sm" variant="ghost" asChild aria-label="Open full page">
              <Link href={`${RECORD_ROUTE[type]}/${encodeURIComponent(id)}` as Route}>
                <ArrowUpRight />
              </Link>
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
              <X />
            </Button>
          </span>
        }
      />
    </aside>
  );
}

/** A record on its own page; also used, without navigation, by the presentation route. */
export function RecordPage({ type, id, present = false }: { type: RecordType; id: string; present?: boolean }) {
  const router = useRouter();
  const labels = useSettings().data?.labels ?? DEFAULT_LABELS;
  const plural: Record<RecordType, keyof ObjectLabels> = { company: "companies", person: "people", account: "accounts", deal: "deals" };
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      <div className={cn("mx-auto flex w-full max-w-[860px] flex-col", present ? "px-6 py-5" : "px-6 py-6")}>
        {present ? null : (
          <Link href={RECORD_ROUTE[type] as Route} className="mb-4 text-[12px] text-ky-ink-2 hover:text-ky-ink">
            {labels[plural[type]]}
          </Link>
        )}
        <RecordView
          type={type}
          id={id}
          compact={false}
          onOpen={(nextType, nextId) => router.push(`${RECORD_ROUTE[nextType]}/${encodeURIComponent(nextId)}` as Route)}
          onDeleted={() => router.push(RECORD_ROUTE[type] as Route)}
        />
      </div>
    </div>
  );
}

export { ENTITY_RECORD };
