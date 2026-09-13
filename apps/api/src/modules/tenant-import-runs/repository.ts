/**
 * apps/api/src/modules/tenant-import-runs/repository.ts
 * #206 — Tenant Builder P4. SQL parametrizzato sulle tabelle che ESISTONO GIA':
 *
 *   · `reference_sync.source_exports`   — la fonte, con impronta unica (T3, mig 000410);
 *   · `staging.tenant_import_people`    — l'atterraggio, tutte le colonne del cliente text (T2);
 *   · `sys.sys_seed_acquisition_runs`   — la corsa (e' QUI, non in `import_runs`: candidati,
 *                                          validazioni e decisioni hanno la FK su questa);
 *   · `sys.sys_seed_candidate_records`  — una persona candidata per riga atterrata;
 *   · `sys.sys_seed_validation_results` — le regole applicate, una per una, col loro nome.
 *
 * Nessun contenitore nuovo oltre la tabella di atterraggio: e' il reperto della specifica
 * («quasi tutto cio' che serve esiste gia'»), verificato tabella per tabella prima di scrivere.
 */
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  TENANT_IMPORT_ROW_COLUMNS,
  type E19Esito,
  type TenantImportCandidate,
  type TenantImportReferto,
  type TenantImportRow,
  type TenantImportRun,
  type TenantImportRunListQuery,
  type TenantImportRunStatus,
  type TenantImportSource,
  type TenantImportValidation,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/** Il marchio nel `metadata` della corsa: e' cosi' che una corsa di P4 si distingue dalle altre. */
export const TENANT_IMPORT_KIND = "TENANT_IMPORT";
/** Il dominio dei candidati di P4 in `sys_seed_candidate_records`. */
export const TENANT_IMPORT_DOMAIN = "TENANT_PERSON";

// ---------------------------------------------------------------------------
// La fonte (T3)
// ---------------------------------------------------------------------------

/**
 * L'impronta del contenuto: sha-256 della serializzazione CANONICA delle righe — colonne
 * nell'ordine dichiarato dal contratto, valori assenti resi come null, spazi esterni tolti.
 * Due estrazioni con le stesse righe hanno la stessa impronta, qualunque nome portino e in
 * qualunque ordine le colonne siano arrivate. E' la ragione per cui si registra per impronta.
 */
export function improntaRighe(rows: readonly TenantImportRow[]): { hash: string; bytes: number } {
  const canoniche = rows.map((r) =>
    TENANT_IMPORT_ROW_COLUMNS.map((c) => {
      const v = r[c];
      return v == null ? null : String(v).trim();
    }),
  );
  const testo = JSON.stringify(canoniche);
  return { hash: createHash("sha256").update(testo, "utf8").digest("hex"), bytes: Buffer.byteLength(testo, "utf8") };
}

interface SourceRow {
  source_export_id: string;
  source_export_name: string;
  source_export_file_hash: string;
  source_export_retrieved_at: Date;
  source_export_size_bytes: string | number | null;
  source_export_status: TenantImportSource["status"];
  row_count: string;
}

const SOURCE_COLS = `s.source_export_id, s.source_export_name, s.source_export_file_hash, s.source_export_retrieved_at,
  s.source_export_size_bytes, s.source_export_status,
  (SELECT count(*)::text FROM staging.tenant_import_people p WHERE p.tenant_import_person_export_id = s.source_export_id) AS row_count`;

function toSource(r: SourceRow): TenantImportSource {
  return {
    sourceExportId: r.source_export_id,
    name: r.source_export_name,
    fileHash: r.source_export_file_hash,
    retrievedAt: r.source_export_retrieved_at.toISOString(),
    sizeBytes: Number(r.source_export_size_bytes ?? 0),
    status: r.source_export_status,
    rowCount: Number(r.row_count),
  };
}

export async function findSourceByHash(db: DbConnector, hash: string): Promise<TenantImportSource | null> {
  const r = await db.query<SourceRow>(
    `SELECT ${SOURCE_COLS} FROM reference_sync.source_exports s WHERE s.source_export_file_hash = $1`, [hash],
  );
  return r.rows[0] ? toSource(r.rows[0]) : null;
}

export async function findSourceById(db: DbConnector, id: string): Promise<TenantImportSource | null> {
  const r = await db.query<SourceRow>(
    `SELECT ${SOURCE_COLS} FROM reference_sync.source_exports s WHERE s.source_export_id = $1`, [id],
  );
  return r.rows[0] ? toSource(r.rows[0]) : null;
}

