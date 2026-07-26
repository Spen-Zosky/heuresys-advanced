/**
 * apps/api/src/modules/gdpr/repository.ts
 * D-14 F3/F4 — data access for the GDPR tooling.
 *
 * The classification registry (sys.sys_gdpr_data_map, seeded by migration
 * 000186) DRIVES every operation: export walks it, erasure applies its
 * per-table strategy, the retention sweep applies its windows. Table/column
 * identifiers come from the registry and are still (a) validated against a
 * strict identifier regex and (b) verified to exist in information_schema
 * before being interpolated — parameterized SQL cannot carry identifiers, so
 * this is the defence for the dynamic part. All VALUES remain $n-parameterized.
 */
import type { Pool, PoolClient } from "pg";
import type { GdprDataMapEntry } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

export function assertSafeIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`unsafe SQL identifier from data map: ${JSON.stringify(name)}`);
  }
  return name;
}

interface RawMapRow {
  gdpr_map_table_schema: string;
  gdpr_map_table_name: string;
  gdpr_map_subject_fk: string;
  gdpr_map_data_class: GdprDataMapEntry["dataClass"];
  gdpr_map_erasure_strategy: GdprDataMapEntry["erasureStrategy"];
  gdpr_map_reference_kind: GdprDataMapEntry["referenceKind"];
  gdpr_map_retention_days: number | null;
  gdpr_map_age_column: string | null;
  gdpr_map_legal_basis: string | null;
}

export async function listDataMap(q: DbConnector): Promise<GdprDataMapEntry[]> {
  const res = await q.query<RawMapRow>(
    `SELECT gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
            gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
            gdpr_map_retention_days, gdpr_map_age_column, gdpr_map_legal_basis
       FROM sys.sys_gdpr_data_map
      ORDER BY gdpr_map_table_name, gdpr_map_subject_fk`,
  );
  return res.rows.map((r) => ({
    tableSchema: r.gdpr_map_table_schema,
    tableName: r.gdpr_map_table_name,
    subjectFkColumn: r.gdpr_map_subject_fk,
    dataClass: r.gdpr_map_data_class,
    erasureStrategy: r.gdpr_map_erasure_strategy,
    referenceKind: r.gdpr_map_reference_kind,
    retentionDays: r.gdpr_map_retention_days,
    ageColumn: r.gdpr_map_age_column,
    legalBasis: r.gdpr_map_legal_basis,
  }));
}

/** Z-259 — every person id in the system. The export needs it because the fk
 *  graph is NOT a complete account of which columns name a person: some carry a
 *  user id with no foreign key declared at all (measured: sys_user_skills.
 *  created_by leaked past the structural projection precisely this way). Values
 *  are the only source that has no blind spot here. */
async function allPersonIds(q: DbConnector): Promise<Set<string>> {
  const res = await q.query<{ user_id: string }>(`SELECT user_id FROM sys.sys_users`);
  return new Set(res.rows.map((r) => r.user_id));
}

/** Z-259 — every column that points at ANOTHER person, per table, derived LIVE
 *  from the fk graph (never a name pattern: that is anti-pattern AP-03).
 *  Keyed "schema.table" → set of column names referencing sys_users.
 *  Structural half of the projection: it withholds a person-column even when
 *  its value is NULL, keeping the bundle's shape uniform. */
async function personColumnsByTable(q: DbConnector): Promise<Map<string, Set<string>>> {
  const res = await q.query<{ tbl: string; col: string }>(
    `SELECT n.nspname || '.' || c.relname AS tbl, a.attname AS col
       FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN LATERAL unnest(k.conkey) ck ON true
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ck
      WHERE k.contype = 'f' AND k.confrelid = 'sys.sys_users'::regclass`,
  );
  const out = new Map<string, Set<string>>();
  for (const r of res.rows) {
    let s = out.get(r.tbl);
    if (!s) {
      s = new Set<string>();
      out.set(r.tbl, s);
    }
    s.add(r.col);
  }
  return out;
}

/** Registry rows whose (schema, table, columns) all exist in information_schema.
 *  A registry row pointing at a missing table is a FATAL inconsistency (the
 *  anti-drift test enforces it; fail loud rather than silently skipping). */
