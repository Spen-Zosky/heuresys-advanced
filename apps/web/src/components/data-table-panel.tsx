"use client";

import type { ReactNode } from "react";
import { Badge, DataTableWithCrossHair, EmptyState, ErrorState, PageHeader } from "@heuresys/ui";
import { Inbox } from "lucide-react";

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
}

export function EntityTable<T>(props: EntityTableProps<T>) {
  const {
    isLoading, isError, errorTestId, errorMessage,
    rows, rowKey, rowTestId, columns,
    emptyTestId, emptyTitle, emptyDescription, caption,
  } = props;

  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
        Caricamento…
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        data-testid={errorTestId}
        title={errorMessage ?? "Impossibile caricare i dati."}
        description="Riprova più tardi o verifica la connessione."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        data-testid={emptyTestId}
        icon={<Inbox className="h-6 w-6" />}
        title={emptyTitle ?? "Nessun risultato"}
        {...(emptyDescription ? { description: emptyDescription } : {})}
      />
    );
  }
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
          {rows.map((row) => (
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
