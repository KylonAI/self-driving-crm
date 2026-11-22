"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { buildUrlStateHref, type UrlStateValue } from "@/lib/url-state";

/** Record kinds that open in the side panel and on their own page. */
export type RecordType = "company" | "person" | "account" | "deal";

export const RECORD_ENTITY: Record<RecordType, "companies" | "people" | "accounts" | "deals"> = {
  company: "companies",
  person: "people",
  account: "accounts",
  deal: "deals",
};

export const ENTITY_RECORD: Record<string, RecordType> = {
  companies: "company",
  people: "person",
  accounts: "account",
  deals: "deal",
};

export const RECORD_ROUTE: Record<RecordType, string> = {
  company: "/companies",
  person: "/people",
  account: "/accounts",
  deal: "/deals",
};

export function recordParam(type: RecordType, id: string) {
  return `${type}:${id}`;
}

export function parseRecordParam(value: string | null): { type: RecordType; id: string } | null {
  if (!value) return null;
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!id || !type || !(type in RECORD_ENTITY)) return null;
  return { type: type as RecordType, id };
}

/** Reads and writes this page's query state without dropping unrelated keys. */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const update = useCallback(
    (patch: Record<string, UrlStateValue>, mode: "push" | "replace" = "replace") => {
      const href = buildUrlStateHref({ pathname, search: params.toString(), hash: typeof window === "undefined" ? "" : window.location.hash }, patch);
      if (mode === "push") router.push(href as Route, { scroll: false });
      else router.replace(href as Route, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, pathname, update };
}

/** Opens a record in the side panel of the current page. */
export function useOpenRecord() {
  const { update } = useQueryState();
  return useCallback((type: RecordType, id: string) => update({ record: recordParam(type, id) }, "push"), [update]);
}
