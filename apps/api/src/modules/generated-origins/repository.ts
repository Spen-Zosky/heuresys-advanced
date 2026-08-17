/**
 * apps/api/src/modules/generated-origins/repository.ts — SQL parametrizzato grezzo sul
 * registro dell'origine (#198 T6). Sola lettura: qui non si scrive mai.
 *
 * Chi scrive è l'atto di applicazione (`approvals/effects/tenant-blueprint-application.ts`),
 * dentro la stessa transazione che crea le righe. Separare la scrittura dalla lettura non è
 * pulizia formale: se una rotta potesse inserire origini, il registro smetterebbe di essere
 * la conseguenza di una costruzione e diventerebbe un'affermazione che qualcuno può fare.
 */
import type { Pool } from "pg";
import type {
  GeneratedOrigin,
  GeneratedOriginListQuery,
  GeneratedOriginSummaryResponse,
} from "@heuresys/shared";

type Db = Pool;

interface Riga {
  generated_record_origin_id: string;
  generated_record_origin_tenant_id: string;
  generated_record_origin_target_table: string;
  generated_record_origin_target_record_id: string;
  generated_record_origin_blueprint_version_id: string;
  generated_record_origin_status: string;
  generated_record_origin_superseded_by_run_id: string | null;
  generated_record_origin_status_changed_at: Date | null;
  justification: string | null;
  created_at: Date;
}

function mappa(r: Riga): GeneratedOrigin {
  return {
    generatedRecordOriginId: r.generated_record_origin_id,
    tenantId: r.generated_record_origin_tenant_id,
    targetTable: r.generated_record_origin_target_table,
    targetRecordId: r.generated_record_origin_target_record_id,
    blueprintVersionId: r.generated_record_origin_blueprint_version_id,
    status: r.generated_record_origin_status as GeneratedOrigin["status"],
    supersededByRunId: r.generated_record_origin_superseded_by_run_id,
    statusChangedAt: r.generated_record_origin_status_changed_at?.toISOString() ?? null,
    justification: r.justification,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * Il filtro di tenant arriva dal service ed è `undefined` solo per un attore di
 * piattaforma. Resta un parametro `$n`, mai interpolato.
 */
export async function listOrigins(
  db: Db,
  tenantFilter: string | undefined,
  q: GeneratedOriginListQuery,
): Promise<{ items: GeneratedOrigin[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const push = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("$?", `$${params.length}`));
  };

  if (tenantFilter) push("generated_record_origin_tenant_id = $?", tenantFilter);
  else if (q.tenantId) push("generated_record_origin_tenant_id = $?", q.tenantId);
  if (q.targetTable) push("generated_record_origin_target_table = $?", q.targetTable);
  if (q.blueprintVersionId) push("generated_record_origin_blueprint_version_id = $?", q.blueprintVersionId);
  if (q.status) push("generated_record_origin_status = $?", q.status);

  const filtro = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const conta = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_generated_record_origins ${filtro}`,
    params,
  );
  const righe = await db.query<Riga>(
    `SELECT generated_record_origin_id, generated_record_origin_tenant_id,
            generated_record_origin_target_table, generated_record_origin_target_record_id,
            generated_record_origin_blueprint_version_id, generated_record_origin_status,
            generated_record_origin_superseded_by_run_id, generated_record_origin_status_changed_at,
            generated_record_origin_metadata->>'justification' AS justification,
            created_at
       FROM sys.sys_generated_record_origins
       ${filtro}
      ORDER BY created_at DESC, generated_record_origin_target_table
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, q.offset],
  );
  return { items: righe.rows.map(mappa), total: Number(conta.rows[0]!.n) };
}

/** I conteggi per tabella e per stato — la risposta a «quanto di questa azienda è inventato». */
export async function summarize(
  db: Db,
  tenantFilter: string | undefined,
  tenantId?: string,
  blueprintVersionId?: string,
): Promise<GeneratedOriginSummaryResponse> {
  const where: string[] = [];
  const params: unknown[] = [];
  const push = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("$?", `$${params.length}`));
  };
  if (tenantFilter) push("generated_record_origin_tenant_id = $?", tenantFilter);
  else if (tenantId) push("generated_record_origin_tenant_id = $?", tenantId);
  if (blueprintVersionId) push("generated_record_origin_blueprint_version_id = $?", blueprintVersionId);
  const filtro = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const r = await db.query<{ tab: string; generated: string; confirmed: string; superseded: string; tot: string }>(
    `SELECT generated_record_origin_target_table AS tab,
            count(*) FILTER (WHERE generated_record_origin_status = 'GENERATED')::text  AS generated,
            count(*) FILTER (WHERE generated_record_origin_status = 'CONFIRMED')::text  AS confirmed,
            count(*) FILTER (WHERE generated_record_origin_status = 'SUPERSEDED')::text AS superseded,
            count(*)::text AS tot
       FROM sys.sys_generated_record_origins
       ${filtro}
      GROUP BY 1 ORDER BY 1`,
    params,
  );
  const byTable = r.rows.map((x) => ({
    targetTable: x.tab,
    generated: Number(x.generated),
    confirmed: Number(x.confirmed),
    superseded: Number(x.superseded),
    total: Number(x.tot),
  }));
  return {
    byTable,
    totals: {
      generated: byTable.reduce((n, x) => n + x.generated, 0),
      confirmed: byTable.reduce((n, x) => n + x.confirmed, 0),
      superseded: byTable.reduce((n, x) => n + x.superseded, 0),
      total: byTable.reduce((n, x) => n + x.total, 0),
    },
  };
}
