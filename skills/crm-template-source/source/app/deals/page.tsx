"use client";

import { Columns3, List } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ObjectPage } from "@/components/crm/object-page";
import { MemberAvatar, PageLoading } from "@/components/crm/ui";
import { type CrmRecord, relationOf, useSettings, useUpdateRecord } from "@/lib/crm/client";
import { formatDate, formatMoney } from "@/lib/crm/display";
import type { Stage } from "@/lib/crm/presets";
import { useQueryState } from "@/lib/crm/url";
import { cn } from "@/lib/utils";

function LayoutSwitch({ layout, onChange }: { layout: "list" | "board"; onChange: (layout: "list" | "board") => void }) {
  return (
    <div role="group" aria-label="Layout" className="flex rounded-[10px] border border-ky-hairline bg-ky-card p-0.5">
      {(
        [
          { id: "board", label: "Board", icon: Columns3 },
          { id: "list", label: "List", icon: List },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={layout === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px]",
            layout === option.id ? "bg-ky-selected font-semibold text-ky-ink" : "text-ky-ink-2 hover:bg-ky-hover",
          )}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DealCard({ deal, currency, onOpen }: { deal: CrmRecord; currency: string; onOpen: () => void }) {
  const company = relationOf(deal.data.company_id);
  const owner = typeof deal.data.owner === "string" ? deal.data.owner : null;
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/deal-id", deal.record_id)}
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 rounded-[12px] border border-ky-hairline bg-ky-card p-3 text-left shadow-ky-card hover:bg-ky-hover"
    >
      <span className="text-[13px] leading-5 font-semibold break-words text-ky-ink">{String(deal.data.name ?? "")}</span>
      {company ? <span className="truncate text-[12px] text-ky-ink-2">{company.label}</span> : null}
      <span className="flex items-center gap-2 text-[12px] text-ky-ink-2">
        <span className="font-semibold text-ky-ink tabular-nums">{formatMoney(deal.data.amount, currency, true)}</span>
        {deal.data.close_date ? <span className="tabular-nums">{formatDate(deal.data.close_date)}</span> : null}
        <span className="flex-1" />
        {owner ? <MemberAvatar userId={owner} size={18} /> : null}
      </span>
    </button>
  );
}

function Board({ rows, stages, currency, onOpen }: { rows: CrmRecord[]; stages: Stage[]; currency: string; onOpen: (row: CrmRecord) => void }) {
  const update = useUpdateRecord("deals");
  const [over, setOver] = useState<string | null>(null);
  const known = new Set(stages.map((stage) => stage.id));
  const columns = [...stages, ...(rows.some((row) => !known.has(String(row.data.stage ?? ""))) ? [{ id: "", label: "No stage", kind: "open" as const }] : [])];
  return (
    <div className="flex h-full min-h-[420px] gap-3 overflow-x-auto px-6 py-4">
      {columns.map((stage) => {
        const items = rows.filter((row) => (stage.id ? row.data.stage === stage.id : !known.has(String(row.data.stage ?? ""))));
        const total = items.reduce((sum, row) => sum + (Number(row.data.amount) || 0), 0);
        return (
          <section
            key={stage.id || "none"}
            aria-label={stage.label}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(stage.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData("text/deal-id");
              if (!id || !stage.id) return;
              update.mutate({ id, data: { stage: stage.id } }, { onError: (error) => toast.error(error.message) });
            }}
            className={cn(
              "flex w-[260px] shrink-0 flex-col gap-2 rounded-[14px] bg-ky-canvas p-2",
              over === stage.id && stage.id && "ring-2 ring-[var(--ky-color-accent-default)]",
            )}
          >
            <header className="flex items-baseline gap-2 px-1.5 pt-1">
              <span className="text-[13px] font-semibold text-ky-ink">{stage.label}</span>
              <span className="text-[12px] text-ky-ink-3 tabular-nums">{items.length}</span>
              <span className="flex-1" />
              <span className="text-[12px] text-ky-ink-2 tabular-nums">{total ? formatMoney(total, currency, true) : ""}</span>
            </header>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {items.map((deal) => (
                <DealCard key={deal.record_id} deal={deal} currency={currency} onOpen={() => onOpen(deal)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DealsPage() {
  const { params, update } = useQueryState();
  const settings = useSettings().data;
  const layout = params.get("layout") === "list" ? "list" : "board";
  const stages = settings?.deal_stages ?? [];
  const firstOpen = stages.find((stage) => stage.kind === "open")?.id;
  return (
    <ObjectPage
      entity="deals"
      title={(labels) => labels.deals}
      singular={(labels) => labels.deal}
      quickFilters={["stage", "owner"]}
      pageSize={layout === "board" ? 500 : 50}
      createFields={["name", "stage", "amount", "company_id", "person_id", "owner", "close_date"]}
      createDefaults={firstOpen ? { stage: firstOpen } : undefined}
      headerExtra={<LayoutSwitch layout={layout} onChange={(next) => update({ layout: next === "board" ? null : next })} />}
      renderBody={
        layout === "board"
          ? (rows, open) => <Board rows={rows} stages={stages} currency={settings?.currency ?? "USD"} onOpen={open} />
          : undefined
      }
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DealsPage />
    </Suspense>
  );
}
