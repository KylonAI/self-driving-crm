"use client";

import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StageTag } from "@/components/crm/fields";
import { Figures, PageFrame, Section } from "@/components/crm/page-frame";
import { RecordPanel } from "@/components/crm/record-view";
import { Segmented } from "@/components/crm/segmented";
import { EmptyState, InlineError, PageLoading, RecordChip, StateLabel, Tag } from "@/components/crm/ui";
import { type CrmRecord, relationOf, text, useReport, useSettings } from "@/lib/crm/client";
import { formatDate, formatMoney, formatNumber, labeled, relativeTime, todayIso } from "@/lib/crm/display";
import { ACTIVITY_KIND_OPTIONS } from "@/lib/crm/entities";
import { DEFAULT_LABELS } from "@/lib/crm/presets";
import { parseRecordParam, recordParam, useQueryState } from "@/lib/crm/url";
import { readUrlState } from "@/lib/url-state";

interface Home {
  tasks: CrmRecord[];
  tasks_total: number;
  recent_activities: CrmRecord[];
  closing_deals: CrmRecord[];
  counts: Record<string, number>;
}

const SCOPES = ["mine", "everyone"] as const;

function HomePage() {
  const { params, update } = useQueryState();
  const scope = readUrlState(params, "scope", SCOPES, "mine");
  const home = useReport<Home>("home", { scope });
  const settings = useSettings().data;
  const labels = settings?.labels ?? DEFAULT_LABELS;
  const record = parseRecordParam(params.get("record"));
  const open = (type: "person" | "company" | "deal" | "account", id: string) => update({ record: recordParam(type, id) }, "push");
  const today = todayIso();

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <PageFrame
        title={settings?.org_name ? `${settings.org_name}` : "Home"}
        subtitle="What needs you today, what is closing soon, and the latest from customers."
        actions={
          <Segmented
            label="Whose work"
            value={scope}
            onChange={(next) => update({ scope: next === "mine" ? null : next })}
            options={[
              { id: "mine", label: "Mine" },
              { id: "everyone", label: "Everyone" },
            ]}
          />
        }
      >
        {home.isError ? <InlineError message={home.error.message} onRetry={() => void home.refetch()} /> : null}
        {home.isPending ? <PageLoading /> : null}
        {home.data ? (
          <>
            <Figures
              items={[
                { label: labels.people, value: formatNumber(home.data.counts.people ?? 0) },
                { label: labels.companies, value: formatNumber(home.data.counts.companies ?? 0) },
                { label: labels.deals, value: formatNumber(home.data.counts.deals ?? 0) },
                { label: "Follow-ups due", value: formatNumber(home.data.counts.tasks_due ?? 0), hint: `${formatNumber(home.data.counts.tasks_open ?? 0)} open` },
              ]}
            />
            {home.data.counts.people + home.data.counts.companies + home.data.counts.deals === 0 ? (
              <EmptyState
                title="This CRM is empty. Ask the Room's Agent to install it: it asks what kind of CRM this is, brings in what your Automations already collected, and helps each person connect their own email, calendar and meeting notes."
                action={
                  <Link href={"/settings/sources" as Route} className="text-[13px] font-semibold text-ky-ink underline underline-offset-2">
                    See data sources
                  </Link>
                }
              />
            ) : null}
            <div className="grid gap-8 min-[960px]:grid-cols-2">
              <Section
                title="Follow-ups"
                aside={
                  <Link href={"/follow-ups" as Route} className="text-[12px] text-ky-ink-2 hover:text-ky-ink">
                    All {formatNumber(home.data.tasks_total)}
                  </Link>
                }
              >
                {home.data.tasks.length === 0 ? <p className="text-[13px] text-ky-ink-3">Nothing waiting.</p> : null}
                <ul className="flex flex-col border-t border-ky-hairline">
                  {home.data.tasks.map((task) => {
                    const due = text(task, "due_date");
                    const person = relationOf(task.data.person_id);
                    const company = relationOf(task.data.company_id);
                    return (
                      <li key={task.record_id} className="flex flex-col gap-1 border-b border-ky-divider py-2.5">
                        <span className="text-[13px] text-ky-ink">{String(task.data.title ?? "")}</span>
                        <span className="flex flex-wrap items-center gap-2 text-[12px] text-ky-ink-3">
                          {due ? due < today ? <Tag tone="clay">Due {formatDate(due)}</Tag> : <span>Due {formatDate(due)}</span> : <span>No due date</span>}
                          {person ? <RecordChip type="person" id={person.id} name={person.label} /> : company ? <RecordChip type="company" id={company.id} name={company.label} /> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
              <Section title={`${labels.deals} closing soon`}>
                {home.data.closing_deals.length === 0 ? <p className="text-[13px] text-ky-ink-3">No open {labels.deals.toLowerCase()} with a close date.</p> : null}
                <ul className="flex flex-col border-t border-ky-hairline">
                  {home.data.closing_deals.map((deal) => (
                    <li key={deal.record_id}>
                      <button type="button" onClick={() => open("deal", deal.record_id)} className="flex w-full items-center gap-3 border-b border-ky-divider py-2.5 text-left hover:bg-ky-hover">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{String(deal.data.name ?? "")}</span>
                          <span className="block truncate text-[12px] text-ky-ink-2">{relationOf(deal.data.company_id)?.label ?? ""}</span>
                        </span>
                        <StageTag id={deal.data.stage} />
                        <span className="w-20 text-right text-[13px] tabular-nums">{formatMoney(deal.data.amount, settings?.currency, true)}</span>
                        <span className="w-16 text-right text-[12px] text-ky-ink-2 tabular-nums">{formatDate(deal.data.close_date)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
            <Section
              title="Latest activity"
              aside={
                <Link href={"/meetings?view=all" as Route} className="text-[12px] text-ky-ink-2 hover:text-ky-ink">
                  All activity
                </Link>
              }
            >
              {home.data.recent_activities.length === 0 ? <p className="text-[13px] text-ky-ink-3">Nothing logged yet.</p> : null}
              <ul className="flex flex-col border-t border-ky-hairline">
                {home.data.recent_activities.map((activity) => {
                  const person = relationOf(activity.data.person_id);
                  const company = relationOf(activity.data.company_id);
                  return (
                    <li key={activity.record_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ky-divider py-2.5">
                      <span className="w-20 shrink-0 text-[12px] text-ky-ink-3">{relativeTime(activity.data.occurred_at)}</span>
                      <StateLabel state={labeled(ACTIVITY_KIND_OPTIONS, activity.data.kind)} plainClassName="text-[12px] text-ky-ink-2 w-16" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{String(activity.data.subject ?? "")}</span>
                      {person ? <RecordChip type="person" id={person.id} name={person.label} /> : null}
                      {company ? <RecordChip type="company" id={company.id} name={company.label} /> : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          </>
        ) : null}
      </PageFrame>
      {record ? <RecordPanel type={record.type} id={record.id} onClose={() => update({ record: null })} /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomePage />
    </Suspense>
  );
}
