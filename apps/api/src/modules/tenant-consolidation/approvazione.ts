/**
 * apps/api/src/modules/tenant-consolidation/approvazione.ts — la bozza e l'approvazione definitiva
 * (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md, voci W1-W5; Enzo, 2026-11-14).
 *
 * Le decisioni e la loro cascata restano nel registro della sessione: è la bozza, e i dati vivi del
 * tenant non cambiano. Solo «Approva definitivamente le modifiche» le riversa, in una transazione sola,
 * con il giornale di ritorno (staging.tenant_consolidation_undo) per ogni valore scritto.
 *
 * Dentro la stessa transazione si contano, prima e dopo, le righe di ogni vista sentinella `sys.v_*`
 * (le stesse che db_health raccoglie): se l'approvazione ne accende una, cioè ne fa crescere il conto,
 * la transazione si annulla e la risposta dice quale. È la lezione del 2026-11-14: due unità create
 * senza responsabile avevano rotto la catena delle migrazioni al rilascio successivo.
 */
import type { PoolClient } from "pg";

export interface Violazione { view: string; before: number; after: number }

/**
 * Sentinelle di dati derivati che si ricalcolano da sé: crescono quando l'approvazione rinomina una
 * competenza o un ruolo (l'embedding diventa vecchio) e tornano a zero al ricalcolo del matching
 * semantico. Non fermano l'approvazione; l'anteprima le riporta come «da ricalcolare».
 */
export const SENTINELLE_RICALCOLABILI: ReadonlySet<string> = new Set(["v_embedding_impronta_non_combacia"]);

/** Il conto di ogni vista sentinella sys.v_*, in una sola chiamata. */
export async function contaSentinelle(c: PoolClient): Promise<Map<string, number>> {
  const { rows } = await c.query<{ v: string; n: string }>(
    `SELECT viewname AS v,
            (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM sys.%I', viewname), false, true, '')))[1]::text AS n
       FROM pg_views
      WHERE schemaname = 'sys' AND viewname LIKE 'v\\_%'`,
  );
  return new Map(rows.map((r) => [r.v, Number(r.n)]));
}

/** Le sentinelle che sono cresciute fra le due misure (con `ricalcolabili` true, solo quelle ricalcolabili). */
export function accese(prima: Map<string, number>, dopo: Map<string, number>, ricalcolabili = false): Violazione[] {
  const out: Violazione[] = [];
  for (const [view, after] of dopo) {
    if (SENTINELLE_RICALCOLABILI.has(view) !== ricalcolabili) continue;
    const before = prima.get(view) ?? 0;
    if (after > before) out.push({ view, before, after });
  }
  return out.sort((a, b) => a.view.localeCompare(b.view));
}
