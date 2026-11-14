"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import { Badge, Button, DataTableWithCrossHair, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { useTranslation } from "react-i18next";
import type { ServerPagination } from "@/lib/hooks/use-paginated-list";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { OrigineDelDato, OrigineDellaRiga } from "@/components/origine-del-dato";
import { descrivi, useTabellaAgente } from "@/lib/agente/use-tabella-agente";
import { ConSpiegazione } from "@/components/spiegazione";
import { useLeggibile } from "@/lib/leggibile";

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
  /**
   * C2, C3: un dato che serve a chi controlla, non a chi lavora (codice tecnico, email). Non va in
   * tabella ma nella scheda della riga. Senza indicazione lo è ogni colonna la cui intestazione
   * dice «Codice», «Code», «Email» o «Identificativo».
   */
  secondaria?: boolean;
}

/** Colonne di identificativi: la rete di leggibilità non le tocca («24122» resta un CAP). */
const INTESTAZIONE_IDENTIFICATIVO = /\b(cap|matricola|telefono|cellulare|iban|pernr|partita iva|codice fiscale|numero di (badge|documento|pratica))\b/i;
const grezza = <T,>(c: DataColumn<T>) => typeof c.header === "string" && INTESTAZIONE_IDENTIFICATIVO.test(c.header);

const INTESTAZIONE_SECONDARIA = /^\s*(codice|code|cod\.|e-?mail|identificativo|id)\b/i;
/** Una cella è vuota quando non porta niente: assente, stringa vuota, il trattino, o un elemento
 *  che contiene soltanto uno di questi. */
export function cellaVuota(n: unknown, profondita = 0): boolean {
  if (n === null || n === undefined || n === false || n === "") return true;
  if (typeof n === "string") return /^\s*(—|–|-|n\/d)?\s*$/i.test(n);
  if (Array.isArray(n)) return n.every((x) => cellaVuota(x, profondita + 1));
  if (profondita < 3 && typeof n === "object" && "props" in (n as object)) {
    const p = (n as { props?: { children?: unknown } }).props;
    if (p && "children" in p && typeof (n as { type?: unknown }).type === "string") return cellaVuota(p.children, profondita + 1);
  }
  return false;
}

function eSecondaria<T>(c: DataColumn<T>): boolean {
  return c.secondaria ?? (typeof c.header === "string" && INTESTAZIONE_SECONDARIA.test(c.header));
}

export interface EntityTableProps<T> {
  isLoading: boolean;
  isError: boolean;
  errorTestId?: string;
  errorMessage?: string;
  /** Il motivo da dire se l'API nega l'accesso (403), quando la pagina lo sa meglio dell'API (F-5). */
  deniedReason?: string;
  /**
   * L'errore della chiamata (F-4, S-12). Se e' un errore dell'API, la riga d'errore dice che cosa
   * e' successo nella lingua della persona e porta il riferimento da citare; altrimenti resta il
   * testo generico.
   */
  error?: unknown;
  rows: T[];
  rowKey: (row: T) => string;
  rowTestId?: string;
  /** Optional row-click handler (master-detail pages, e.g. whistleblowing-console). When
   * set, the `<tr>` becomes keyboard-operable (Enter/Space) and gets a pointer cursor. */
  onRowClick?: (row: T) => void;
  columns: DataColumn<T>[];
  emptyTestId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
  /** Client-side rows per page. Defaults to 25. Pagination UI shows only when rows.length exceeds this. */
  pageSize?: number;
  /**
   * SERVER-side pagination (C4-mini, S1018): `rows` are ALREADY the current page and
   * total/page state live in the caller — plug in `usePaginatedList(...).server`.
   * When set, client slicing and the rows-change page reset are disabled.
   */
  server?: ServerPagination;
  /**
   * Il percorso API da cui vengono le righe (A-14, origine del dato). Con la paginazione del
   * server viene da `server.apiPath`; un elenco caricato per intero lo passa qui.
   */
  originPath?: string;
}

