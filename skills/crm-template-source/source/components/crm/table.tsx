"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ViewSort {
  field: string;
  dir: "asc" | "desc";
}

export interface Column<T> {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right";
  /** Field name in the table API; omit for columns that cannot sort. */
  sortField?: string;
  render: (row: T) => ReactNode;
}

/** Rows that open in place to show what sits under them. */
export interface RowExpansion<T> {
  canExpand: (row: T) => boolean;
  render: (row: T) => ReactNode;
  /** Words for the toggle's label, such as "Show 7 people". */
  label: (row: T, expanded: boolean) => string;
}

interface ExpansionState {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
}

const ExpansionContext = createContext<ExpansionState | null>(null);

/** For a cell that also opens its row. Null outside an expandable table. */
export function useRowExpansion(): ExpansionState | null {
  return useContext(ExpansionContext);
}

interface CrmTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getId: (row: T) => string;
  rowLabel: (row: T) => string;
  selectedId?: string | null;
  onRowClick?: (row: T) => void;
  sort: ViewSort | null;
  onSort?: (field: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  compact?: boolean;
  widthStorageKey?: string;
  expansion?: RowExpansion<T>;
}

function useColumnWidths(columns: { key: string; width: number }[], storageKey?: string) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, number>;
      setWidths(stored);
    } catch {
      setWidths({});
    }
  }, [storageKey]);
  const setWidth = useCallback(
    (key: string, width: number) => {
      setWidths((current) => {
        const next = { ...current, [key]: Math.max(72, Math.min(640, Math.round(width))) };
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );
  return { widthOf: (column: { key: string; width: number }) => widths[column.key] ?? column.width, setWidth };
}

/**
 * The CRM table: 40px rows (36px compact), divider lines only, sticky header
 * and first column. Selected is Mist; hover is a fill, nothing moves.
 */
export function CrmTable<T>({
  columns,
  rows,
  getId,
  rowLabel,
  selectedId,
  onRowClick,
  sort,
  onSort,
  hasMore,
  loadingMore,
  onLoadMore,
  compact = false,
  widthStorageKey,
  expansion,
}: CrmTableProps<T>) {
  const { widthOf, setWidth } = useColumnWidths(columns, widthStorageKey);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const expansionState = useMemo<ExpansionState>(
    () => ({
      isExpanded: (id) => expanded.has(id),
      toggle: (id) =>
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
    }),
    [expanded],
  );
  const sentinel = useRef<HTMLTableRowElement | null>(null);
  const totalWidth = columns.reduce((sum, column) => sum + widthOf(column), 0);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingMore) onLoadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, rows.length]);

  const startResize = (key: string, startX: number, startWidth: number) => {
    const move = (event: PointerEvent) => setWidth(key, startWidth + event.clientX - startX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <ExpansionContext.Provider value={expansion ? expansionState : null}>
    <table className="border-separate border-spacing-0 text-[13px]" style={{ width: totalWidth, tableLayout: "fixed" }}>
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={{ width: widthOf(column) }} />
        ))}
      </colgroup>
      <thead>
        <tr className="crm-head">
          {columns.map((column, index) => {
            const sorted = sort && column.sortField && sort.field === column.sortField ? sort.dir : null;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                className={cn(
                  "group/th sticky top-0 z-20 h-9 border-b border-ky-divider px-3 text-left text-[11.5px] font-medium whitespace-nowrap text-ky-ink-3",
                  index === 0 && "left-0 z-30",
                  column.align === "right" && "text-right",
                )}
              >
                {column.sortField && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.sortField as string)}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 rounded-[4px] hover:text-ky-ink",
                      column.align === "right" && "flex-row-reverse",
                      sorted && "text-ky-ink",
                    )}
                  >
                    <span className="truncate">{column.header}</span>
                    {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                  </button>
                ) : (
                  <span className="truncate">{column.header}</span>
                )}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${column.header}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    startResize(column.key, event.clientX, widthOf(column));
                  }}
                  className="absolute top-2 right-0 bottom-2 w-1 cursor-col-resize rounded-full opacity-0 group-hover/th:bg-ky-divider group-hover/th:opacity-100"
                />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = getId(row);
          const selected = selectedId === id;
          const canExpand = expansion ? expansion.canExpand(row) : false;
          const open = canExpand && expanded.has(id);
          return (
            <Fragment key={id}>
              <tr
                data-selected={selected}
                aria-selected={selected}
                aria-expanded={canExpand ? open : undefined}
                tabIndex={0}
                aria-label={rowLabel(row)}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onRowClick?.(row);
                }}
                className={cn("crm-row cursor-pointer outline-none focus-visible:[&>td]:shadow-[inset_0_0_0_2px_var(--ky-color-accent-default)]")}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      "overflow-hidden border-b border-ky-divider px-3 align-middle text-ellipsis whitespace-nowrap text-ky-ink",
                      compact ? "h-9" : "h-10",
                      index === 0 && "sticky left-0 z-10",
                      index === 0 && expansion && "pl-1.5",
                      column.align === "right" && "text-right tabular-nums",
                    )}
                  >
                    {index === 0 && expansion ? (
                      <span className="flex min-w-0 items-center gap-1">
                        {canExpand ? (
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={expansion.label(row, open)}
                            title={expansion.label(row, open)}
                            onClick={(event) => {
                              event.stopPropagation();
                              expansionState.toggle(id);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="grid size-5 shrink-0 place-items-center rounded-[5px] text-ky-ink-3 hover:bg-ky-hover hover:text-ky-ink"
                          >
                            <ChevronRight className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} />
                          </button>
                        ) : (
                          <span aria-hidden className="size-5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">{column.render(row)}</span>
                      </span>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
              {open && expansion ? (
                <tr className="crm-expansion">
                  <td colSpan={columns.length} className="border-b border-ky-divider bg-ky-recessed p-0">
                    {/* Pinned to the visible part of the list, so it stays readable when the list scrolls sideways. */}
                    <div className="sticky left-0 w-[100cqw] max-w-full">{expansion.render(row)}</div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
        {hasMore ? (
          <tr ref={sentinel}>
            <td colSpan={columns.length} className="h-10 px-3 text-[12px] text-ky-ink-3">
              {loadingMore ? "Loading more…" : ""}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
    </ExpansionContext.Provider>
  );
}
