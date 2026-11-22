"use client";

import { Check, ChevronDown, Filter, Plus, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FieldDisplay, FieldEditor } from "@/components/crm/fields";
import { RecordPanel } from "@/components/crm/record-view";
import { type Column, CrmTable, type ViewSort } from "@/components/crm/table";
import { EmptyState, InlineError, RecordAvatar, SkeletonRows } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type CrmRecord, type ListFilter, useCreateRecord, useRecords, useSettings } from "@/lib/crm/client";
import { formatNumber } from "@/lib/crm/display";
import { type CrmFieldSpec, type EntityId, entitySpec } from "@/lib/crm/entities";
import { DEFAULT_LABELS, type ObjectLabels } from "@/lib/crm/presets";
import { ENTITY_RECORD, type RecordType, parseRecordParam, recordParam, useQueryState } from "@/lib/crm/url";
import { cn } from "@/lib/utils";

export interface ObjectPageProps {
  entity: EntityId;
  title?: (labels: ObjectLabels) => string;
  singular?: (labels: ObjectLabels) => string;
  /** Filters this page always applies, such as kind = meeting. */
  baseFilters?: ListFilter[];
  /** Fields to offer as quick filters (select, user and stage fields). */
  quickFilters?: string[];
  /** Columns to show, in order; defaults to every inTable field. */
  columns?: string[];
  /** Values a new record starts with. */
  createDefaults?: Record<string, unknown>;
  /** Fields the New dialog asks for, in order. */
  createFields?: string[];
  headerExtra?: ReactNode;
  /** Replaces the table, for example with a board. */
  renderBody?: (rows: CrmRecord[], open: (row: CrmRecord) => void) => ReactNode;
  emptyText?: string;
  /** What a row click opens when it is not this object's own record. */
  onRowOpen?: (row: CrmRecord, openRecord: (type: RecordType, id: string) => void) => void;
  /** Extra controls on the filter row, such as tabs. */
  toolbarExtra?: ReactNode;
  pageSize?: number;
}

function parseSort(raw: string | null): ViewSort | null {
  if (!raw) return null;
  const [field, dir] = raw.split(":");
  return field ? { field, dir: dir === "asc" ? "asc" : "desc" } : null;
}

function parseFilters(raw: string | null): ListFilter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ListFilter[]).filter((item) => item && typeof item.field_id === "string") : [];
  } catch {
    return [];
  }
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-8 w-full max-w-[280px] items-center gap-2 rounded-[10px] border border-ky-hairline bg-ky-card px-2.5">
      <Search className="size-3.5 shrink-0 text-ky-ink-3" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ky-muted"
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="text-ky-ink-3 hover:text-ky-ink">
          <X className="size-3.5" />
        </button>
      ) : null}
    </label>
  );
}

function useFilterOptions(field: CrmFieldSpec, entity: EntityId) {
  const stages = useSettings().data?.deal_stages;
  if (entity === "deals" && field.key === "stage") return (stages ?? []).map((stage) => ({ id: stage.id, label: stage.label }));
  return (field.options ?? []).map((option) => ({ id: option.id, label: option.label }));
}