export async function verifyDataMap(q: DbConnector, entries: GdprDataMapEntry[]): Promise<void> {
  for (const e of entries) {
    assertSafeIdent(e.tableSchema);
    assertSafeIdent(e.tableName);
    assertSafeIdent(e.subjectFkColumn);
    if (e.ageColumn) assertSafeIdent(e.ageColumn);
    const res = await q.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
       ) AS ok`,
      [e.tableSchema, e.tableName, e.subjectFkColumn],
    );
    if (!res.rows[0]?.ok) {
      throw new Error(
        `GDPR data map inconsistency: ${e.tableSchema}.${e.tableName}.${e.subjectFkColumn} does not exist`,
      );
    }
  }
}

function entryKey(e: GdprDataMapEntry): string {
  return `${e.tableSchema}.${e.tableName}.${e.subjectFkColumn}`;
}

export interface ExportedTable {
  dataClass: GdprDataMapEntry["dataClass"];
  subjectFkColumn: string;
  rowCount: number;
  rows: Record<string, unknown>[];
  /** Columns withheld because they identify another person (Art. 15(4)). */
  omittedColumns?: string[];
}

/** Art. 15/20 export: every registry table, SELECT * WHERE subject = $1.
 *
 *  Z-259 — two distinct guards keep third parties out of the bundle, because
 *  "the requester appears in this row" and "this row is about the requester"
 *  are not the same statement:
 *
 *  (a) SELECTION. Registry rows marked ACTOR are skipped entirely: there the
 *      person is the author of someone else's record. Measured before the fix:
 *      a plain USER got 8 whole 360-feedback rows about 8 different colleagues,
 *      plus 4 continuous-feedback rows, simply by asking for their own data.
 *
 *  (b) PROJECTION. Even a legitimately-exported row may carry OTHER columns
 *      pointing at sys_users, and those name a third party. The 360 case is the
 *      sharp one: exporting a review to its subject would disclose WHO wrote
 *      it, defeating reviewer confidentiality. Such columns are dropped from
 *      the payload and listed in `omittedColumns`, so the withholding is
 *      declared to the data subject rather than silent.
 *
 *  The set of person-columns is derived from the fk graph, never from a naming
 *  convention — a name-anchored predicate is exactly what made the coverage
 *  gate blind (AP-03). */
export async function exportSubjectData(
  q: DbConnector,
  entries: GdprDataMapEntry[],
  userId: string,
): Promise<Record<string, ExportedTable>> {
  const out: Record<string, ExportedTable> = {};
  const personCols = await personColumnsByTable(q);
  const personIds = await allPersonIds(q);
  for (const e of entries) {
    if (e.referenceKind === "ACTOR") continue; // (a) not the subject's data
    const schema = assertSafeIdent(e.tableSchema);
    const table = assertSafeIdent(e.tableName);
    const col = assertSafeIdent(e.subjectFkColumn);
    const res = await q.query<Record<string, unknown>>(
      `SELECT * FROM "${schema}"."${table}" WHERE "${col}" = $1`,
      [userId],
    );
    // (b) projection, in two layers because neither alone is complete:
    //   structural — every fk-to-person column of this table bar the one we
    //   selected on, withheld even when NULL so the shape stays uniform;
    //   by value  — any cell holding SOMEONE ELSE's user id, which catches the
    //   columns that carry a person without declaring a foreign key.
    const structural = [...(personCols.get(`${schema}.${table}`) ?? [])].filter((c) => c !== col);
    const omitted = new Set<string>(structural);
    const rows = res.rows.map((r) => {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (structural.includes(k)) continue;
        if (typeof v === "string" && v !== userId && personIds.has(v)) {
          omitted.add(k);
          continue;
        }
        copy[k] = v;
      }
      return copy;
    });
    const omit = [...omitted].sort();
    out[entryKey(e)] = {
      dataClass: e.dataClass,
      subjectFkColumn: e.subjectFkColumn,
      rowCount: res.rowCount ?? res.rows.length,
      rows,
      ...(omit.length > 0 ? { omittedColumns: omit } : {}),
    };
  }
  return out;
}

export interface ErasureTableOutcome {
  strategy: GdprDataMapEntry["erasureStrategy"];
  dataClass: GdprDataMapEntry["dataClass"];
  affectedRows: number;
  legalBasis: string | null;
}

/** Art. 17 erasure per registry strategy. dryRun counts without mutating.
 *  DELETE  → rows removed; RETAIN → rows counted + legal basis reported;
 *  ANONYMIZE (sys_users root) → handled by anonymizeRootUser below. */
export async function eraseSubjectData(
  q: DbConnector,
  entries: GdprDataMapEntry[],
  userId: string,
  dryRun: boolean,
): Promise<Record<string, ErasureTableOutcome>> {
  const out: Record<string, ErasureTableOutcome> = {};
  for (const e of entries) {
    const schema = assertSafeIdent(e.tableSchema);
    const table = assertSafeIdent(e.tableName);
    const col = assertSafeIdent(e.subjectFkColumn);
    let affected = 0;
    if (e.erasureStrategy === "DELETE" && !dryRun) {
      const res = await q.query(`DELETE FROM "${schema}"."${table}" WHERE "${col}" = $1`, [userId]);
      affected = res.rowCount ?? 0;
    } else {
      const res = await q.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${schema}"."${table}" WHERE "${col}" = $1`,
        [userId],
      );
      affected = res.rows[0]?.n ?? 0;
    }
    out[entryKey(e)] = {
      strategy: e.erasureStrategy,
      dataClass: e.dataClass,
      affectedRows: affected,
      legalBasis: e.legalBasis,
    };
  }
  return out;
}

