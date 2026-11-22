"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageFrame, Section } from "@/components/crm/page-frame";
import { InlineError, PageLoading } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { useReport, useSettings, useUpdateSettings } from "@/lib/crm/client";
import { formatNumber } from "@/lib/crm/display";
import { CRM_PRESETS, DEFAULT_LABELS, type ObjectLabels, type Stage } from "@/lib/crm/presets";
import { cn } from "@/lib/utils";

interface Quality {
  objects: Array<{ entity: string; total: number; fields: Array<{ key: string; label: string; type: string; filled: number }> }>;
  duplicates: { company_names: number; people_names_without_email: number };
}

const LABEL_KEYS: Array<{ key: keyof ObjectLabels; hint: string }> = [
  { key: "companies", hint: "Companies, plural" },
  { key: "company", hint: "Companies, one" },
  { key: "people", hint: "People, plural" },
  { key: "person", hint: "People, one" },
  { key: "accounts", hint: "Accounts, plural" },
  { key: "account", hint: "Accounts, one" },
  { key: "deals", hint: "Deals, plural" },
  { key: "deal", hint: "Deals, one" },
];

const inputClass = "h-8 rounded-[8px] border border-ky-hairline bg-ky-card px-2.5 text-[13px] outline-none placeholder:text-ky-muted focus:border-ky-accent";

function slug(label: string, taken: Set<string>) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 36) || "stage";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  return id;
}

function NamesAndStages() {
  const settings = useSettings().data;
  const save = useUpdateSettings();
  const [labels, setLabels] = useState<ObjectLabels>(settings?.labels ?? DEFAULT_LABELS);
  const [stages, setStages] = useState<Stage[]>(settings?.deal_stages ?? []);
  const [currency, setCurrency] = useState(settings?.currency ?? "USD");
  useEffect(() => {
    if (!settings) return;
    setLabels(settings.labels);
    setStages(settings.deal_stages);
    setCurrency(settings.currency);
  }, [settings]);
  const move = (index: number, delta: number) =>
    setStages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + delta, 0, item);
      return next;
    });
  const changed =
    JSON.stringify(labels) !== JSON.stringify(settings?.labels) || JSON.stringify(stages) !== JSON.stringify(settings?.deal_stages) || currency !== settings?.currency;
  return (
    <>
      <Section title="What things are called">
        <div className="grid gap-x-4 gap-y-2 min-[720px]:grid-cols-4">
          {LABEL_KEYS.map(({ key, hint }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[12px] text-ky-ink-3">{hint}</span>
              <input value={labels[key]} maxLength={40} onChange={(event) => setLabels((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} />
            </label>
          ))}
        </div>
      </Section>
      <Section title="Deal stages" aside={<span className="text-[12px] text-ky-ink-3">Records keep the stage id, so renaming a stage never moves a deal.</span>}>
        <ul className="flex flex-col border-t border-ky-hairline">
          {stages.map((stage, index) => (
            <li key={`${stage.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 border-b border-ky-divider py-2 min-[720px]:grid-cols-[minmax(0,1fr)_160px_140px_auto]">
              <input
                value={stage.label}
                onChange={(event) => setStages((current) => current.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))}
                className={inputClass}
                aria-label="Stage name"
              />
              <span className="hidden truncate text-[12px] text-ky-ink-3 min-[720px]:block">{stage.id}</span>
              <select
                value={stage.kind}
                onChange={(event) => setStages((current) => current.map((item, i) => (i === index ? { ...item, kind: event.target.value as Stage["kind"] } : item)))}
                className={inputClass}
                aria-label="Stage kind"
              >
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <span className="flex gap-0.5">
                <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={index === stages.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Remove stage" disabled={stages.length <= 2} onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
        <div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStages((current) => [...current, { id: slug("new stage", new Set(current.map((item) => item.id))), label: "New stage", kind: "open" }])}
          >
            <Plus />
            Add stage
          </Button>
        </div>
      </Section>
      <Section title="Currency">
        <input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={cn(inputClass, "w-24")} aria-label="Currency code" />
      </Section>
      {save.error ? <InlineError message={save.error.message} /> : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate({ labels, deal_stages: stages, currency }, { onSuccess: () => toast.success("Saved") })}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {settings?.crm_type ? (
          <Button
            variant="ghost"
            onClick={() => {
              const preset = CRM_PRESETS[settings.crm_type ?? "other"];
              setLabels(preset.labels);
              setStages(preset.stages);
            }}
          >
            Reset to {CRM_PRESETS[settings.crm_type].name} defaults
          </Button>
        ) : null}
      </div>
    </>
  );
}

function QualityTable() {
  const report = useReport<Quality>("quality");
  const labels = useSettings().data?.labels ?? DEFAULT_LABELS;
  const names: Record<string, string> = { companies: labels.companies, people: labels.people, accounts: labels.accounts, deals: labels.deals };
  if (report.isPending) return <span className="h-40 rounded-[12px] bg-ky-recessed motion-safe:animate-pulse" />;
  if (report.isError) return <InlineError message={report.error.message} />;
  return (
    <div className="flex flex-col gap-6">
      {report.data.duplicates.company_names || report.data.duplicates.people_names_without_email ? (
        <p className="text-[13px] text-ky-ink-2">
          {formatNumber(report.data.duplicates.company_names)} company names appear more than once, and{" "}
          {formatNumber(report.data.duplicates.people_names_without_email)} names of people without an email. Ask an Agent to check them and send merges to Review.
        </p>
      ) : null}
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        {report.data.objects.map((object) => (
          <section key={object.entity} className="flex flex-col gap-1">
            <h3 className="text-[13px] font-semibold">
              {names[object.entity] ?? object.entity} <span className="font-normal text-ky-ink-3 tabular-nums">{formatNumber(object.total)}</span>
            </h3>
            <ul className="flex flex-col border-t border-ky-hairline">
              {object.fields.map((field) => {
                const share = object.total ? Math.round((field.filled / object.total) * 100) : 0;
                return (
                  <li key={field.key} className="grid grid-cols-[140px_minmax(0,1fr)_44px] items-center gap-3 border-b border-ky-divider py-1.5 text-[12.5px]">
                    <span className="truncate text-ky-ink-2">{field.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-ky-recessed">
                      <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${share}%` }} />
                    </span>
                    <span className="text-right text-ky-ink-3 tabular-nums">{object.total ? `${share}%` : ""}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FieldsPage() {
  return (
    <PageFrame title="Fields & data quality" subtitle="Rename objects and stages to fit how your team talks, and see which fields are filled in.">
      <NamesAndStages />
      <Section title="How complete the records are">
        <QualityTable />
      </Section>
    </PageFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FieldsPage />
    </Suspense>
  );
}