/** Le intestazioni dello stato: la colonna che chiude la riga (R3). */
const INTESTAZIONE_STATO = /^(stato|status|attiv[ao]|stato del dato)$/i;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function EntityTable<T>(props: EntityTableProps<T>) {
  const { t } = useTranslation();
  // C1, C2, C4 del piano interfaccia sistematica: ogni cella passa per la rete di leggibilità
  // (numeri it-IT, codici e frasi inglesi in italiano, email e identificativi in nomi).
  const leggi = useLeggibile();
  const {
    isLoading, isError, errorTestId, errorMessage, error, deniedReason,
    rows: righeRicevute, rowKey, rowTestId, onRowClick, columns,
    emptyTestId, emptyTitle, emptyDescription, caption,
    pageSize: pageSizeProp, server, originPath,
  } = props;
  const percorsoOrigine = originPath ?? server?.apiPath;
  // La tabella si dichiara all'assistente e ne esegue i comandi della vista (cerca, filtra,
  // ordina): cambiano solo le righe mostrate, e la riga sopra la tabella dice che cosa è cambiato.
  const agente = useTabellaAgente(columns, righeRicevute, server);
  const rows = agente.righe;

  const [pageIndex, setPageIndex] = useState(0);
  // C12: una riga senza pagina di dettaglio apre la sua scheda (tutte le colonne, con le persone,
  // posizioni e unità che aprono a loro volta la propria). Nessuna riga «che sembra cliccabile e
  // non apre niente», e nessuna tabella che obbliga a leggere di traverso una riga lunga.
  const [rigaAperta, setRigaAperta] = useState<T | null>(null);
  const [pageSize, setPageSize] = useState(pageSizeProp ?? 25);
  const [trackedRows, setTrackedRows] = useState(rows);

  // Reset to the first page whenever the row set changes (a new fetch resolves or a
  // filter shrinks the result set → new array reference). Adjust-state-during-render
  // (the React-recommended pattern) instead of a setState-in-effect, which
  // react-hooks/set-state-in-effect (eslint-config-next@16) flags.
  // Server mode: page changes legitimately swap the rows array — never reset there
  // (the hook owns the reset-on-filter-change).
  if (!server && trackedRows !== rows) {
    setTrackedRows(rows);
    setPageIndex(0);
  }

  if (isLoading) {
    return <StatoCaricamento />;
  }
  if (isError) {
    return (
      <StatoErrore
        errore={error}
        titolo={errorMessage ?? t("error.load")}
        {...(deniedReason ? { motivoNegato: deniedReason } : {})}
        {...(errorTestId ? { testId: errorTestId } : {})}
      />
    );
  }
  if (righeRicevute.length === 0 && (!server || server.total === 0)) {
    return (
      <StatoVuoto
        titolo={emptyTitle ?? t("empty.none")}
        {...(emptyDescription ? { motivo: emptyDescription } : {})}
        {...(emptyTestId ? { testId: emptyTestId } : {})}
      />
    );
  }
  const total = server ? server.total : rows.length;
  const effPageSize = server ? server.pageSize : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / effPageSize));
  const safePageIndex = Math.min(server ? server.pageIndex : pageIndex, pageCount - 1);
  const showPagination = total > effPageSize;
  const start = safePageIndex * effPageSize;
  const visibleRows = server ? rows : showPagination ? rows.slice(start, start + effPageSize) : rows;
  const end = server ? start + rows.length : Math.min(start + effPageSize, total);
  // A-14: se le righe portano la loro origine (`origineDato`, X-2), la si mostra in colonna.
  const primaRiga = visibleRows[0] as Record<string, unknown> | undefined;
  const conOrigine = typeof primaRiga?.origineDato === "string";
  const colonnaOrigine: DataColumn<T> = {
    header: t("origine.colonna"),
    cell: (r: T) => {
      const v = (r as Record<string, unknown>).origineDato;
      return typeof v === "string" ? <OrigineDellaRiga valore={v} /> : null;
    },
  };
  // Prima della colonna delle azioni (intestazione vuota) e prima dello stato, che chiude la
  // riga (repertorio interfacce, R3): l'origine è un dato come gli altri, lo stato resta in coda.
  let coda = columns.length;
  if (coda > 0 && columns[coda - 1]!.header === "") coda--;
  const penultima = columns[coda - 1];
  if (penultima && typeof penultima.header === "string" && INTESTAZIONE_STATO.test(penultima.header.trim())) coda--;
  const colonne: DataColumn<T>[] = !conOrigine
    ? columns
    : [...columns.slice(0, coda), colonnaOrigine, ...columns.slice(coda)];
  // In tabella le colonne del lavoro; nella scheda della riga tutte (C2, C3).
  // C9: una colonna vuota in tutte le righe in vista non dice niente; esce dalla tabella e resta
  // nella scheda della riga.
  const vuotaOvunque = (c: DataColumn<T>) =>
    visibleRows.length > 0 && c.header !== "" && visibleRows.every((r) => cellaVuota(c.cell(r)));
  const primarie = colonne.filter((c) => !eSecondaria(c) && !vuotaOvunque(c));
  const inTabella = primarie.filter((c) => c.header !== "").length >= 2 ? primarie : colonne;
  const titoloRiga = inTabella.find((c) => c.header !== "") ?? colonne[0];
  const from = total === 0 ? 0 : start + 1;
  const to = end;
  const goToPage = (i: number) =>
    server ? server.onPageIndexChange(i) : setPageIndex(i);
  const changePageSize = (s: number) => {
    if (server) {
      server.onPageSizeChange(s);
    } else {
      setPageSize(s);
      setPageIndex(0);
    }
  };

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      {agente.stato.testo !== undefined || agente.stato.filtro !== undefined || agente.stato.ordine !== undefined ? (
        <div data-testid="vista-assistente" className="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-1.5 text-xs">
          <span>{t("agente.vistaCambiata", { cosa: descrivi(agente.stato, agente.nomiColonne), righe: rows.length })}</span>
          <Button variant="ghost" size="sm" data-testid="vista-assistente-azzera" onClick={agente.azzera}>
            {t("agente.vistaAzzera")}
          </Button>
        </div>
      ) : null}
      {percorsoOrigine ? (
        <div className="flex justify-end border-b border-border px-3 py-1.5">
          <OrigineDelDato path={percorsoOrigine} />
        </div>
      ) : null}
      <DataTableWithCrossHair caption={caption} className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {inTabella.map((c, i) => (
              <th key={i} className={`px-4 py-2 ${c.align === "right" ? "text-right" : ""} ${c.headClassName ?? ""}`}>
                <ConSpiegazione>{c.header}</ConSpiegazione>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleRows.map((row) => (
            <tr
              key={rowKey(row)}
              data-testid={rowTestId}
              className="cursor-pointer transition-colors hover:bg-muted/60"
              tabIndex={0}
              role="button"
              {...(onRowClick ? {} : { "data-scheda-riga": "" })}
              onClick={(e) => {
                // un comando dentro la cella (collegamento, pulsante, campo) fa il suo lavoro
                if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, [data-riferimento]")) return;
                if (onRowClick) onRowClick(row);
                else setRigaAperta(row);
              }}
              onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (onRowClick) onRowClick(row);
                  else setRigaAperta(row);
                }
              }}
            >
              {inTabella.map((c, i) => (
                <td key={i} className={`px-4 py-2 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.cellClassName ?? ""}`} {...(grezza(c) ? { "data-grezzo": "" } : {})}>
                  {grezza(c) ? c.cell(row) : leggi.nodo(c.cell(row))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTableWithCrossHair>
      <Dialog open={rigaAperta !== null} onOpenChange={(o) => { if (!o) setRigaAperta(null); }}>
        {rigaAperta !== null ? (
          <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto" data-testid="scheda-riga">
            <DialogTitle className="text-lg font-bold leading-tight">{leggi.nodo(titoloRiga?.cell(rigaAperta))}</DialogTitle>
            <DialogDescription className="text-xs">{caption ?? t("dettaglio.riga")}</DialogDescription>
            <dl className="mt-3 divide-y divide-border">
              {colonne.map((c, i) =>
                c.header === "" || c === titoloRiga ? null : (
                  <div key={i} className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm">
                    <dt className="text-muted-foreground"><ConSpiegazione>{c.header}</ConSpiegazione></dt>
                    <dd className="min-w-0" {...(grezza(c) ? { "data-grezzo": "" } : {})}>{grezza(c) ? c.cell(rigaAperta) : leggi.nodo(c.cell(rigaAperta))}</dd>
                  </div>
                ),
              )}
            </dl>
          </DialogContent>
        ) : null}
      </Dialog>
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
              onClick={() => goToPage(Math.max(0, safePageIndex - 1))}
            >
              {t("pagination.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="pagination-next"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => goToPage(Math.min(pageCount - 1, safePageIndex + 1))}
            >
              {t("pagination.next")}
            </Button>
            <select
              aria-label={t("pagination.rowsPerPage")}
              className="rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              value={effPageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
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
  /** Rendered between the PageHeader and the table (filter bars, search panels, …). */
  children?: ReactNode;
}

export function DataTablePanel<T>(props: DataTablePanelProps<T>) {
  const {
    pageTestId, titleTestId, countTestId, title, description, count, actions, children,
    ...table
  } = props;

  return (
    <main data-testid={pageTestId} className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
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
      {children}
      <EntityTable<T> {...table} />
    </main>
  );
}
