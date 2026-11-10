"use client";

/**
 * apps/web/src/lib/agente/use-tabella-agente.ts — ogni tabella si dichiara all'assistente
 * (piano dell'assistente nelle interfacce, blocco I1).
 *
 * Lo usa `EntityTable`, così la regola vale per tutte le pagine che la compongono, presenti e
 * future, invece di una pagina alla volta come in mod-platform. La tabella dice che cosa mostra
 * (i nomi delle colonne, quante righe, se è una pagina sola di un elenco sul server) e accetta i
 * comandi della vista; l'esito è quello vero (`vista-tabella.ts`). Le righe non escono dal browser.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useVistaAgente, type VistaDichiarata } from "./contesto";
import {
  COMANDI_TABELLA,
  applicaVista,
  eseguiComando,
  testoDi,
  vistaAttiva,
  type StatoVistaTabella,
} from "./vista-tabella";

interface Colonna<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
}

export interface TabellaAgente<T> {
  /** Le righe da mostrare: quelle ricevute, se l'assistente non ha cambiato la vista. */
  righe: T[];
  stato: StatoVistaTabella;
  nomiColonne: string[];
  azzera: () => void;
}

export function useTabellaAgente<T>(
  columns: readonly Colonna<T>[],
  rows: T[],
  server?: { total: number },
): TabellaAgente<T> {
  const [stato, setStato] = useState<StatoVistaTabella>({});
  const statoRef = useRef(stato);
  useEffect(() => {
    statoRef.current = stato;
  }, [stato]);

  const nomiColonne = useMemo(() => columns.map((c) => testoDi(c.header)), [columns]);
  const celle = useMemo(() => (r: T) => columns.map((c) => testoDi(c.cell(r))), [columns]);

  // Senza un comando dell'assistente le righe restano le stesse, anche come riferimento.
  const righe = useMemo(() => (vistaAttiva(stato) ? applicaVista(rows, celle, stato) : rows), [rows, celle, stato]);

  const totale = server ? server.total : rows.length;
  const dichiarata = useMemo<VistaDichiarata>(() => {
    const ctx = { colonne: nomiColonne, paginaServer: server !== undefined && server.total > rows.length, totale };
    return {
      vista: {
        tipo: "tabella",
        colonne: nomiColonne.filter(Boolean),
        righeCaricate: rows.length,
        righeMostrate: righe.length,
        totale,
        ...(ctx.paginaServer ? { paginaDelServer: true } : {}),
        ...(vistaAttiva(stato) ? { vistaDellAssistente: descrivi(stato, nomiColonne) } : {}),
      },
      comandi: COMANDI_TABELLA,
      esegui: (nome, argomenti) => {
        const r = eseguiComando(statoRef.current, nome, argomenti, ctx);
        if (r.esito.stato === "rifiutata") return r.esito;
        statoRef.current = r.stato;
        setStato(r.stato);
        const mostrate = vistaAttiva(r.stato) ? applicaVista(rows, celle, r.stato).length : rows.length;
        const conto = `Righe mostrate: ${mostrate} di ${rows.length} caricate.`;
        return { ...r.esito, dettaglio: r.esito.dettaglio ? `${r.esito.dettaglio} ${conto}` : conto };
      },
    };
  }, [nomiColonne, server, rows, righe.length, totale, stato, celle]);
  useVistaAgente(dichiarata);

  return { righe, stato, nomiColonne, azzera: () => setStato({}) };
}

/** Che cosa ha cambiato l'assistente, in parole: per il modello e per la riga sopra la tabella. */
export function descrivi(s: StatoVistaTabella, nomi: readonly string[]): string {
  const parti: string[] = [];
  if (s.testo) parti.push(`ricerca «${s.testo}»`);
  if (s.filtro) parti.push(`${nomi[s.filtro.colonna] ?? "colonna"} contiene «${s.filtro.valore}»`);
  if (s.ordine) parti.push(`ordinata per ${nomi[s.ordine.colonna] ?? "colonna"}, ${s.ordine.verso}`);
  return parti.join(" · ");
}
