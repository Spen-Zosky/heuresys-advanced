/**
 * apps/api/src/modules/job-roles/repository.ts
 * Raw SQL for sys.sys_job_roles — un CATALOGO di piattaforma con, dal 2026-09-10 (ADR-0039,
 * mig. 000397), una colonna del cliente ANNULLABILE per le voci proprie: NULL = riga di
 * catalogo, valorizzata = voce che quel cliente si è creato. FK a sys_job_families.
 *
 * ⚠ La lettura non è più «tutto il catalogo». Passa dal PROFILO (lib/scope/profilo.ts): un
 * utente del cliente riceve le voci del proprio profilo più le proprie, chi amministra la
 * piattaforma riceve il catalogo intero. Prima di questa data `/v1/job-roles` restituiva a
 * chiunque tutti i 176 ruoli — compresi «pasticcere-confettiere» e «operatore di reattore
 * nucleare» a un responsabile HR di una banca.
 */

import type { Pool, PoolClient } from "pg";
import type {
  JobRole,
  JobRoleListQuery,
  CreateJobRoleBody,
  UpdateJobRoleBody,
} from "@heuresys/shared";
import type { PerimetroDiCatalogo } from "../../lib/scope/profilo.js";

export type DbConnector = Pool | PoolClient;

interface Row {
  job_role_id: string;
  // ADR-0015: nullable for legacy-imported job_roles lacking canonical family (CW-B26).
  job_role_family_id: string | null;
  job_role_code: string;
  job_role_name: string;
  job_role_description: string | null;
  job_role_seniority_level: string | null;
  job_role_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `job_role_id, job_role_family_id, job_role_code, job_role_name,
  job_role_description, job_role_seniority_level, job_role_metadata,
  created_at, updated_at`;

function toJr(r: Row): JobRole {
  return {
    jobRoleId: r.job_role_id,
    jobFamilyId: r.job_role_family_id,
    code: r.job_role_code,
    name: r.job_role_name,
    description: r.job_role_description,
    seniorityLevel: r.job_role_seniority_level as JobRole["seniorityLevel"],
    metadata: r.job_role_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listJobRoles(
  q: DbConnector,
  query: JobRoleListQuery,
  perimetro: PerimetroDiCatalogo,
): Promise<{ items: JobRole[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  // ADR-0039 regola 4 — il perimetro entra PRIMA di ogni altro filtro: il profilo del
  // cliente più le sue voci proprie, mai il catalogo intero.
  if (perimetro.tipo === "profilo") {
    params.push(perimetro.codici);
    const codici = params.length;
    if (perimetro.tenantId === null) {
      where.push(`job_role_code = ANY($${codici}::text[])`);
    } else {
      params.push(perimetro.tenantId);
      const tenant = params.length;
      where.push(`(job_role_code = ANY($${codici}::text[]) OR job_role_tenant_id = $${tenant})`);
    }
  }
  if (query.jobFamilyId) {
    params.push(query.jobFamilyId);
    where.push(`job_role_family_id = $${params.length}`);
  }
  if (query.seniorityLevel) {
    params.push(query.seniorityLevel);
    where.push(`job_role_seniority_level = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(job_role_name ILIKE $${params.length} OR job_role_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_job_roles ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_job_roles ${whereClause}
      ORDER BY job_role_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toJr), total };
}

export async function findJobRoleById(q: DbConnector, id: string): Promise<JobRole | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_job_roles WHERE job_role_id = $1`, [id]);
  return res.rows[0] ? toJr(res.rows[0]) : null;
}

/**
 * Come sopra, ma dentro il perimetro dell'attore. Serve perché un filtro applicato al solo
 * ELENCO si aggira chiedendo la riga per identificativo: chi ha visto un uuid una volta
 * continuerebbe a leggere il ruolo anche dopo che il profilo ha smesso di contenerlo.
 */
export async function findJobRoleInPerimeter(
  q: DbConnector,
  id: string,
  perimetro: PerimetroDiCatalogo,
): Promise<JobRole | null> {
  if (perimetro.tipo === "tutto") return findJobRoleById(q, id);
  const params: unknown[] = [id, perimetro.codici];
  let clausola = `job_role_code = ANY($2::text[])`;
  if (perimetro.tenantId !== null) {
    params.push(perimetro.tenantId);
    clausola = `(${clausola} OR job_role_tenant_id = $3)`;
  }
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_job_roles WHERE job_role_id = $1 AND ${clausola}`,
    params,
  );
  return res.rows[0] ? toJr(res.rows[0]) : null;
}

/**
 * Il doppione si cerca DENTRO lo stesso proprietario, perché è lì che l'unicità vive dal
 * 2026-09-10 (mig. 000397, `UNIQUE (COALESCE(tenant, zero), code)`): un cliente che si dà una
 * voce propria non collide con la voce omonima di un altro cliente, né con il catalogo.
 * Cercare il codice su tutta la tabella riporterebbe l'unicità globale nel codice dopo
 * averla tolta dallo schema — e sarebbe il tipo di divergenza che nessuno nota per mesi.
 */
export async function findJobRoleByCode(
  q: DbConnector,
  code: string,
  tenantId: string | null,
): Promise<JobRole | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_job_roles
      WHERE job_role_code = $1 AND job_role_tenant_id IS NOT DISTINCT FROM $2`,
    [code, tenantId],
  );
  return res.rows[0] ? toJr(res.rows[0]) : null;
}

export async function jobFamilyExists(q: DbConnector, familyId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_job_families WHERE job_family_id = $1`,
    [familyId],
  );
  return res.rows.length === 1;
}

export async function insertJobRole(
  q: DbConnector,
  body: CreateJobRoleBody,
  createdBy: string,
  /** ADR-0039 regola 3 — NULL crea una riga di CATALOGO, valorizzato una VOCE PROPRIA. */
  tenantId: string | null,
): Promise<JobRole> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_job_roles (
        job_role_family_id, job_role_code, job_role_name,
        job_role_description, job_role_seniority_level, job_role_metadata, created_by,
        job_role_tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      RETURNING ${COLS}`,
    [
      // ADR-0015: body.jobFamilyId is now nullable+optional; null when family unknown.
      body.jobFamilyId ?? null,
      body.code,
      body.name,
      body.description ?? null,
      body.seniorityLevel ?? null,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
      tenantId,
    ],
  );
  return toJr(res.rows[0]!);
}

export async function updateJobRolePartial(
  q: DbConnector,
  id: string,
  patch: UpdateJobRoleBody,
  updatedBy: string,
): Promise<JobRole | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.jobFamilyId !== undefined) addSet("job_role_family_id", patch.jobFamilyId);
  if (patch.name !== undefined) addSet("job_role_name", patch.name);
  if (patch.description !== undefined) addSet("job_role_description", patch.description);
  if (patch.seniorityLevel !== undefined) addSet("job_role_seniority_level", patch.seniorityLevel);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`job_role_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findJobRoleById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_job_roles SET ${sets.join(", ")}
      WHERE job_role_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toJr(res.rows[0]) : null;
}
