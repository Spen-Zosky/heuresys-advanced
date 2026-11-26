/**
 * apps/api/test/helpers/giornali.ts — le aggiunte DICHIARATE fuori da un import non toccano i
 * numeri dell'import.
 *
 * I test di riconciliazione tengono numeri fissi apposta: sorvegliano che un import non perda
 * righe in silenzio. Ma un numero fisso non distingue una perdita da un'aggiunta legittima
 * (S1083, la 000361). La cura è la stessa ovunque: si escludono le righe che uno script ha
 * scritto e GIORNALIZZATO riga per riga, e restano dentro le righe che nessuno ha dichiarato.
 *
 * 2026-11-26: gli script di allineamento di RTL (db/scripts/rtl-allinea/, novembre 2026)
 * giornalizzano in staging.rtl_allinea_{org,skill}_undo con la forma (tabella, chiave uuid).
 * Una copia della CI che precede quegli script non ha il giornale: allora non c'è niente da
 * escludere e il frammento vale `true`, quindi il conteggio resta quello di prima.
 */
import { pool } from "../../src/db/client.js";

const NOME_GIORNALE = /^staging\.[a-z0-9_]+$/;
const NOME_COLONNA = /^([a-z][a-z0-9_]*\.)?[a-z][a-z0-9_]*$/;

/**
 * Un frammento SQL che è vero per le righe NON presenti nel giornale indicato.
 * `tabella` è il valore della colonna `tabella` del giornale, `colonna` l'espressione
 * dell'id della riga da confrontare con `chiave`.
 */
export async function fuoriDalGiornale(giornale: string, tabella: string, colonna: string): Promise<string> {
  if (!NOME_GIORNALE.test(giornale)) throw new Error(`giornale non valido: ${giornale}`);
  if (!NOME_COLONNA.test(colonna)) throw new Error(`colonna non valida: ${colonna}`);
  const { rows } = await pool.query<{ c: string | null }>(`SELECT to_regclass($1)::text AS c`, [giornale]);
  if (!rows[0]?.c) return "true";
  const t = tabella.replace(/'/g, "''");
  return `NOT EXISTS (SELECT 1 FROM ${giornale} j WHERE j.tabella = '${t}' AND j.chiave = ${colonna})`;
}

/**
 * Vero per le righe che NON stanno su uno dei posti nuovi di storia36 C13
 * (db/seeds/storia36/14_selezione.sql, scelta di Enzo del 2026-11-06): nascono con
 * `position_metadata.storia36 = 'C13'` e `origine = 'potenziamento'` e ricevono una copia del
 * profilo del posto modello (competenze, KPI e formazione richiesti). Non sono import.
 */
export function fuoriDaiPostiNuoviC13(colonnaPosizione: string): string {
  if (!NOME_COLONNA.test(colonnaPosizione)) throw new Error(`colonna non valida: ${colonnaPosizione}`);
  return `NOT EXISTS (SELECT 1 FROM sys.sys_positions np
                       WHERE np.position_id = ${colonnaPosizione}
                         AND np.position_metadata->>'storia36' = 'C13'
                         AND np.position_metadata->>'origine' = 'potenziamento')`;
}