function QuickFilter({
  entity,
  field,
  filters,
  onChange,
}: {
  entity: EntityId;
  field: CrmFieldSpec;
  filters: ListFilter[];
  onChange: (next: ListFilter[]) => void;
}) {
  const options = useFilterOptions(field, entity);
  const active = filters.find((filter) => filter.field_id === field.key);
  const selected = new Set(Array.isArray(active?.value) ? (active.value as string[]) : active?.value ? [String(active.value)] : []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const rest = filters.filter((filter) => filter.field_id !== field.key);
    onChange(next.size ? [...rest, { field_id: field.key, operator: "in", value: Array.from(next) }] : rest);
  };
  if (!options.length) return null;
  const summary = selected.size ? options.filter((option) => selected.has(option.id)).map((option) => option.label).join(", ") : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="xs" variant={selected.size ? "soft" : "ghost"} className={cn(!selected.size && "text-ky-ink-2")}>
          {field.label}
          {summary ? <span className="max-w-[140px] truncate font-normal">: {summary}</span> : null}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px] rounded-[12px] border border-ky-hairline bg-ky-card p-[6px] shadow-ky-card">
        <DropdownMenuLabel className="ky-text-product-menu-title px-2 text-ky-muted">{field.label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="h-8 rounded-[8px] text-[13px]"
            onSelect={(event) => {
              event.preventDefault();
              toggle(option.id);
            }}
          >
            <span className="flex-1 truncate">{option.label}</span>
            {selected.has(option.id) ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OwnerFilter({ field, filters, onChange }: { field: CrmFieldSpec; filters: ListFilter[]; onChange: (next: ListFilter[]) => void }) {
  const active = filters.find((filter) => filter.field_id === field.key);
  const mine = active?.value === "__me__";
  return (
    <Button
      size="xs"
      variant={mine ? "soft" : "ghost"}
      className={cn(!mine && "text-ky-ink-2")}
      onClick={() => {
        const rest = filters.filter((filter) => filter.field_id !== field.key);
        onChange(mine ? rest : [...rest, { field_id: field.key, operator: "eq", value: "__me__" }]);
      }}
    >
      <Filter className="size-3" />
      Mine
    </Button>
  );
}

export function CreateDialog({
  entity,
  open,
  onOpenChange,
  title,
  fields,
  defaults,
  onCreated,
}: {
  entity: EntityId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: string[];
  defaults?: Record<string, unknown>;
  onCreated?: (record: CrmRecord) => void;
}) {
  const spec = entitySpec(entity);
  const create = useCreateRecord(entity);
  const [values, setValues] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (open) setValues({ ...(defaults ?? {}) });
  }, [open, defaults]);
  if (!spec) return null;
  const specs = fields.map((key) => spec.fields.find((field) => field.key === key)).filter((field): field is CrmFieldSpec => Boolean(field));
  const missing = specs.some((field) => field.required && (values[field.key] === undefined || values[field.key] === null || values[field.key] === ""));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] rounded-[16px] border border-ky-hairline bg-ky-card">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13px] text-ky-ink-2">Everything else can be filled in on the record.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (missing) return;
            create.mutate(values, {
              onSuccess: (record) => {
                onOpenChange(false);
                onCreated?.(record);
              },
            });
          }}
        >
          {specs.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="text-[12px] text-ky-ink-3">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <FieldEditor
                key={`${open}-${field.key}`}
                entity={entity}
                field={field}
                value={values[field.key] ?? null}
                autoFocus={field === specs[0]}
                onCommit={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              />
            </label>
          ))}
          {create.error ? <InlineError message={create.error.message} /> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={missing || create.isPending}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useMe(): string | null {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { id?: string } | null) => {
        if (!cancelled) setMe(body?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return me;
}

export function ObjectPage({
  entity,
  title,
  singular,
  baseFilters = [],
  quickFilters = [],
  columns: columnKeys,
  createDefaults,
  createFields,
  headerExtra,
  renderBody,
  emptyText,
  onRowOpen,
  toolbarExtra,
  pageSize,
}: ObjectPageProps) {
  const spec = entitySpec(entity);
  const { params, update } = useQueryState();
  const settings = useSettings().data;
  const labels = settings?.labels ?? DEFAULT_LABELS;
  const me = useMe();
  const q = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(q);
  const sort = parseSort(params.get("sort"));
  const filters = parseFilters(params.get("f"));
  const record = parseRecordParam(params.get("record"));
  const [creating, setCreating] = useState(false);
  const recordType = ENTITY_RECORD[entity];

  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) update({ q: searchInput || null });
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput, q, update]);

  const effectiveFilters = useMemo(
    () => [
      ...baseFilters,
      ...filters
        .map((filter) => (filter.value === "__me__" ? (me ? { ...filter, value: me } : null) : filter))
        .filter((filter): filter is ListFilter => Boolean(filter)),
    ],
    [baseFilters, filters, me],
  );
  const table = useRecords(entity, {
    q: q || null,
    filters: effectiveFilters,
    sorts: sort ? [{ field_id: sort.field, direction: sort.dir }] : [],
    pageSize,
  });

  if (!spec) return null;
  const pageTitle = title?.(labels) ?? spec.pluralLabel;
  const singleTitle = singular?.(labels) ?? spec.label;
  const visible = (columnKeys ?? spec.fields.filter((field) => field.inTable).map((field) => field.key))
    .map((key) => spec.fields.find((field) => field.key === key))
    .filter((field): field is CrmFieldSpec => Boolean(field));

  const columns: Column<CrmRecord>[] = visible.map((field, index) => ({
    key: field.key,
    header: entity === "deals" && field.key === "amount" ? (settings?.amount_label ?? field.label) : field.label,
    width: index === 0 ? Math.max(field.width ?? 220, 220) : (field.width ?? 150),
    align: ["currency", "number", "percent"].includes(field.type) ? "right" : "left",
    sortField: field.type === "json" ? undefined : field.key,
    render: (row) =>
      index === 0 && recordType ? (
        <span className="flex min-w-0 items-center gap-2">
          <RecordAvatar
            type={recordType}
            name={String(row.data[field.key] ?? "")}
            size={20}
            src={(row.data.avatar_url as string | null) ?? (row.data.logo_url as string | null) ?? null}
          />
          <span className="truncate font-semibold">{String(row.data[field.key] ?? "")}</span>
        </span>
      ) : index === 0 ? (
        <span className="truncate font-semibold">{String(row.data[field.key] ?? "")}</span>
      ) : (
        <FieldDisplay entity={entity} field={field} value={row.data[field.key]} currency={settings?.currency} />
      ),
  }));

  const openRecord = (type: RecordType, id: string) => update({ record: recordParam(type, id) }, "push");
  const open = (row: CrmRecord) => {
    if (onRowOpen) onRowOpen(row, openRecord);
    else if (recordType) openRecord(recordType, row.record_id);
  };
  const toggleSort = (field: string) => {
    const next = !sort || sort.field !== field ? `${field}:asc` : sort.dir === "asc" ? `${field}:desc` : null;
    update({ sort: next });
  };
  const setFilters = (next: ListFilter[]) => update({ f: next.length ? JSON.stringify(next) : null });
  const filtered = Boolean(q) || filters.length > 0;

  return (
    <div className="@container/page relative flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 pt-5 pb-3">
          <h1 className="text-[20px] font-semibold tracking-[-0.3px]">{pageTitle}</h1>
          {table.total !== undefined ? <span className="text-[13px] text-ky-ink-3 tabular-nums">{formatNumber(table.total)}</span> : null}
          <span className="flex-1" />
          {headerExtra}
          {createFields ? (
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <Plus />
              New {singleTitle.toLowerCase()}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          {toolbarExtra}
          <SearchBox value={searchInput} onChange={setSearchInput} placeholder={`Search ${pageTitle.toLowerCase()}`} />
          {quickFilters.map((key) => {
            const field = spec.fields.find((item) => item.key === key);
            if (!field) return null;
            if (field.type === "user") return <OwnerFilter key={key} field={field} filters={filters} onChange={setFilters} />;
            return <QuickFilter key={key} entity={entity} field={field} filters={filters} onChange={setFilters} />;
          })}
          {filtered ? (
            <Button size="xs" variant="ghost" className="text-ky-ink-2" onClick={() => update({ f: null, q: null })}>
              Clear
            </Button>
          ) : null}
        </div>

        <div className="@container/list min-h-0 flex-1 overflow-auto border-t border-ky-hairline">
          {table.isError ? (
            <div className="px-6 py-4">
              <InlineError message={`${pageTitle} could not be loaded. ${table.error.message}`} onRetry={() => void table.refetch()} />
            </div>
          ) : table.isPending ? (
            <SkeletonRows columns={Math.min(columns.length, 7)} />
          ) : table.rows.length === 0 && !renderBody ? (
            <div className="p-6">
              <EmptyState
                title={filtered ? `No ${pageTitle.toLowerCase()} match these filters.` : (emptyText ?? `No ${pageTitle.toLowerCase()} yet.`)}
                action={
                  filtered ? (
                    <Button size="sm" variant="secondary" onClick={() => update({ f: null, q: null })}>
                      Clear filters
                    </Button>
                  ) : createFields ? (
                    <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                      <Plus />
                      New {singleTitle.toLowerCase()}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : renderBody ? (
            renderBody(table.rows, open)
          ) : (
            <CrmTable
              columns={columns}
              rows={table.rows}
              getId={(row) => row.record_id}
              rowLabel={(row) => `Open ${String(row.data[spec.titleField] ?? singleTitle)}`}
              selectedId={record && record.type === recordType ? record.id : null}
              onRowClick={recordType || onRowOpen ? open : undefined}
              sort={sort}
              onSort={toggleSort}
              hasMore={table.hasNextPage}
              loadingMore={table.isFetchingNextPage}
              onLoadMore={() => void table.fetchNextPage()}
              widthStorageKey={`crm-widths-${entity}`}
            />
          )}
        </div>
      </section>

      {record ? <RecordPanel type={record.type} id={record.id} onClose={() => update({ record: null })} /> : null}

      {createFields ? (
        <CreateDialog
          entity={entity}
          open={creating}
          onOpenChange={setCreating}
          title={`New ${singleTitle.toLowerCase()}`}
          fields={createFields}
          defaults={createDefaults}
          onCreated={(created) => {
            toast.success(`${singleTitle} created`);
            if (recordType) update({ record: recordParam(recordType, created.record_id) }, "push");
          }}
        />
      ) : null}
    </div>
  );
}
