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
import type { OrganigrammaResponse } from "@heuresys/shared";
import { comporre, type RigaPersona, type RigaPosizione, type RigaUnita } from "./comporre.js";

export { comporre };

/** «Cognome, Nome»; senza cognome, il nome visualizzato o l'email (stessa regola della rubrica). */
const ETICHETTA = `CASE WHEN nullif(trim(u.user_last_name), '') IS NOT NULL AND nullif(trim(u.user_first_name), '') IS NOT NULL
                       THEN trim(u.user_last_name) || ', ' || trim(u.user_first_name)
                     ELSE coalesce(nullif(trim(u.user_last_name), ''), nullif(trim(u.user_display_name), ''), u.user_email, '—')
                END`;

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

