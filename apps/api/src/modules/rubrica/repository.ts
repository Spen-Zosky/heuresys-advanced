/**
 * apps/api/src/modules/rubrica/repository.ts — GET /v1/me/rubrica (classe C2 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Nomi, non dati: per ogni persona attiva, posizione attiva e unità attiva del perimetro di chi
 * chiede, il nome che una persona riconosce. Le persone sono scritte «Cognome, Nome» e ordinate
 * per cognome (R1 del repertorio interfacce), con la posizione e l'unità principali per
 * distinguere gli omonimi. Il perimetro è quello dei clienti dell'attore (I5: filtro nel
 * servizio, mai RLS): un mandato di piattaforma vede tutti i clienti.
 */
import { pool } from "../../db/client.js";
import { perimetroClienti, type ActorContext } from "../../lib/actor.js";
import type { RubricaResponse } from "@heuresys/shared";

export async function leggiRubrica(actor: ActorContext): Promise<RubricaResponse> {
  const perimetro = perimetroClienti(actor);
  const tenants = perimetro === undefined ? null : [...perimetro];

  const persone = await pool.query<RubricaResponse["persone"][number]>(
    `SELECT u.user_id AS id, u.user_email AS email,
            CASE WHEN nullif(trim(u.user_last_name), '') IS NOT NULL AND nullif(trim(u.user_first_name), '') IS NOT NULL
                   THEN trim(u.user_last_name) || ', ' || trim(u.user_first_name)
                 ELSE coalesce(nullif(trim(u.user_last_name), ''), nullif(trim(u.user_display_name), ''), u.user_email, '—')
            END AS etichetta,
            pos.position_title AS posizione, pos.organization_unit_name AS unita,
            pos.position_id AS "posizioneId", pos.organization_unit_id AS "unitaId",
            (u.user_status = 'ACTIVE') AS attiva
       FROM sys.sys_users u
       LEFT JOIN LATERAL (
         SELECT p.position_id, p.position_title, ou.organization_unit_id, ou.organization_unit_name
           FROM sys.sys_user_position_assignments a
           JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
           LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
          WHERE a.user_position_assignment_user_id = u.user_id
            AND a.user_position_assignment_status = 'ACTIVE'
          ORDER BY (a.user_position_assignment_kind = 'PRIMARY') DESC,
                   a.user_position_assignment_start_date DESC NULLS LAST
          LIMIT 1
       ) pos ON true
      WHERE ($1::uuid[] IS NULL OR u.user_tenant_id = ANY($1::uuid[]))
      ORDER BY lower(u.user_last_name) NULLS LAST, lower(u.user_first_name) NULLS LAST, u.user_id`,
    [tenants],
  );

  const posizioni = await pool.query<RubricaResponse["posizioni"][number]>(
    `SELECT p.position_id AS id, p.position_code AS codice, coalesce(p.position_title, p.position_code, '—') AS titolo,
            ou.organization_unit_name AS unita,
            p.position_organization_unit_id AS "unitaId",
            p.position_reports_to_position_id AS "riportaAId",
            p.position_criticality AS criticita,
            p.position_is_active AS attiva,
            tit.user_id AS "titolareId",
            tit.etichetta AS titolare
       FROM sys.sys_positions p
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
       LEFT JOIN LATERAL (
             SELECT u.user_id, CASE WHEN nullif(trim(u.user_last_name), '') IS NOT NULL
                           THEN trim(u.user_last_name) || coalesce(', ' || nullif(trim(u.user_first_name), ''), '')
                         ELSE u.user_display_name END AS etichetta
               FROM sys.sys_user_position_assignments a
               JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
              WHERE a.user_position_assignment_position_id = p.position_id
                AND a.user_position_assignment_status = 'ACTIVE'
              ORDER BY a.user_position_assignment_start_date DESC NULLS LAST
              LIMIT 1
       ) tit ON true
      WHERE ($1::uuid[] IS NULL OR p.position_tenant_id = ANY($1::uuid[]))
      ORDER BY lower(p.position_title), p.position_id`,
    [tenants],
  );

  const unita = await pool.query<RubricaResponse["unita"][number]>(
    `SELECT ou.organization_unit_id AS id, ou.organization_unit_code AS codice,
            coalesce(ou.organization_unit_name, ou.organization_unit_code, '—') AS nome,
            ou.organization_unit_type AS tipo,
            ou.organization_unit_parent_id AS "padreId",
            ou.organization_unit_manager_user_id AS "responsabileId",
            ou.organization_unit_is_active AS attiva
       FROM sys.sys_organization_units ou
      WHERE ($1::uuid[] IS NULL OR ou.organization_unit_tenant_id = ANY($1::uuid[]))
      ORDER BY lower(ou.organization_unit_name), ou.organization_unit_id`,
    [tenants],
  );

  return { persone: persone.rows, posizioni: posizioni.rows, unita: unita.rows };
}
