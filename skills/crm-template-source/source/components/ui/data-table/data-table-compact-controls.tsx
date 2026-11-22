import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ListFilter, X } from 'lucide-react';
import { useState } from 'react';
import type { DataColumn, DataColumnFilter, DataSortState } from '@/components/ui/data-types';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaceMemberProfiles } from '@/components/providers/kylon-workspace-provider';
import { cn } from '@/lib/utils';
import { DataTableFilterValue } from './data-table-filter-value';
import { columnFilterOptionIds, isColumnFilterable, isColumnSortable, keepMenuOpen } from './data-table-utils';

const COMPACT_FILTER_BADGE_LIMIT = 2;

const compactTriggerClassName =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring-subtle data-[state=open]:text-foreground [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5';

interface DataTableCompactControlsProps<TRow> {
  className?: string;
  columns: DataColumn<TRow>[];
  columnFilters: DataColumnFilter[];
  sort: DataSortState | null;
  onSortApply: (column: DataColumn<TRow>, direction: 'asc' | 'desc' | null) => void;
  onFilterToggle: (column: DataColumn<TRow>, optionId: string) => void;
  onFiltersClearAll: () => void;
}

/**
 * Sort/filter entry points for the compact (card list) presentation, driven by
 * the same state and callbacks as the desktop header menus.
 */
export function DataTableCompactControls<TRow>({
  className,
  columns,
  columnFilters,
  sort,
  onSortApply,
  onFilterToggle,
  onFiltersClearAll,
}: DataTableCompactControlsProps<TRow>) {
  const workspaceMembers = useWorkspaceMemberProfiles();
  // Phone-width screens have no room beside the menu for a flyout submenu, so
  // picking a column swaps this menu's content to that column's options.
  const [filterColumnKey, setFilterColumnKey] = useState<string | null>(null);
  const sortableColumns = columns.filter((column) => isColumnSortable(column));
  const filterableColumns = columns.filter((column) => isColumnFilterable(column, workspaceMembers));
  if (sortableColumns.length === 0 && filterableColumns.length === 0) return null;

  const activeFilterColumn = filterableColumns.find((column) => column.key === filterColumnKey);
  const filterValuesFor = (column: DataColumn<TRow>) =>
    columnFilters.find((filter) => filter.column === column.key)?.values ?? [];
  const showFilterColumn = (event: Event, columnKey: string | null) => {
    event.preventDefault();
    setFilterColumnKey(columnKey);
  };
  const sortColumn = sort ? columns.find((column) => column.key === sort.column) : undefined;
  const activeFilterBadges = columnFilters.flatMap((filter) => {
    const column = filterableColumns.find((candidate) => candidate.key === filter.column);
    if (!column) return [];
    return filter.values.map((value) => ({ key: `${filter.column}:${value}`, column, value }));
  });
  const visibleFilterBadges = activeFilterBadges.slice(0, COMPACT_FILTER_BADGE_LIMIT);
  const hiddenFilterCount = activeFilterBadges.length - visibleFilterBadges.length;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {sortableColumns.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={compactTriggerClassName} aria-label="Sort rows">
            {sortColumn && sort ? (
              <>
                {sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />}
                <span className="truncate">{sortColumn.label}</span>
              </>
            ) : (
              <>
                <ArrowUpDown />
                Sort
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {sortableColumns.map((column) => {
              const active = sort?.column === column.key;
              return (
                <DropdownMenuItem
                  key={column.key}
                  onSelect={() =>
                    onSortApply(column, active && sort?.direction === 'asc' ? 'desc' : 'asc')
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{column.label}</span>
                  {active ? (sort?.direction === 'asc' ? <ArrowUp /> : <ArrowDown />) : null}
                </DropdownMenuItem>
              );
            })}
            {sortColumn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onSortApply(sortColumn, null)}>
                  <X />
                  Clear sort
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {filterableColumns.length > 0 ? (
        <DropdownMenu onOpenChange={(open) => (open ? undefined : setFilterColumnKey(null))}>
          <DropdownMenuTrigger className={compactTriggerClassName} aria-label="Filter rows">
            <ListFilter />
            {visibleFilterBadges.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {visibleFilterBadges.map(({ key, column, value }) => (
                  <DataTableFilterValue key={key} column={column} value={value} workspaceMembers={workspaceMembers} />
                ))}
                {hiddenFilterCount > 0 ? (
                  <span className="shrink-0 text-[11px] leading-4 font-semibold text-tertiary-foreground">
                    +{hiddenFilterCount}
                  </span>
                ) : null}
              </span>
            ) : (
              'Filter'
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {activeFilterColumn ? (
              <>
                <DropdownMenuItem onSelect={(event) => showFilterColumn(event, null)}>
                  <ChevronLeft />
                  <span className="min-w-0 flex-1 truncate font-medium">{activeFilterColumn.label}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {columnFilterOptionIds(activeFilterColumn, workspaceMembers).map((optionId) => (
                  <DropdownMenuCheckboxItem
                    key={optionId}
                    checked={filterValuesFor(activeFilterColumn).includes(optionId)}
                    indicatorPosition="end"
                    onSelect={keepMenuOpen}
                    onCheckedChange={() => onFilterToggle(activeFilterColumn, optionId)}
                  >
                    <DataTableFilterValue column={activeFilterColumn} value={optionId} workspaceMembers={workspaceMembers} />
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            ) : (
              filterableColumns.map((column) => {
                const filterValues = filterValuesFor(column);
                return (
                  <DropdownMenuItem key={column.key} onSelect={(event) => showFilterColumn(event, column.key)}>
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    {filterValues.length > 0 ? (
                      <span className="ml-2 flex min-w-0 items-center gap-1 overflow-hidden">
                        {filterValues.slice(0, COMPACT_FILTER_BADGE_LIMIT).map((value) => (
                          <DataTableFilterValue key={value} column={column} value={value} workspaceMembers={workspaceMembers} />
                        ))}
                        {filterValues.length > COMPACT_FILTER_BADGE_LIMIT ? (
                          <span className="shrink-0 text-[11px] leading-4 font-semibold text-tertiary-foreground">
                            +{filterValues.length - COMPACT_FILTER_BADGE_LIMIT}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    <ChevronRight className="ml-auto" />
                  </DropdownMenuItem>
                );
              })
            )}
            {!activeFilterColumn && activeFilterBadges.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onFiltersClearAll}>
                  <X />
                  Clear filters
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
