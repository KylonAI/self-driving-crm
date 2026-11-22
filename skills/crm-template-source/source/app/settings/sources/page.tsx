"use client";

import { Suspense, useMemo } from "react";
import { Figures, PageFrame, Section } from "@/components/crm/page-frame";
import { EmptyState, InlineError, MemberChip, PageLoading, StateLabel, Tag } from "@/components/crm/ui";
import { type CrmRecord, text, useDataSources } from "@/lib/crm/client";
import { formatNumber, labeled, relativeTime } from "@/lib/crm/display";
import { SYNC_STATUS_OPTIONS } from "@/lib/crm/entities";
import { isCrmType } from "@/lib/crm/presets";
import { KINDS_BY_TYPE, SOURCE_KINDS, type SourceKind, sourceLabel } from "@/lib/crm/sources";
import { cn } from "@/lib/utils";

/**
 * Settings › Data sources. Read only: which accounts feed the CRM, who
 * connected each, whether its sync is keeping up, and what actually landed.
 * Connecting and changing syncs happens with the Room's Agent, never here.
 */

type Freshness = "fresh" | "week" | "quiet" | "never";
const DAY = 86_400_000;

function freshness(at: string | null): Freshness {
  if (!at) return "never";
  const age = Date.now() - new Date(at).getTime();
  if (age <= 1.1 * DAY) return "fresh";
  if (age <= 7 * DAY) return "week";
  return "quiet";
}

function FreshnessTag({ at }: { at: string | null }) {
  const state = freshness(at);
  if (state === "fresh") return <Tag tone="olive">Fresh</Tag>;
  if (state === "week") return <Tag tone="sun">This week</Tag>;
  if (state === "quiet") return <Tag tone="clay">Quiet</Tag>;
  return <span className="text-[12px] text-ky-muted">Never</span>;
}

const HEAD = "h-9 border-b border-ky-divider px-3 text-left text-[11.5px] font-medium whitespace-nowrap text-ky-ink-3";
const CELL = "h-10 border-b border-ky-divider px-3 text-[13px] whitespace-nowrap";

function needsAttention(row: CrmRecord) {
  const status = text(row, "status");
  const last = text(row, "last_synced_at");
  return status === "error" || (status === "syncing" && freshness(last) !== "fresh");
}

function ConnectedTable({ rows }: { rows: CrmRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={HEAD}>Service</th>
            <th className={HEAD}>Account</th>
            <th className={HEAD}>Connected by</th>
            <th className={HEAD}>Status</th>
            <th className={HEAD}>Last synced</th>
            <th className={cn(HEAD, "text-right")}>Items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const error = text(row, "last_error");
            return (
              <tr key={row.record_id}>
                <td className={cn(CELL, "font-semibold text-ky-ink")}>{sourceLabel(row.data.source)}</td>
                <td className={cn(CELL, "text-ky-ink-2")}>{text(row, "account_label") ?? ""}</td>
                <td className={CELL}>{row.data.shared ? <span className="text-ky-ink-2">Team account</span> : <MemberChip userId={text(row, "owner")} />}</td>
                <td className={CELL}>
                  <span className="flex items-center gap-2" title={error ?? undefined}>
                    <StateLabel state={labeled(SYNC_STATUS_OPTIONS, row.data.status)} plainClassName="text-[13px]" />
                    {text(row, "status") === "syncing" ? <FreshnessTag at={text(row, "last_synced_at")} /> : null}
                  </span>
                  {error ? <span className="block max-w-[260px] truncate text-[12px] text-ky-danger">{error}</span> : null}
                </td>
                <td className={cn(CELL, "text-ky-ink-2")}>{text(row, "last_synced_at") ? relativeTime(text(row, "last_synced_at")) : "Not yet"}</td>
                <td className={cn(CELL, "text-right tabular-nums")}>{formatNumber(Number(row.data.items_total ?? 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TABLE_NAME: Record<string, string> = { activities: "Activity", people: "People", companies: "Companies", deals: "Deals", tasks: "Follow-ups" };

function SourcesPage() {
  const report = useDataSources();
  const data = report.data;
  const type = isCrmType(data?.crm_type) ? data.crm_type : "other";
  const kinds = KINDS_BY_TYPE[type];
  const byKind = useMemo(() => {
    const map = new Map<string, CrmRecord[]>();
    for (const row of data?.connected ?? []) {
      const kind = text(row, "kind") ?? "import";
      map.set(kind, [...(map.get(kind) ?? []), row]);
    }
    return map;
  }, [data]);
  if (report.isPending) return <PageLoading />;
  if (report.isError)
    return (
      <div className="p-6">
        <InlineError message={report.error.message} onRetry={() => void report.refetch()} />
      </div>
    );
  const connected = data?.connected ?? [];
  const people = new Set(connected.filter((row) => !row.data.shared).map((row) => text(row, "owner")).filter(Boolean));
  const attention = connected.filter(needsAttention);
  const extraKinds = Array.from(byKind.keys()).filter((kind) => !kinds.includes(kind as SourceKind));

  return (
    <PageFrame
      title="Data sources"
      subtitle="Which accounts feed the CRM, who connected each one, and whether its sync is keeping up. Read only: to connect an account or change what syncs, ask the Room's Agent."
    >
      <Figures
        items={[
          { label: "Connected accounts", value: formatNumber(connected.length) },
          { label: "People connected", value: formatNumber(people.size) },
          { label: "Synced in the last day", value: formatNumber(connected.filter((row) => freshness(text(row, "last_synced_at")) === "fresh").length) },
          { label: "Need attention", value: formatNumber(attention.length) },
        ]}
      />

      {[...kinds, ...extraKinds].map((kind) => {
        const rows = byKind.get(kind) ?? [];
        const meta = SOURCE_KINDS[kind as SourceKind] ?? { label: kind, hint: "" };
        return (
          <Section key={kind} title={meta.label} aside={<span className="text-[12px] text-ky-ink-3">{meta.hint}</span>}>
            {rows.length ? <ConnectedTable rows={rows} /> : <p className="border-t border-ky-hairline pt-2.5 text-[13px] text-ky-ink-3">Nothing connected yet.</p>}
          </Section>
        );
      })}

      <Section title="What lands in the CRM" aside={<span className="text-[12px] text-ky-ink-3">Counted from the records themselves.</span>}>
        {data?.written.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={HEAD}>Source</th>
                  <th className={HEAD}>Writes</th>
                  <th className={cn(HEAD, "text-right")}>Last 7 days</th>
                  <th className={cn(HEAD, "text-right")}>All time</th>
                  <th className={HEAD}>Newest</th>
                  <th className={HEAD}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.written.map((row) => (
                  <tr key={`${row.table}:${row.source}`}>
                    <td className={cn(CELL, "font-semibold text-ky-ink")}>{row.source}</td>
                    <td className={cn(CELL, "text-ky-ink-2")}>{TABLE_NAME[row.table] ?? row.table}</td>
                    <td className={cn(CELL, "text-right tabular-nums")}>{formatNumber(row.last_7d)}</td>
                    <td className={cn(CELL, "text-right text-ky-ink-2 tabular-nums")}>{formatNumber(row.total)}</td>
                    <td className={cn(CELL, "text-ky-ink-2")}>{row.last_at ? relativeTime(row.last_at) : ""}</td>
                    <td className={CELL}>
                      <FreshnessTag at={row.last_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nothing has been written yet. Records from every connected source show up here with how fresh they are." />
        )}
      </Section>
    </PageFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SourcesPage />
    </Suspense>
  );
}
