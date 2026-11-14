/**
 * apps/api/src/modules/organigramma/repository.ts — GET /v1/me/organigramma.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V1). L'organigramma di un cliente
 * calcolato a ogni richiesta dai dati vivi, mai da un grafo salvato: il grafo a nodi salvato di
 * RTL era stato scritto una volta da un seed e mostrava posizioni che non esistono più («HR
 * Director» staccato dal «CEO»). Qui le unità, le persone e i riporti sono quelli del momento.
 *
 * Solo nomi, come la rubrica (`../rubrica/repository.ts`): «Cognome, Nome», la posizione,
 * l'unità. Il perimetro è quello dei clienti dell'attore (I5: filtro nel servizio, mai RLS).
 */
import { pool } from "../../db/client.js";
import type { OrganigrammaResponse, OrganigrammaUnita } from "@heuresys/shared";

/** «Cognome, Nome»; senza cognome, il nome visualizzato o l'email (stessa regola della rubrica). */
const ETICHETTA = `CASE WHEN nullif(trim(u.user_last_name), '') IS NOT NULL AND nullif(trim(u.user_first_name), '') IS NOT NULL
                       THEN trim(u.user_last_name) || ', ' || trim(u.user_first_name)
                     ELSE coalesce(nullif(trim(u.user_last_name), ''), nullif(trim(u.user_display_name), ''), u.user_email, '—')
                END`;

interface RigaUnita {
  id: string; codice: string | null; nome: string; tipo: string | null; relazione: string | null;
  padreId: string | null; responsabileId: string | null; responsabile: string | null;
}
interface RigaPersona {
  id: string; etichetta: string; posizioneId: string; posizione: string; unitaId: string | null;
  cognome: string | null; nome: string | null;
}
interface RigaPosizione {
  id: string; titolo: string; unitaId: string | null; riportaAId: string | null;
  titolareId: string | null; titolare: string | null;
}