export async function sourceNameTaken(db: DbConnector, name: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM reference_sync.source_exports WHERE source_export_name = $1`, [name]);
  return (r.rowCount ?? 0) > 0;
}

/** Registra la fonte E fa atterrare le righe, nella stessa transazione: una fonte senza righe non esiste. */
export async function insertSourceWithRows(
  client: PoolClient,
  input: { name: string; hash: string; bytes: number; rows: readonly TenantImportRow[]; metadata: Record<string, unknown>; registeredBy: string },
): Promise<TenantImportSource> {
  const ins = await client.query<{ source_export_id: string }>(
    `INSERT INTO reference_sync.source_exports
       (source_export_name, source_export_file_hash, source_export_retrieved_at, source_export_size_bytes,
        source_export_status, source_export_metadata)
     VALUES ($1, $2, now(), $3, 'AVAILABLE', $4::jsonb)
     RETURNING source_export_id`,
    [input.name, input.hash, input.bytes, JSON.stringify({
      ...input.metadata, kind: TENANT_IMPORT_KIND, rowCount: input.rows.length,
      columns: TENANT_IMPORT_ROW_COLUMNS, registeredBy: input.registeredBy,
    })],
  );
  const id = ins.rows[0]!.source_export_id;

  // L'atterraggio: un INSERT set-based, colonna per colonna, TUTTO come testo. Nessuna
  // conversione qui — e' la regola di T2, e la prova e' che '31/02/2024' entra.
  const cols = TENANT_IMPORT_ROW_COLUMNS;
  const rowNos = input.rows.map((_, i) => i + 1);
  const colonne = cols.map((c) => input.rows.map((r) => (r[c] == null ? null : String(r[c]))));
  const params: unknown[] = [id, rowNos, ...colonne];
  const unnest = cols.map((_, i) => `$${i + 3}::text[]`).join(", ");
  const nomi = cols.map((_, i) => `c${i}`);
  await client.query(
    `INSERT INTO staging.tenant_import_people
       (tenant_import_person_export_id, tenant_import_person_row_no, ${cols.join(", ")})
     SELECT $1, t.row_no, ${nomi.map((n) => `t.${n}`).join(", ")}
       FROM unnest($2::int[], ${unnest}) AS t(row_no, ${nomi.join(", ")})`,
    params,
  );

  const s = await findSourceById(client, id);
  if (!s) throw new Error("fonte appena registrata e gia' introvabile");
  return s;
}

export interface RigaAtterrata extends TenantImportRow {
  rowNo: number;
}

export async function loadRows(db: DbConnector, sourceExportId: string): Promise<RigaAtterrata[]> {
  const cols = TENANT_IMPORT_ROW_COLUMNS.join(", ");
  const r = await db.query<Record<string, string | null> & { tenant_import_person_row_no: number }>(
    `SELECT tenant_import_person_row_no, ${cols}
       FROM staging.tenant_import_people
      WHERE tenant_import_person_export_id = $1
      ORDER BY tenant_import_person_row_no`,
    [sourceExportId],
  );
  return r.rows.map((row) => {
    const out: Record<string, unknown> = { rowNo: row.tenant_import_person_row_no };
    for (const c of TENANT_IMPORT_ROW_COLUMNS) out[c] = row[c] ?? null;
    return out as unknown as RigaAtterrata;
  });
}

// ---------------------------------------------------------------------------
// La corsa (T1: e' una sys_seed_acquisition_runs)
// ---------------------------------------------------------------------------

interface RunRow {
  seed_acquisition_run_id: string;
  seed_acquisition_run_tenant_id: string;
  seed_acquisition_run_code: string;
  seed_acquisition_run_started_at: Date;
  seed_acquisition_run_finished_at: Date | null;
  seed_acquisition_run_status: TenantImportRunStatus;
  seed_acquisition_run_metadata: Record<string, unknown>;
  approval_request_id: string | null;
  n_persone: string; n_ammesse: string; n_scost: string; n_cieche: string; n_escluse: string;
}

const RUN_COLS = `r.seed_acquisition_run_id, r.seed_acquisition_run_tenant_id, r.seed_acquisition_run_code,
  r.seed_acquisition_run_started_at, r.seed_acquisition_run_finished_at, r.seed_acquisition_run_status,
  r.seed_acquisition_run_metadata,
  (SELECT a.approval_request_id FROM sys.sys_approval_requests a
    WHERE a.approval_request_resource_type = 'TENANT_IMPORT_RUN' AND a.approval_request_resource_id = r.seed_acquisition_run_id
    ORDER BY a.created_at DESC LIMIT 1) AS approval_request_id,
  (SELECT count(*)::text FROM sys.sys_seed_candidate_records c WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id) AS n_persone,
  (SELECT count(*)::text FROM sys.sys_seed_candidate_records c WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id
     AND c.seed_candidate_record_validation_status <> 'FAILED' AND c.seed_candidate_record_payload->>'e19' = 'AMMESSA') AS n_ammesse,
  (SELECT count(*)::text FROM sys.sys_seed_candidate_records c WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id
     AND c.seed_candidate_record_validation_status <> 'FAILED' AND c.seed_candidate_record_payload->>'e19' = 'AMMESSA_CON_SCOSTAMENTO') AS n_scost,
  (SELECT count(*)::text FROM sys.sys_seed_candidate_records c WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id
     AND c.seed_candidate_record_validation_status <> 'FAILED' AND c.seed_candidate_record_payload->>'e19' = 'CIECA') AS n_cieche,
  (SELECT count(*)::text FROM sys.sys_seed_candidate_records c WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id
     AND c.seed_candidate_record_validation_status = 'FAILED') AS n_escluse`;

const RUN_WHERE_KIND = `r.seed_acquisition_run_metadata->>'kind' = '${TENANT_IMPORT_KIND}'`;

function toRun(r: RunRow): TenantImportRun {
  const referto: TenantImportReferto = {
    persone: Number(r.n_persone), ammesse: Number(r.n_ammesse), conScostamento: Number(r.n_scost),
    cieche: Number(r.n_cieche), escluse: Number(r.n_escluse),
  };
  return {
    runId: r.seed_acquisition_run_id,
    tenantId: r.seed_acquisition_run_tenant_id,
    code: r.seed_acquisition_run_code,
    sourceExportId: String(r.seed_acquisition_run_metadata["sourceExportId"] ?? ""),
    status: r.seed_acquisition_run_status,
    startedAt: r.seed_acquisition_run_started_at.toISOString(),
    finishedAt: r.seed_acquisition_run_finished_at ? r.seed_acquisition_run_finished_at.toISOString() : null,
    referto,
    approvalRequestId: r.approval_request_id,
    metadata: r.seed_acquisition_run_metadata,
  };
}

export async function findRunById(db: DbConnector, id: string): Promise<TenantImportRun | null> {
  const r = await db.query<RunRow>(
    `SELECT ${RUN_COLS} FROM sys.sys_seed_acquisition_runs r WHERE r.seed_acquisition_run_id = $1 AND ${RUN_WHERE_KIND}`, [id],
  );
  return r.rows[0] ? toRun(r.rows[0]) : null;
}

export async function listRuns(
  db: DbConnector, filter: { tenantId?: string; query: TenantImportRunListQuery },
): Promise<{ items: TenantImportRun[]; total: number }> {
  const where: string[] = [RUN_WHERE_KIND]; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`r.seed_acquisition_run_tenant_id = $${params.length}`); }
  if (filter.query.status) { params.push(filter.query.status); where.push(`r.seed_acquisition_run_status = $${params.length}`); }
  const w = `WHERE ${where.join(" AND ")}`;
  const tr = await db.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_seed_acquisition_runs r ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await db.query<RunRow>(
    `SELECT ${RUN_COLS} FROM sys.sys_seed_acquisition_runs r ${w}
      ORDER BY r.seed_acquisition_run_started_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRun), total: Number(tr.rows[0]?.total ?? 0) };
}

