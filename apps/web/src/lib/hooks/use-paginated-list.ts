"use client";

/**
 * apps/web/src/lib/hooks/use-paginated-list.ts
 *
 * C4-mini (S1018): canonical SERVER-side pagination hook for list pages.
 * Every /v1/* list endpoint follows the `{ items, total }` + `?limit=&offset=`
 * contract; this hook owns the page state, builds the querystring (dropping
 * empty filters), keeps the previous page rendered while the next one loads
 * (TanStack keepPreviousData) and resets to page 0 when filters change.
 *
 * Pairs with `EntityTable`'s `server` prop (data-table-panel.tsx): the returned
 * `server` object plugs straight in, so a page reads:
 *
 *   const list = usePaginatedList<Row>({ queryKey: ["provenance"], path: "/v1/provenance",
 *                                        params: { validationStatus: status } });
 *   <EntityTable rows={list.rows} server={list.server} ... />
 *
 * Doctrine: new list pages use THIS instead of the legacy `?limit=200` +
 * client-side slicing (ATLAS §5 anti-pattern; retrofit of old pages = #42 C4).
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";

export interface PaginatedList<TRow> {
  items: TRow[];
  total: number;
}

export type ListParamValue = string | number | boolean | null | undefined;

export interface UsePaginatedListOptions {
  /** Stable query-key prefix, e.g. ["provenance", "list"]. Page/filter state is appended. */
  queryKey: readonly unknown[];
  /** Endpoint path WITHOUT querystring, e.g. "/v1/provenance". */
  path: string;
  /** Filter params — empty string / null / undefined entries are dropped. */
  params?: Record<string, ListParamValue>;
  /** Rows per page (default 25 — same default as EntityTable client mode). */
  initialPageSize?: number;
  /** Forwarded to useQuery (e.g. gate on a permission probe). */
  enabled?: boolean;
}

export interface ServerPagination {
  total: number;
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function usePaginatedList<TRow>(options: UsePaginatedListOptions) {
  const { queryKey, path, params, initialPageSize = 25, enabled = true } = options;
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Filters changed → back to page 0. Adjust-state-during-render (the React-recommended
  // pattern used across this app, e.g. EntityTable) instead of a setState-in-effect.
  const paramsKey = JSON.stringify(params ?? {});
  const [trackedParamsKey, setTrackedParamsKey] = useState(paramsKey);
  if (trackedParamsKey !== paramsKey) {
    setTrackedParamsKey(paramsKey);
    setPageIndex(0);
  }

  const search = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    sp.set("limit", String(pageSize));
    sp.set("offset", String(pageIndex * pageSize));
    return sp.toString();
    // paramsKey is the serialized identity of `params` (object literals change ref per render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, pageIndex, pageSize]);

  const query = useQuery({
    queryKey: [...queryKey, { paramsKey, pageIndex, pageSize }],
    queryFn: () => apiFetch<PaginatedList<TRow>>(`${path}?${search}`),
    placeholderData: keepPreviousData,
    enabled,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp: a filter shrank the set below the current page (server total is authoritative).
  if (query.data && pageIndex > 0 && pageIndex >= pageCount) {
    setPageIndex(pageCount - 1);
  }

  const server: ServerPagination = {
    total,
    pageIndex,
    pageSize,
    onPageIndexChange: setPageIndex,
    onPageSizeChange: (size: number) => {
      setPageSize(size);
      setPageIndex(0);
    },
  };

  return {
    query,
    rows: query.data?.items ?? [],
    total,
    pageIndex,
    pageSize,
    pageCount,
    setPageIndex,
    server,
  };
}
