"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Suspense } from "react";
import { Figures, PageFrame, Section } from "@/components/crm/page-frame";
import { EmptyState, InlineError, MemberChip, PageLoading } from "@/components/crm/ui";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useReport, useSettings } from "@/lib/crm/client";
import { formatDate, formatMoney, formatNumber } from "@/lib/crm/display";
import { DEFAULT_LABELS } from "@/lib/crm/presets";

interface Insights {
  currency: string;
  pipeline: Array<{ stage: string; label: string; kind: string; count: number; amount: number }>;
  weeks: Array<{ week: string; deals_created: number; meetings: number; messages: number; other_activity: number; people_added: number }>;
  owners: Array<{ owner: string | null; deals: number; amount: number }>;
  totals: Record<string, number>;
}

function InsightsPage() {
  const report = useReport<Insights>("insights");
  const settings = useSettings().data;
  const labels = settings?.labels ?? DEFAULT_LABELS;
  if (report.isPending) return <PageLoading />;
  if (report.isError)
    return (
      <div className="p-6">
        <InlineError message={report.error.message} onRetry={() => void report.refetch()} />
      </div>
    );
  const data = report.data;
  const currency = data.currency;
  const weeks = data.weeks.map((week) => ({ ...week, label: formatDate(week.week) }));
  const anyDeals = data.pipeline.some((stage) => stage.count > 0);
  const anyActivity = data.weeks.some((week) => week.meetings + week.messages + week.other_activity + week.people_added + week.deals_created > 0);
  return (
    <PageFrame title="Insights" subtitle="The pipeline by stage and how much is happening with customers, from the records in this CRM.">
      <Figures
        items={[
          { label: `Open ${labels.deals.toLowerCase()}`, value: formatNumber(data.totals.open_deals ?? 0) },
          { label: "Open pipeline", value: formatMoney(data.totals.pipeline_amount ?? 0, currency, true) || "0" },
          { label: "Won, last 90 days", value: formatMoney(data.totals.won_amount_90d ?? 0, currency, true) || "0", hint: `${formatNumber(data.totals.won_90d ?? 0)} won` },
          { label: "Activities, last 30 days", value: formatNumber(data.totals.activities_30d ?? 0), hint: `${formatNumber(data.totals.tasks_overdue ?? 0)} follow-ups overdue` },
        ]}
      />
      <Section title={`${labels.deals} by stage`}>
        {anyDeals ? (
          <ChartContainer
            className="aspect-auto h-[260px] w-full"
            config={{ count: { label: labels.deals, color: "var(--chart-1)" }, amount: { label: settings?.amount_label ?? "Amount", color: "var(--chart-3)" } }}
          >
            <BarChart data={data.pipeline} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyState title={`No ${labels.deals.toLowerCase()} yet. The chart fills in as ${labels.deals.toLowerCase()} are added.`} />
        )}
      </Section>
      <Section title="Last 12 weeks">
        {anyActivity ? (
          <ChartContainer
            className="aspect-auto h-[260px] w-full"
            config={{
              meetings: { label: "Meetings", color: "var(--chart-1)" },
              messages: { label: "Emails and messages", color: "var(--chart-3)" },
              deals_created: { label: `New ${labels.deals.toLowerCase()}`, color: "var(--chart-2)" },
              people_added: { label: `New ${labels.people.toLowerCase()}`, color: "var(--chart-4)" },
            }}
          >
            <LineChart data={weeks} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="meetings" stroke="var(--color-meetings)" strokeWidth={2} dot={false} />
              <Line dataKey="messages" stroke="var(--color-messages)" strokeWidth={2} dot={false} />
              <Line dataKey="deals_created" stroke="var(--color-deals_created)" strokeWidth={2} dot={false} />
              <Line dataKey="people_added" stroke="var(--color-people_added)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        ) : (
          <EmptyState title="No activity in the last 12 weeks yet." />
        )}
      </Section>
      <Section title={`Open ${labels.deals.toLowerCase()} by owner`}>
        {data.owners.length ? (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-ky-divider text-left text-[11.5px] text-ky-ink-3">
                <th className="h-9 font-medium">Owner</th>
                <th className="h-9 text-right font-medium">{labels.deals}</th>
                <th className="h-9 text-right font-medium">{settings?.amount_label ?? "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {data.owners.map((row) => (
                <tr key={row.owner ?? "none"} className="border-b border-ky-divider">
                  <td className="h-10">
                    <MemberChip userId={row.owner} />
                  </td>
                  <td className="h-10 text-right tabular-nums">{formatNumber(row.deals)}</td>
                  <td className="h-10 text-right tabular-nums">{formatMoney(row.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-ky-ink-3">No open {labels.deals.toLowerCase()} yet.</p>
        )}
      </Section>
    </PageFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <InsightsPage />
    </Suspense>
  );
}
