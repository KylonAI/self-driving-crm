"use client";

import { Check, ChevronDown, ExternalLink, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MemberChip, RecordChip, StateLabel, Tag } from "@/components/crm/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/components/providers/kylon-workspace-provider";
import { relationOf, useRecords, useSettings } from "@/lib/crm/client";
import { formatDate, formatDateTime, formatMoney, labeled } from "@/lib/crm/display";
import { type CrmFieldSpec, type EntityId, entitySpec } from "@/lib/crm/entities";
import type { Stage } from "@/lib/crm/presets";
import { ENTITY_RECORD } from "@/lib/crm/url";
import { cn } from "@/lib/utils";

export function stageOf(stages: Stage[] | undefined, id: unknown): Stage | null {
  if (typeof id !== "string" || !id) return null;
  return stages?.find((stage) => stage.id === id) ?? { id, label: id, kind: "open" };
}

export function StageTag({ id }: { id: unknown }) {
  const stages = useSettings().data?.deal_stages;
  const stage = stageOf(stages, id);
  if (!stage) return <span className="text-[13px] text-ky-muted">No stage</span>;
  if (stage.kind === "won") return <Tag tone="olive">{stage.label}</Tag>;
  if (stage.kind === "lost") return <Tag tone="clay">{stage.label}</Tag>;
  return <span className="truncate text-[13px] text-ky-ink">{stage.label}</span>;
}

const empty = (value: unknown) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** A field value as the CRM shows it everywhere: in table cells, the record panel and cards. */
export function FieldDisplay({ entity, field, value, currency }: { entity: EntityId; field: CrmFieldSpec; value: unknown; currency?: string }) {
  if (entity === "deals" && field.key === "stage") return <StageTag id={value} />;
  if (empty(value)) return <span className="text-[13px] text-ky-muted">Empty</span>;
  switch (field.type) {
    case "select":
      return <StateLabel state={labeled(field.options, value)} />;
    case "multi_select":
      return (
        <span className="flex min-w-0 flex-wrap gap-1">
          {(value as string[]).map((item) => {
            const state = labeled(field.options, item);
            return state?.tone ? (
              <Tag key={item} tone={state.tone}>
                {state.label}
              </Tag>
            ) : (
              <span key={item} className="rounded-full border border-ky-hairline px-2 text-[12px] leading-5">
                {state?.label ?? item}
              </span>
            );
          })}
        </span>
      );
    case "user":
      return <MemberChip userId={String(value)} />;
    case "relation": {
      const rel = relationOf(value);
      const type = field.relation ? ENTITY_RECORD[field.relation] : undefined;
      if (!rel) return <span className="text-[13px] text-ky-muted">Empty</span>;
      return type ? <RecordChip type={type} id={rel.id} name={rel.label || null} /> : <span className="truncate">{rel.label}</span>;
    }
    case "date":
      return <span className="truncate tabular-nums">{field.includeTime ? formatDateTime(value) : formatDate(value)}</span>;
    case "currency":
      return <span className="tabular-nums">{formatMoney(value, currency)}</span>;
    case "percent":
      return <span className="tabular-nums">{Number(value)}%</span>;
    case "number":
      return <span className="tabular-nums">{Number(value).toLocaleString("en-US")}</span>;
    case "checkbox":
      return <span>{value ? "Yes" : "No"}</span>;
    case "email":
      return (
        <a href={`mailto:${String(value)}`} onClick={(event) => event.stopPropagation()} className="truncate text-ky-ink underline-offset-2 hover:underline">
          {String(value)}
        </a>
      );
    case "url": {
      const href = String(value);
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-w-0 items-center gap-1 text-ky-ink underline-offset-2 hover:underline"
        >
          <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
          <ExternalLink className="size-3 shrink-0 text-ky-ink-3" />
        </a>
      );
    }
    case "json":
      return <span className="truncate font-mono text-[12px] text-ky-ink-2">{JSON.stringify(value)}</span>;
    default:
      return <span className="break-words whitespace-pre-wrap">{String(value)}</span>;
  }
}