/** ANONYMIZE the sys_users root row (hard delete would CASCADE into the
 *  legally-retained children). Deterministic replacement values keyed on the
 *  uuid keep the row unique and clearly marked. */
export async function anonymizeRootUser(q: DbConnector, userId: string): Promise<void> {
  await q.query(
    `UPDATE sys.sys_users
        SET user_email        = 'erased+' || user_id || '@erased.invalid',
            user_display_name = 'ERASED',
            user_first_name   = NULL,
            user_last_name    = NULL,
            user_external_code = NULL,
            user_metadata     = '{}'::jsonb,
            user_status       = 'DEACTIVATED',
            updated_at        = now()
      WHERE user_id = $1`,
    [userId],
  );
}

export interface RetentionTableOutcome {
  retentionDays: number;
  ageColumn: string;
  affectedRows: number;
}

/** F4 retention sweep: rows older than the registry window are deleted
 *  (dryRun counts). Applies to every entry with a retention window, e.g.
 *  auth_login_events 400d (D-59), password-reset/OTP 30d, refresh tokens 90d. */
export async function runRetention(
  q: DbConnector,
  entries: GdprDataMapEntry[],
  dryRun: boolean,
): Promise<Record<string, RetentionTableOutcome>> {
  const out: Record<string, RetentionTableOutcome> = {};
  for (const e of entries) {
    if (e.retentionDays == null || !e.ageColumn) continue;
    const schema = assertSafeIdent(e.tableSchema);
    const table = assertSafeIdent(e.tableName);
    const ageCol = assertSafeIdent(e.ageColumn);
    let affected = 0;
    if (dryRun) {
      const res = await q.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${schema}"."${table}"
          WHERE "${ageCol}" < now() - make_interval(days => $1)`,
        [e.retentionDays],
      );
      affected = res.rows[0]?.n ?? 0;
    } else {
      const res = await q.query(
        `DELETE FROM "${schema}"."${table}"
          WHERE "${ageCol}" < now() - make_interval(days => $1)`,
        [e.retentionDays],
      );
      affected = res.rowCount ?? 0;
    }
    out[`${e.tableSchema}.${e.tableName}`] = {
      retentionDays: e.retentionDays,
      ageColumn: e.ageColumn,
      affectedRows: affected,
    };
  }
  return out;
}

/* --- DSR accountability log --------------------------------------------- */

export async function logGdprRequest(
  q: DbConnector,
  params: {
    tenantId: string | null;
    subjectUserId: string | null;
    type: "EXPORT" | "ERASURE" | "RETENTION_RUN";
    status: "COMPLETED" | "DRY_RUN";
    requestedBy: string | null;
    report: unknown;
  },
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_gdpr_requests
       (gdpr_request_tenant_id, gdpr_request_subject_user_id, gdpr_request_type,
        gdpr_request_status, gdpr_request_requested_by, gdpr_request_report)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [params.tenantId, params.subjectUserId, params.type, params.status, params.requestedBy, JSON.stringify(params.report)],
  );
}

/* --- consents ------------------------------------------------------------ */

export async function insertConsentEvent(
  q: DbConnector,
  params: {
    tenantId: string;
    userId: string;
    purpose: string;
    action: "GRANT" | "REVOKE";
    source: "ESS" | "ADMIN";
    note: string | null;
  },
): Promise<{ occurredAt: string }> {
  const res = await q.query<{ consent_occurred_at: string }>(
    `INSERT INTO sys.sys_user_consents
       (consent_tenant_id, consent_user_id, consent_purpose, consent_action, consent_source, consent_note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING consent_occurred_at`,
    [params.tenantId, params.userId, params.purpose, params.action, params.source, params.note],
  );
  return { occurredAt: new Date(res.rows[0]!.consent_occurred_at as unknown as string).toISOString() };
}

/** Current consent state = latest event per purpose (append-only ledger). */
export async function getConsentState(
  q: DbConnector,
  userId: string,
): Promise<Map<string, { granted: boolean; lastChangedAt: string }>> {
  const res = await q.query<{ consent_purpose: string; consent_action: string; consent_occurred_at: string }>(
    `SELECT DISTINCT ON (consent_purpose)
            consent_purpose, consent_action, consent_occurred_at
       FROM sys.sys_user_consents
      WHERE consent_user_id = $1
      ORDER BY consent_purpose, consent_seq DESC`,
    [userId],
  );
  const out = new Map<string, { granted: boolean; lastChangedAt: string }>();
  for (const r of res.rows) {
    out.set(r.consent_purpose, {
      granted: r.consent_action === "GRANT",
      lastChangedAt: new Date(r.consent_occurred_at as unknown as string).toISOString(),
    });
  }
  return out;
}