export async function nomeCliente(tenantId: string): Promise<string | null> {
  const r = await pool.query<{ nome: string }>(
    `SELECT coalesce(tenant_name, tenant_code) AS nome FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0]?.nome ?? null;
}

export async function leggiOrganigramma(tenantId: string, cliente: string): Promise<OrganigrammaResponse> {
  const unita = await pool.query<RigaUnita>(
    `SELECT ou.organization_unit_id AS id, ou.organization_unit_code AS codice,
            coalesce(ou.organization_unit_name, ou.organization_unit_code, '—') AS nome,
            ou.organization_unit_type AS tipo, ou.organization_unit_relation AS relazione,
            ou.organization_unit_parent_id AS "padreId",
            ou.organization_unit_manager_user_id AS "responsabileId",
            CASE WHEN u.user_id IS NULL THEN NULL ELSE ${ETICHETTA} END AS responsabile
       FROM sys.sys_organization_units ou
       LEFT JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
      WHERE ou.organization_unit_tenant_id = $1 AND ou.organization_unit_is_active
      ORDER BY coalesce((ou.organization_unit_metadata->>'sort_order')::int, 9999), lower(ou.organization_unit_name), ou.organization_unit_id`,
    [tenantId],
  );

  const persone = await pool.query<RigaPersona>(
    `SELECT u.user_id AS id, ${ETICHETTA} AS etichetta,
            p.position_id AS "posizioneId", coalesce(p.position_title, p.position_code, '—') AS posizione,
            p.position_organization_unit_id AS "unitaId",
            u.user_last_name AS cognome, u.user_first_name AS nome
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE p.position_tenant_id = $1 AND p.position_is_active
        AND a.user_position_assignment_status = 'ACTIVE'
      ORDER BY lower(u.user_last_name) NULLS LAST, lower(u.user_first_name) NULLS LAST, u.user_id, p.position_id`,
    [tenantId],
  );

  const posizioni = await pool.query<RigaPosizione>(
    `SELECT p.position_id AS id, coalesce(p.position_title, p.position_code, '—') AS titolo,
            p.position_organization_unit_id AS "unitaId",
            p.position_reports_to_position_id AS "riportaAId",
            tit.user_id AS "titolareId", tit.etichetta AS titolare
       FROM sys.sys_positions p
       LEFT JOIN LATERAL (
             SELECT u.user_id, ${ETICHETTA} AS etichetta
               FROM sys.sys_user_position_assignments a
               JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
              WHERE a.user_position_assignment_position_id = p.position_id
                AND a.user_position_assignment_status = 'ACTIVE'
              ORDER BY a.user_position_assignment_start_date DESC NULLS LAST, u.user_id
              LIMIT 1
       ) tit ON true
      WHERE p.position_tenant_id = $1 AND p.position_is_active
      ORDER BY lower(p.position_title), p.position_id`,
    [tenantId],
  );

  return comporre(tenantId, cliente, unita.rows, persone.rows, posizioni.rows);
}

/** Pura: dalle righe lette all'albero. Esportata per i test. */
export function comporre(
  tenantId: string, cliente: string,
  righeUnita: RigaUnita[], righePersone: RigaPersona[], righePosizioni: RigaPosizione[],
): OrganigrammaResponse {
  const ids = new Set(righeUnita.map((u) => u.id));
  // Un padre fuori dalle unità attive del cliente fa dell'unità una radice: si disegna, non si perde.
  const padreDi = (u: RigaUnita) => (u.padreId && ids.has(u.padreId) && u.padreId !== u.id ? u.padreId : null);
  const figli = new Map<string, string[]>();
  for (const u of righeUnita) {
    const p = padreDi(u);
    if (!p) continue;
    if (!figli.has(p)) figli.set(p, []);
    figli.get(p)!.push(u.id);
  }

  const perUnita = new Map<string, RigaPersona[]>();
  const vistePerUnita = new Map<string, Set<string>>();
  for (const p of righePersone) {
    if (!p.unitaId || !ids.has(p.unitaId)) continue;
    const viste = vistePerUnita.get(p.unitaId) ?? new Set<string>();
    if (viste.has(p.id)) continue; // una persona con due posizioni nella stessa unità compare una volta
    viste.add(p.id);
    vistePerUnita.set(p.unitaId, viste);
    if (!perUnita.has(p.unitaId)) perUnita.set(p.unitaId, []);
    perUnita.get(p.unitaId)!.push(p);
  }

  const posizioniPerUnita = new Map<string, RigaPosizione[]>();
  for (const p of righePosizioni) {
    if (!p.unitaId) continue;
    if (!posizioniPerUnita.has(p.unitaId)) posizioniPerUnita.set(p.unitaId, []);
    posizioniPerUnita.get(p.unitaId)!.push(p);
  }

  // Livello e addetti totali con una visita che non cade nei cicli (il servizio delle unità li
  // rifiuta, ma un dato storico può ancora averne uno: qui si interrompe, non si va in loop).
  const livello = new Map<string, number>();
  const totali = new Map<string, number>();
  const visita = (id: string, l: number, sulCammino: Set<string>): number => {
    if (sulCammino.has(id)) return 0;
    sulCammino.add(id);
    livello.set(id, l);
    let t = vistePerUnita.get(id)?.size ?? 0;
    for (const f of figli.get(id) ?? []) t += visita(f, l + 1, sulCammino);
    sulCammino.delete(id);
    totali.set(id, t);
    return t;
  };
  for (const u of righeUnita) if (!padreDi(u)) visita(u.id, 1, new Set());
  // Unità rimaste fuori (solo dentro un ciclo): radici a sé.
  for (const u of righeUnita) if (!livello.has(u.id)) visita(u.id, 1, new Set());

  const unita: OrganigrammaUnita[] = righeUnita.map((u) => {
    const pers = (perUnita.get(u.id) ?? []).map((p) => ({
      id: p.id, etichetta: p.etichetta, posizioneId: p.posizioneId, posizione: p.posizione,
      responsabile: p.id === u.responsabileId,
    }));
    // Il responsabile per primo, gli altri in ordine di cognome (R1).
    pers.sort((a, b) => Number(b.responsabile) - Number(a.responsabile));
    const pos = posizioniPerUnita.get(u.id) ?? [];
    return {
      id: u.id, codice: u.codice, nome: u.nome, tipo: u.tipo, relazione: u.relazione,
      padreId: padreDi(u), livello: livello.get(u.id) ?? 1, filiale: u.tipo === "BRANCH",
      responsabileId: u.responsabileId, responsabile: u.responsabile,
      persone: pers, posizioni: pos.length, scoperte: pos.filter((p) => !p.titolareId).length,
      addettiTotali: totali.get(u.id) ?? pers.length,
    };
  });

  const idPosizioni = new Set(righePosizioni.map((p) => p.id));
  return {
    tenantId, cliente, calcolatoIl: new Date().toISOString(), unita,
    posizioni: righePosizioni.map((p) => ({
      id: p.id, titolo: p.titolo, unitaId: p.unitaId,
      riportaAId: p.riportaAId && idPosizioni.has(p.riportaAId) ? p.riportaAId : null,
      titolareId: p.titolareId, titolare: p.titolare,
    })),
    avvisi: {
      posizioniSenzaRiporto: righePosizioni.filter((p) => !p.riportaAId).length,
      riportiFuoriCliente: righePosizioni.filter((p) => p.riportaAId && !idPosizioni.has(p.riportaAId)).length,
      unitaSenzaResponsabile: righeUnita.filter((u) => !u.responsabileId).length,
    },
  };
}