/** Una corsa ancora RUNNING sulla stessa fonte: non se ne apre una seconda finche' la prima non e' decisa. */
export async function findRunInFlightForSource(db: DbConnector, sourceExportId: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT r.seed_acquisition_run_id AS id FROM sys.sys_seed_acquisition_runs r
      WHERE ${RUN_WHERE_KIND} AND r.seed_acquisition_run_metadata->>'sourceExportId' = $1
        AND r.seed_acquisition_run_status = 'RUNNING' LIMIT 1`,
    [sourceExportId],
  );
  return r.rows[0]?.id ?? null;
}

export async function insertRun(
  client: PoolClient,
  input: { tenantId: string; code: string; source: TenantImportSource; createdBy: string },
): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_seed_acquisition_runs
       (seed_acquisition_run_tenant_id, seed_acquisition_run_code, seed_acquisition_run_source_registry_payload,
        seed_acquisition_run_status, seed_acquisition_run_metadata, created_by)
     VALUES ($1, $2, $3::jsonb, 'RUNNING', $4::jsonb, $5)
     RETURNING seed_acquisition_run_id AS id`,
    [input.tenantId, input.code,
     JSON.stringify([{ sourceExportId: input.source.sourceExportId, name: input.source.name, fileHash: input.source.fileHash }]),
     JSON.stringify({ kind: TENANT_IMPORT_KIND, sourceExportId: input.source.sourceExportId, tenantId: input.tenantId }),
     input.createdBy],
  );
  return r.rows[0]!.id;
}

