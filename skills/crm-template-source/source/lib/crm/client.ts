"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CrmSettings } from "@/lib/crm/settings-types";
import type { EntityId } from "@/lib/crm/entities";

export interface CrmRecord {
  entity_id: string;
  record_id: string;
  data: Record<string, unknown> & { id: string };
  created_at?: string;
  updated_at?: string;
}

export interface ListFilter {
  field_id: string;
  operator: string;
  value?: unknown;
}

export interface ListSort {
  field_id: string;
  direction: "asc" | "desc";
}

export const API_PATH: Record<EntityId, string> = {
  companies: "/api/companies",
  people: "/api/people",
  accounts: "/api/accounts",
  deals: "/api/deals",
  activities: "/api/activities",
  tasks: "/api/tasks",
  lists: "/api/lists",
  list_members: "/api/list-members",
  review_items: "/api/review-items",
  sync_sources: "/api/sync-sources",
};

export const crmKeys = {
  all: ["crm"] as const,
  settings: () => ["crm", "settings"] as const,
  counts: () => ["crm", "counts"] as const,
  list: (entity: EntityId, params: unknown) => ["crm", "list", entity, params] as const,
  lists: (entity: EntityId) => ["crm", "list", entity] as const,
  context: (entity: string, id: string) => ["crm", "context", entity, id] as const,
  report: (name: string, params?: unknown) => ["crm", "report", name, params ?? null] as const,
  sources: () => ["crm", "data-sources"] as const,
};

async function request<T>(path: string, init?: RequestInit): Promise<{ body: T; headers: Headers }> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return { body: body as T, headers: response.headers };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request<T>(path, init)).body;
}

export function useSettings() {
  return useQuery({
    queryKey: crmKeys.settings(),
    queryFn: () => api<CrmSettings>("/api/settings"),
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api<CrmSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (settings) => {
      client.setQueryData(crmKeys.settings(), settings);
      void client.invalidateQueries({ queryKey: ["crm", "report"] });
    },
  });
}

export function useCounts() {
  return useQuery({ queryKey: crmKeys.counts(), queryFn: () => api<Record<string, number>>("/api/counts"), staleTime: 30_000 });
}

export interface ListParams {
  q?: string | null;
  filters?: ListFilter[];
  sorts?: ListSort[];
  pageSize?: number;
}

function listUrl(entity: EntityId, params: ListParams, cursor: string | null) {
  const search = new URLSearchParams();
  search.set("limit", String(params.pageSize ?? 50));
  if (params.q) search.set("q", params.q);
  if (params.filters?.length) search.set("filters", JSON.stringify(params.filters));
  if (params.sorts?.length) search.set("sorts", JSON.stringify(params.sorts));
  if (cursor) search.set("cursor", cursor);
  return `${API_PATH[entity]}?${search.toString()}`;
}

interface ListPage {
  records: CrmRecord[];
  pagination: { has_more: boolean; next_cursor?: string };
  total: number;
}

export function useRecords(entity: EntityId, params: ListParams, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: crmKeys.list(entity, params),
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { body, headers } = await request<Omit<ListPage, "total">>(listUrl(entity, params, pageParam));
      return { ...body, total: Number(headers.get("x-total-count") ?? body.records.length) } satisfies ListPage;
    },
    getNextPageParam: (page) => (page.pagination.has_more ? (page.pagination.next_cursor ?? null) : null),
    staleTime: 15_000,
  });
  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.records) ?? [], [query.data]);
  return { ...query, rows, total: query.data?.pages[0]?.total };
}

function invalidateEntity(client: ReturnType<typeof useQueryClient>, entity: EntityId) {
  void client.invalidateQueries({ queryKey: crmKeys.lists(entity) });
  void client.invalidateQueries({ queryKey: ["crm", "context"] });
  void client.invalidateQueries({ queryKey: crmKeys.counts() });
  void client.invalidateQueries({ queryKey: ["crm", "report"] });
  if (entity === "sync_sources") void client.invalidateQueries({ queryKey: crmKeys.sources() });
}

export function useCreateRecord(entity: EntityId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api<CrmRecord>(API_PATH[entity], { method: "POST", body: JSON.stringify({ data }) }),
    onSuccess: () => invalidateEntity(client, entity),
  });
}

export function useUpdateRecord(entity: EntityId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api<CrmRecord>(`${API_PATH[entity]}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ data }) }),
    onSuccess: () => invalidateEntity(client, entity),
  });
}

export function useDeleteRecord(entity: EntityId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`${API_PATH[entity]}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => invalidateEntity(client, entity),
  });
}

export interface RecordContext {
  record: CrmRecord;
  related: Record<string, { total: number; records: CrmRecord[] }>;
  audit: Array<{ action: string; actor: string | null; changes: unknown; at: string }>;
}

export function useRecordContext(entity: string, id: string | null) {
  return useQuery({
    queryKey: crmKeys.context(entity, id ?? ""),
    enabled: Boolean(id),
    queryFn: () => api<RecordContext>(`/api/context/${entity}/${encodeURIComponent(id ?? "")}`),
    staleTime: 10_000,
  });
}

export function useReport<T>(name: "insights" | "quality" | "home", params?: Record<string, string>) {
  const search = params ? `?${new URLSearchParams(params).toString()}` : "";
  return useQuery({ queryKey: crmKeys.report(name, params), queryFn: () => api<T>(`/api/${name}${search}`), staleTime: 30_000 });
}

export interface DataSourcesReport {
  crm_type: string | null;
  connected: CrmRecord[];
  written: Array<{ table: string; source: string; total: number; last_7d: number; last_at: string | null }>;
}

export function useDataSources() {
  return useQuery({
    queryKey: crmKeys.sources(),
    queryFn: () => api<DataSourcesReport>("/api/data-sources"),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useResolveReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "accept" | "dismiss" }) =>
      api<CrmRecord>(`/api/review-items/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ decision }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: crmKeys.all }),
  });
}

/** A relation value as { id, label }, whatever shape it arrived in. */
export function relationOf(value: unknown): { id: string; label: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) return relationOf(value[0]);
  if (typeof value === "string") return { id: value, label: value };
  if (typeof value === "object" && "id" in (value as Record<string, unknown>)) {
    const item = value as { id: unknown; label?: unknown };
    return { id: String(item.id), label: String(item.label ?? item.id) };
  }
  return null;
}

export function text(record: CrmRecord | undefined | null, key: string): string | null {
  const value = record?.data[key];
  return typeof value === "string" && value ? value : null;
}
