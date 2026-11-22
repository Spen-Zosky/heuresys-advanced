/**
 * apps/api/src/modules/tenant-processes/repository.ts — SQL parametrizzato su `sys.sys_tenant_processes`.
 * ADR-0060, piano delle applet, voce P3.
 */
import type { Pool, PoolClient } from "pg";
import type { ProcessFacetValue, TenantProcess, TenantProcessFacet } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Riga {
  tenant_process_id: string;
  tenant_process_tenant_id: string;
  tenant_process_code: string;
  tenant_process_name: string;
  tenant_process_is_active: boolean;
  tenant_process_owner_position_id: string | null;
  position_title: string | null;
  owner_covered: boolean;
}

const SELECT_PROCESSO = `
  SELECT tp.tenant_process_id, tp.tenant_process_tenant_id, tp.tenant_process_code,
         tp.tenant_process_name, tp.tenant_process_is_active, tp.tenant_process_owner_position_id,
         p.position_title,
         (tp.tenant_process_owner_position_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM sys.sys_user_position_assignments a
             WHERE a.user_position_assignment_position_id = tp.tenant_process_owner_position_id
               AND a.user_position_assignment_status = 'ACTIVE')) AS owner_covered
    FROM sys.sys_tenant_processes tp
    LEFT JOIN sys.sys_positions p ON p.position_id = tp.tenant_process_owner_position_id`;

function mappa(r: Riga): TenantProcess {
  return {
    id: r.tenant_process_id,
    tenantId: r.tenant_process_tenant_id,
    code: r.tenant_process_code,
    name: r.tenant_process_name,
    isActive: r.tenant_process_is_active,
    ownerPositionId: r.tenant_process_owner_position_id,
    ownerPositionTitle: r.position_title,
    ownerCovered: r.owner_covered,
  };
}