export async function insertCandidate(
  client: PoolClient,
  input: {
    runId: string; tenantId: string; naturalKey: string; rowNo: number; riga: TenantImportRow;
    email: string | null; positionId: string | null; positionCode: string | null; e19: E19Esito | null;
    hireDate: string | null; placeholderUserId: string | null; status: "PASSED" | "WARNING" | "FAILED";
    validations: readonly TenantImportValidation[];
  },
): Promise<string> {
  const c = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_seed_candidate_records
       (seed_candidate_record_run_id, seed_candidate_record_tenant_id, seed_candidate_record_domain,
        seed_candidate_record_natural_key, seed_candidate_record_payload, seed_candidate_record_validation_status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING seed_candidate_record_id AS id`,
    [input.runId, input.tenantId, TENANT_IMPORT_DOMAIN, input.naturalKey, JSON.stringify({
      rowNo: input.rowNo, riga: input.riga, email: input.email, positionId: input.positionId,
      positionCode: input.positionCode, e19: input.e19, hireDate: input.hireDate, placeholderUserId: input.placeholderUserId,
    }), input.status],
  );
  const id = c.rows[0]!.id;
  if (input.validations.length > 0) {
    await client.query(
      `INSERT INTO sys.sys_seed_validation_results
         (seed_validation_result_candidate_id, seed_validation_result_rule_code, seed_validation_result_status,
          seed_validation_result_message, seed_validation_result_payload)
       SELECT $1, t.rule, t.status, t.msg, t.payload::jsonb
         FROM unnest($2::varchar[], $3::varchar[], $4::text[], $5::text[]) AS t(rule, status, msg, payload)`,
      [id, input.validations.map((v) => v.ruleCode), input.validations.map((v) => v.status),
       input.validations.map((v) => v.message), input.validations.map((v) => JSON.stringify(v.payload))],
    );
  }
  return id;
}

interface CandidateRow {
  seed_candidate_record_id: string;
  seed_candidate_record_natural_key: string;
  seed_candidate_record_payload: Record<string, unknown>;
  seed_candidate_record_validation_status: string;
  validations: TenantImportValidation[] | null;
}

export async function loadCandidates(db: DbConnector, runId: string): Promise<TenantImportCandidate[]> {
  const r = await db.query<CandidateRow>(
    `SELECT c.seed_candidate_record_id, c.seed_candidate_record_natural_key, c.seed_candidate_record_payload,
            c.seed_candidate_record_validation_status,
            (SELECT json_agg(json_build_object('ruleCode', v.seed_validation_result_rule_code, 'status', v.seed_validation_result_status,
                                               'message', v.seed_validation_result_message, 'payload', v.seed_validation_result_payload)
                             ORDER BY v.created_at, v.seed_validation_result_rule_code)
               FROM sys.sys_seed_validation_results v WHERE v.seed_validation_result_candidate_id = c.seed_candidate_record_id) AS validations
       FROM sys.sys_seed_candidate_records c
      WHERE c.seed_candidate_record_run_id = $1
      ORDER BY (c.seed_candidate_record_payload->>'rowNo')::int`,
    [runId],
  );
  return r.rows.map((row) => {
    const p = row.seed_candidate_record_payload;
    const riga = (p["riga"] ?? {}) as TenantImportRow;
    const nome = [riga.first_name, riga.last_name].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
    return {
      candidateId: row.seed_candidate_record_id,
      rowNo: Number(p["rowNo"] ?? 0),
      naturalKey: row.seed_candidate_record_natural_key,
      email: (p["email"] as string | null) ?? null,
      displayName: nome || null,
      positionCode: (p["positionCode"] as string | null) ?? null,
      positionId: (p["positionId"] as string | null) ?? null,
      status: row.seed_candidate_record_validation_status,
      e19: (p["e19"] as E19Esito | null) ?? null,
      validations: row.validations ?? [],
    };
  });
}

/** Chi puo' firmare una corsa: i detentori di `seed_acquisition:approve`, nel tenant indicato. */
export async function findApproversInTenant(db: DbConnector, tenantId: string): Promise<string[]> {
  const r = await db.query<{ user_id: string }>(
    `SELECT DISTINCT u.user_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'seed_acquisition:approve'
        AND u.user_status = 'ACTIVE' AND u.user_tenant_id = $1
      ORDER BY u.user_id`,
    [tenantId],
  );
  return r.rows.map((x) => x.user_id);
}

/** Il tenant di piattaforma: dove vivono i PLATFORM_ADMIN, cioe' chi firma quando l'azienda nuova non ha ancora nessuno. */
export async function platformTenantId(db: DbConnector): Promise<string | null> {
  const r = await db.query<{ tenant_id: string }>(
    `SELECT DISTINCT u.user_tenant_id AS tenant_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL
      LIMIT 1`,
  );
  return r.rows[0]?.tenant_id ?? null;
}

export async function tenantStatus(db: DbConnector, tenantId: string): Promise<string | null> {
  const r = await db.query<{ tenant_status: string }>(`SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
  return r.rows[0]?.tenant_status ?? null;
}
