/**
 * apps/api/src/modules/quadro/service.ts — GET /v1/me/quadro (classe C15 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Sceglie le lenti delle aree chieste, le fa girare sul perimetro di chi guarda (ADR-0027:
 * cliente intero per i mandati HR e di piattaforma, sotto-albero per chi guida una catena, sé
 * stesso per gli altri) e restituisce gli insight in ordine di gravità. Chi vede solo sé stesso
 * riceve solo le lenti personali; le lenti su rischio d'uscita e retribuzioni girano solo per i
 * mandati HR e di piattaforma. Una lente che fallisce non fa fallire il quadro: si dichiara in
 * `nonCalcolate`, così il giro la vede e nessuno la scambia per «tutto a posto».
 */
import { AREE_QUADRO, type AreaQuadro, type Insight, type QuadroResponse } from "@heuresys/shared";
import { pool } from "../../db/client.js";
import { perimetroClienti, type ActorContext } from "../../lib/actor.js";
import { HR_MANDATED_ROLES, resolveOrgReadScope } from "../../lib/scope/resolver.js";
import { LENTI } from "./lenti.js";

const PESO: Record<Insight["tono"], number> = { rischio: 0, attenzione: 1, informazione: 2, positivo: 3 };

export function areeDa(testo: string | undefined): AreaQuadro[] {
  if (!testo) return [...AREE_QUADRO];
  const chieste = testo.split(",").map((s) => s.trim());
  return AREE_QUADRO.filter((a) => chieste.includes(a));
}

export async function leggiQuadro(
  actor: ActorContext,
  aree: AreaQuadro[],
  registra: (chiave: string, errore: unknown) => void = () => {},
): Promise<QuadroResponse> {
  const scope = await resolveOrgReadScope(pool, actor);
  const perimetro = perimetroClienti(actor);
  const clienti = scope.kind === "all" ? (perimetro === undefined ? null : [...perimetro]) : [scope.tenantId];
  const persone = scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : null;
  const mandatoHR = scope.kind === "all" || actor.roles.some((r) => HR_MANDATED_ROLES.has(r));
  const soloSe = scope.kind === "self";

  const perArea = LENTI.filter(
    (l) =>
      l.aree.some((a) => aree.includes(a)) &&
      (!l.soloMandatoHR || mandatoHR) &&
      (soloSe ? l.personale === true : true),
  );
  // Chi vede solo sé stesso, su una pagina che non ha lenti personali (la selezione,
  // l'organigramma), riceve comunque le proprie: una pagina non apre mai muta (C15).
  const scelte = perArea.length > 0 || !soloSe ? perArea : LENTI.filter((l) => l.personale === true);

  const nonCalcolate: string[] = [];
  const esiti: Array<Insight | null> = await Promise.all(
    scelte.map(async (l) => {
      try {
        // una lente personale riceve un solo parametro, $1 = [chi guarda]: un parametro che la
        // query non usa non ha tipo, e PostgreSQL rifiuta la query.
        const params = l.personale ? [[actor.userId]] : [clienti, persone];
        const r = await pool.query<{ valore: number | null; prima: number | null }>(l.sql, params);
        const valore = Number(r.rows[0]?.valore ?? 0);
        const prima = r.rows[0]?.prima === null || r.rows[0]?.prima === undefined ? null : Number(r.rows[0].prima);
        const letto = l.leggi(valore, prima);
        if (!letto) return null;
        const andamento = l.chiave === "giorni-di-assenza-30" && prima ? Math.round(((valore - prima) / prima) * 100) : null;
        const area = l.aree.find((a) => aree.includes(a)) ?? l.aree[0]!;
        const voce: Insight = { ...letto, chiave: l.chiave, area, valore, andamento };
        return voce;
      } catch (e) {
        registra(l.chiave, e);
        nonCalcolate.push(l.chiave);
        return null;
      }
    }),
  );
  const insight = esiti.filter((x): x is Insight => x !== null);
  insight.sort((a, b) => PESO[a.tono] - PESO[b.tono]);
  return { insight, nonCalcolate, verifiche: scelte.length - nonCalcolate.length };
}