export async function findProcessById(q: DbConnector, id: string): Promise<TenantProcess | null> {
  const r = await q.query<Riga>(`${SELECT_PROCESSO} WHERE tp.tenant_process_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Blocca la riga del processo per la durata della transazione e ne dà il responsabile attuale. */
export async function lockOwner(
  q: DbConnector, id: string,
): Promise<{ tenantId: string; isActive: boolean; ownerPositionId: string | null } | null> {
  const r = await q.query<{ t: string; a: boolean; o: string | null }>(
    `SELECT tenant_process_tenant_id AS t, tenant_process_is_active AS a,
            tenant_process_owner_position_id AS o
       FROM sys.sys_tenant_processes WHERE tenant_process_id = $1 FOR UPDATE`,
    [id],
  );
  const row = r.rows[0];
  return row ? { tenantId: row.t, isActive: row.a, ownerPositionId: row.o } : null;
}

export async function positionTenant(
  q: DbConnector, positionId: string,
): Promise<{ tenantId: string; isActive: boolean } | null> {
  const r = await q.query<{ t: string; a: boolean }>(
    `SELECT position_tenant_id AS t, position_is_active AS a FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  const row = r.rows[0];
  return row ? { tenantId: row.t, isActive: row.a } : null;
}

/** Vero se la persona regge oggi la posizione (assegnazione `ACTIVE`). */
export async function holdsPosition(q: DbConnector, userId: string, positionId: string): Promise<boolean> {
  const r = await q.query(
    `SELECT 1 FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_user_id = $1
        AND user_position_assignment_position_id = $2
        AND user_position_assignment_status = 'ACTIVE' LIMIT 1`,
    [userId, positionId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function setOwner(
  q: DbConnector, id: string, ownerPositionId: string | null, actorId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_tenant_processes
        SET tenant_process_owner_position_id = $2, updated_at = now(), updated_by = $3
      WHERE tenant_process_id = $1
        AND tenant_process_owner_position_id IS DISTINCT FROM $2`,
    [id, ownerPositionId, actorId],
  );
}

// ---------------------------------------------------------------------------------------------
// ADR-0061 D4, passo 2 (000507): le faccette di un processo del tenant.
// ---------------------------------------------------------------------------------------------

export async function facetVocabulary(q: DbConnector): Promise<ProcessFacetValue[]> {
  const r = await q.query<ProcessFacetValue>(
    `SELECT process_facet_value_facet AS facet, process_facet_value_code AS code,
            process_facet_value_ordinal::int AS ordinal, process_facet_value_label_it AS label,
            process_facet_value_description_it AS description
       FROM sys.sys_process_facet_values
      ORDER BY array_position(ARRAY['FINALITA','BENEFICIARIO','PERIMETRO','MODALITA','ATTIVAZIONE','TECNOLOGIA','STANDARDIZZAZIONE']::text[], process_facet_value_facet::text),
               process_facet_value_ordinal`,
  );
  return r.rows;
}

export async function processFacets(q: DbConnector, processId: string): Promise<TenantProcessFacet[]> {
  const r = await q.query<TenantProcessFacet>(
    `SELECT f.tenant_process_facet_facet AS facet, f.tenant_process_facet_value_code AS code,
            v.process_facet_value_label_it AS label, f.tenant_process_facet_criterion AS criterion,
            f.tenant_process_facet_source AS source, f.tenant_process_facet_status AS status,
            to_char(f.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "updatedAt"
       FROM sys.sys_tenant_process_facets f
       JOIN sys.sys_process_facet_values v
         ON v.process_facet_value_facet = f.tenant_process_facet_facet
        AND v.process_facet_value_code = f.tenant_process_facet_value_code
      WHERE f.tenant_process_facet_process_id = $1
      ORDER BY array_position(ARRAY['FINALITA','BENEFICIARIO','PERIMETRO','MODALITA','ATTIVAZIONE','TECNOLOGIA','STANDARDIZZAZIONE']::text[], f.tenant_process_facet_facet::text),
               v.process_facet_value_ordinal`,
    [processId],
  );
  return r.rows;
}

/** I codici del vocabolario che esistono per la faccetta, fra quelli chiesti. */
export async function knownFacetCodes(q: DbConnector, facet: string, codes: readonly string[]): Promise<string[]> {
  const r = await q.query<{ code: string }>(
    `SELECT process_facet_value_code AS code FROM sys.sys_process_facet_values
      WHERE process_facet_value_facet = $1 AND process_facet_value_code = ANY($2::text[])`,
    [facet, codes],
  );
  return r.rows.map((x) => x.code);
}

/**
 * Sostituisce i valori di una faccetta per un processo: le righe che non servono più si tolgono, le
 * altre si scrivono come decisione della persona (fonte PERSONA, stato APPROVATA). Approvare una
 * proposta dell'agente è la stessa scrittura con i codici proposti.
 */
export async function replaceFacet(
  q: DbConnector, tenantId: string, processId: string, facet: string, codes: readonly string[], criterion: string,
): Promise<void> {
  await q.query(
    `DELETE FROM sys.sys_tenant_process_facets
      WHERE tenant_process_facet_process_id = $1 AND tenant_process_facet_facet = $2
        AND NOT (tenant_process_facet_value_code = ANY($3::text[]))`,
    [processId, facet, codes],
  );
  if (codes.length === 0) return;
  await q.query(
    `INSERT INTO sys.sys_tenant_process_facets
       (tenant_process_facet_tenant_id, tenant_process_facet_process_id, tenant_process_facet_facet,
        tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_source,
        tenant_process_facet_status)
     SELECT $1, $2, $3, c, $5, 'PERSONA', 'APPROVATA' FROM unnest($4::text[]) AS c
     ON CONFLICT (tenant_process_facet_process_id, tenant_process_facet_facet, tenant_process_facet_value_code)
     DO UPDATE SET tenant_process_facet_criterion = EXCLUDED.tenant_process_facet_criterion,
                   tenant_process_facet_source = 'PERSONA', tenant_process_facet_status = 'APPROVATA',
                   updated_at = now()`,
    [tenantId, processId, facet, codes, criterion],
  );
}

// ---------------------------------------------------------------------------------------------
// ADR-0061 D7, passo 4 (000509): la corrispondenza di un'attività con APQC.
// ---------------------------------------------------------------------------------------------

/** L'attività del processo (o di un suo sottoprocesso) con il codice APQC dei metadati. */
export async function stepOfProcess(
  q: DbConnector, processId: string, stepId: string,
): Promise<{ tenantId: string; apqcCode: string | null } | null> {
  const r = await q.query<{ t: string; c: string | null }>(
    `SELECT st.tenant_process_step_tenant_id AS t, nullif(st.tenant_process_step_metadata->>'apqc', '') AS c
       FROM sys.sys_tenant_process_steps st
       JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = st.tenant_process_step_process_id
      WHERE st.tenant_process_step_id = $2
        AND (tp.tenant_process_id = $1 OR tp.tenant_process_parent_id = $1)`,
    [processId, stepId],
  );
  const row = r.rows[0];
  return row ? { tenantId: row.t, apqcCode: row.c } : null;
}

export async function upsertStepMapping(
  q: DbConnector, tenantId: string, stepId: string, code: string, kind: string, criterion: string,
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_tenant_process_step_mappings
       (tenant_process_step_mapping_tenant_id, tenant_process_step_mapping_step_id, tenant_process_step_mapping_scheme,
        tenant_process_step_mapping_code, tenant_process_step_mapping_kind, tenant_process_step_mapping_criterion,
        tenant_process_step_mapping_source, tenant_process_step_mapping_status)
     VALUES ($1, $2, 'APQC_PCF', $3, $4, $5, 'PERSONA', 'APPROVATA')
     ON CONFLICT (tenant_process_step_mapping_step_id, tenant_process_step_mapping_scheme)
     DO UPDATE SET tenant_process_step_mapping_code = EXCLUDED.tenant_process_step_mapping_code,
                   tenant_process_step_mapping_kind = EXCLUDED.tenant_process_step_mapping_kind,
                   tenant_process_step_mapping_criterion = EXCLUDED.tenant_process_step_mapping_criterion,
                   tenant_process_step_mapping_source = 'PERSONA', tenant_process_step_mapping_status = 'APPROVATA',
                   updated_at = now()`,
    [tenantId, stepId, code, kind, criterion],
  );
}
