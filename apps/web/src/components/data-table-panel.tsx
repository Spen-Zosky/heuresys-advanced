"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Badge, Button, DataTableWithCrossHair, EmptyState, ErrorState, PageHeader } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Canonical list-page composition (brand-component-contract.md: "Data table /
 * entity list" → DataTableWithCrossHair + StatusPill, with PageHeader,
 * EmptyState, ErrorState). Presentational: the page owns the query and passes
 * resolved rows + column descriptors. Built purely from @heuresys/ui primitives;
 * lives in apps/web as tenant-domain composition.
 *
 * - `EntityTable`: the state-machine (loading/error/empty) + DataTableWithCrossHair.
 *   Reuse it inside tabbed pages that have their own PageHeader.
 * - `DataTablePanel`: full page = <main> + PageHeader + EntityTable.
 *
 * Live-data doctrine: `rows` come from a real /v1/* fetch; the empty branch is a
 * real empty-state, never a placeholder.
 */
export interface DataColumn<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  headClassName?: string;
  cellClassName?: string;
}

export interface EntityTableProps<T> {
  isLoading: boolean;
  isError: boolean;
  errorTestId?: string;
  errorMessage?: string;
  rows: T[];
  rowKey: (row: T) => string;
  rowTestId?: string;
  columns: DataColumn<T>[];
  emptyTestId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
  /** Client-side rows per page. Defaults to 25. Pagination UI shows only when rows.length exceeds this. */
  pageSize?: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function EntityTable<T>(props: EntityTableProps<T>) {
  const { t } = useTranslation();
  const {
    isLoading, isError, errorTestId, errorMessage,
    rows, rowKey, rowTestId, columns,
    emptyTestId, emptyTitle, emptyDescription, caption,
    pageSize: pageSizeProp,
  } = props;

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeProp ?? 25);
  const [trackedRows, setTrackedRows] = useState(rows);

  // Reset to the first page whenever the row set changes (a new fetch resolves or a
  // filter shrinks the result set → new array reference). Adjust-state-during-render
  // (the React-recommended pattern) instead of a setState-in-effect, which
  // react-hooks/set-state-in-effect (eslint-config-next@16) flags.
  if (trackedRows !== rows) {
    setTrackedRows(rows);
    setPageIndex(0);
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        data-testid={errorTestId}
        title={errorMessage ?? t("error.load")}
        description={t("error.loadHint")}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        data-testid={emptyTestId}
        icon={<Inbox className="h-6 w-6" />}
        title={emptyTitle ?? t("empty.none")}
        {...(emptyDescription ? { description: emptyDescription } : {})}
      />
    );
  }
  const total = rows.length;
  const showPagination = total > pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const start = safePageIndex * pageSize;
  const end = Math.min(start + pageSize, total);
  const visibleRows = showPagination ? rows.slice(start, end) : rows;
  const from = total === 0 ? 0 : start + 1;
  const to = end;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <DataTableWithCrossHair caption={caption} className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {columns.map((c, i) => (
              <th key={i} className={`px-4 py-2 ${c.align === "right" ? "text-right" : ""} ${c.headClassName ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleRows.map((row) => (
            <tr key={rowKey(row)} data-testid={rowTestId} className="transition-colors hover:bg-muted/60">
              {columns.map((c, i) => (
                <td key={i} className={`px-4 py-2 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.cellClassName ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTableWithCrossHair>
      {showPagination ? (
        <div
          data-testid="table-pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground"
        >
          <span>{t("pagination.range", { from, to, total })}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="pagination-prev"
              disabled={safePageIndex <= 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            >
              {t("pagination.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="pagination-next"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            >
              {t("pagination.next")}
            </Button>
            <select
              aria-label={t("pagination.rowsPerPage")}
              className="rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {t("pagination.perPage", { size })}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface DataTablePanelProps<T> extends EntityTableProps<T> {
  pageTestId: string;
  titleTestId?: string;
  countTestId?: string;
  title: string;
  description?: string;
  /** Rendered in a badge next to the title (e.g. "433 totali"). */
  count?: ReactNode;
  actions?: ReactNode;
}

export function DataTablePanel<T>(props: DataTablePanelProps<T>) {
  const {
    pageTestId, titleTestId, countTestId, title, description, count, actions,
    ...table
  } = props;

  return (
    <main data-testid={pageTestId} className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid={titleTestId}
        title={title}
        description={description}
        actions={actions}
        badges={
          count != null ? (
            <Badge variant="secondary" data-testid={countTestId}>{count}</Badge>
          ) : undefined
        }
      />
      <EntityTable<T> {...table} />
    </main>
  );
}