const inputClass =
  "h-8 w-full rounded-[8px] border border-ky-hairline bg-ky-card px-2.5 text-[13px] text-ky-ink outline-none placeholder:text-ky-muted focus:border-ky-accent";

function OptionMenu({
  value,
  options,
  onPick,
  placeholder,
  trigger,
}: {
  value: string | null;
  options: Array<{ id: string; label: string; hint?: string }>;
  onPick: (id: string | null) => void;
  placeholder: string;
  trigger?: ReactNode;
}) {
  const current = options.find((option) => option.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button type="button" className={cn(inputClass, "flex items-center justify-between gap-2 text-left")}>
            <span className={cn("truncate", !current && "text-ky-muted")}>{current?.label ?? placeholder}</span>
            <ChevronDown className="size-3.5 shrink-0 text-ky-ink-3" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[200px] overflow-y-auto rounded-[12px] border border-ky-hairline bg-ky-card p-[6px] shadow-ky-card">
        {options.map((option) => (
          <DropdownMenuItem key={option.id} className="h-8 rounded-[8px] text-[13px]" onSelect={() => onPick(option.id)}>
            <span className="flex-1 truncate">{option.label}</span>
            {option.hint ? <span className="text-[11px] text-ky-ink-3">{option.hint}</span> : null}
            {option.id === value ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
        {value ? (
          <DropdownMenuItem className="h-8 rounded-[8px] text-[13px] text-ky-ink-2" onSelect={() => onPick(null)}>
            Clear
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Picks a person, company, account or deal by searching the CRM. */
export function RelationPicker({
  entity,
  value,
  onPick,
  placeholder,
}: {
  entity: EntityId;
  value: { id: string; label: string } | null;
  onPick: (value: { id: string; label: string } | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const spec = entitySpec(entity);
  const results = useRecords(entity, { q: q || null, pageSize: 8 }, open);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(inputClass, "flex items-center justify-between gap-2 text-left")}>
          <span className={cn("truncate", !value && "text-ky-muted")}>{value?.label ?? placeholder ?? `Pick a ${spec?.label.toLowerCase() ?? "record"}`}</span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={(event) => {
                event.stopPropagation();
                onPick(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") onPick(null);
              }}
              className="rounded-[4px] p-0.5 text-ky-ink-3 hover:bg-ky-hover"
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-ky-ink-3" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] rounded-[12px] border border-ky-hairline bg-ky-card p-[6px] shadow-ky-card">
        <label className="mb-1 flex h-8 items-center gap-2 rounded-[8px] border border-ky-hairline px-2">
          <Search className="size-3.5 text-ky-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ky-muted"
          />
        </label>
        <div className="flex max-h-[260px] flex-col overflow-y-auto">
          {results.isPending ? <p className="px-2 py-2 text-[12px] text-ky-ink-3">Searching…</p> : null}
          {!results.isPending && results.rows.length === 0 ? <p className="px-2 py-2 text-[12px] text-ky-ink-3">Nothing found.</p> : null}
          {results.rows.map((row) => {
            const label = String(row.data[spec?.titleField ?? "name"] ?? row.record_id);
            return (
              <button
                key={row.record_id}
                type="button"
                onClick={() => {
                  onPick({ id: row.record_id, label });
                  setOpen(false);
                }}
                className="flex h-8 items-center rounded-[8px] px-2 text-left text-[13px] hover:bg-ky-hover"
              >
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MemberPicker({ value, onPick, placeholder = "Unassigned" }: { value: string | null; onPick: (id: string | null) => void; placeholder?: string }) {
  const members = useWorkspaceMembers().data ?? [];
  return (
    <OptionMenu
      value={value}
      placeholder={placeholder}
      onPick={onPick}
      options={members.map((member) => ({ id: member.userId, label: member.name, hint: member.memberType === "agent" ? "Agent" : undefined }))}
    />
  );
}

export function StagePicker({ value, onPick }: { value: string | null; onPick: (id: string | null) => void }) {
  const stages = useSettings().data?.deal_stages ?? [];
  return <OptionMenu value={value} placeholder="Pick a stage" onPick={onPick} options={stages.map((stage) => ({ id: stage.id, label: stage.label }))} />;
}

/** An editor for one field. Commits on Enter, blur or pick; Escape cancels. */
export function FieldEditor({
  entity,
  field,
  value,
  onCommit,
  onCancel,
  autoFocus = true,
}: {
  entity: EntityId;
  field: CrmFieldSpec;
  value: unknown;
  onCommit: (value: unknown) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const initial = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(field.type === "date" && field.includeTime && initial ? initial.slice(0, 16) : initial);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  if (entity === "deals" && field.key === "stage") return <StagePicker value={(value as string | null) ?? null} onPick={(id) => onCommit(id)} />;
  if (field.type === "select")
    return (
      <OptionMenu
        value={(value as string | null) ?? null}
        placeholder={`Pick ${field.label.toLowerCase()}`}
        onPick={(id) => onCommit(id)}
        options={(field.options ?? []).map((option) => ({ id: option.id, label: option.label }))}
      />
    );
  if (field.type === "user") return <MemberPicker value={(value as string | null) ?? null} onPick={(id) => onCommit(id)} />;
  if (field.type === "relation" && field.relation)
    return <RelationPicker entity={field.relation} value={relationOf(value)} onPick={(picked) => onCommit(picked ? [picked] : null)} />;
  if (field.type === "checkbox")
    return (
      <OptionMenu
        value={value === true ? "yes" : value === false ? "no" : null}
        placeholder="Pick"
        onPick={(id) => onCommit(id === null ? null : id === "yes")}
        options={[
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]}
      />
    );
  if (field.type === "multi_select") {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return (
      <div className="flex flex-wrap gap-1">
        {(field.options ?? []).map((option) => {
          const on = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                const next = new Set(selected);
                if (on) next.delete(option.id);
                else next.add(option.id);
                onCommit(Array.from(next));
              }}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[12px]",
                on ? "border-ky-ink bg-ky-selected font-semibold text-ky-ink" : "border-ky-hairline text-ky-ink-2 hover:bg-ky-hover",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === initial.trim()) return onCancel?.();
    if (!trimmed) return onCommit(null);
    if (["number", "currency", "percent"].includes(field.type)) return onCommit(Number(trimmed.replace(/[^0-9.-]/g, "")));
    if (field.type === "date" && field.includeTime) return onCommit(new Date(trimmed).toISOString());
    onCommit(trimmed);
  };
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onCancel?.();
    if (event.key === "Enter" && (field.type !== "text" || !event.shiftKey) && !(event.target instanceof HTMLTextAreaElement && event.shiftKey)) {
      event.preventDefault();
      commit();
    }
  };
  const long = field.type === "text" && ["notes", "description", "summary", "reason"].includes(field.key);
  if (long)
    return (
      <textarea
        ref={ref}
        value={draft}
        rows={4}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel?.();
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit();
        }}
        className="w-full rounded-[8px] border border-ky-hairline bg-ky-card px-2.5 py-2 text-[13px] leading-5 outline-none focus:border-ky-accent"
      />
    );
  return (
    <input
      ref={ref}
      value={draft}
      type={
        field.type === "date"
          ? field.includeTime
            ? "datetime-local"
            : "date"
          : field.type === "email"
            ? "email"
            : field.type === "url"
              ? "url"
              : ["number", "currency", "percent"].includes(field.type)
                ? "number"
                : "text"
      }
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={keys}
      placeholder={field.type === "url" ? "https://" : field.label}
      className={inputClass}
    />
  );
}
