/**
 * apps/api/src/modules/tenant-blueprints/repository.ts
 * #131 Tenant Builder P1, T5 — SQL parametrizzato sulle quattro tabelle del
 * fascicolo. Nessun query builder: `$1, $2`, mai interpolazione.
 */
import type { Pool, PoolClient } from "pg";
import type {
  TenantBlueprint,
  TenantBlueprintVersion,
  ProcessDecision,
  BlueprintIdentity,
  TenantBlueprintListQuery,
  ProcessInclusion,
} from "@heuresys/shared";

export type Db = Pool | PoolClient;

/* ------------------------------------------------------------------ righe */

interface BlueprintRow {
  tenant_blueprint_id: string;
  tenant_blueprint_code: string;
  tenant_blueprint_name: string;
  tenant_blueprint_tenant_id: string | null;
  tenant_blueprint_status: string;
  tenant_blueprint_current_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface VersionRow {
  tenant_blueprint_version_id: string;
  tenant_blueprint_version_blueprint_id: string;
  tenant_blueprint_version_number: number;
  tenant_blueprint_version_status: string;
  tenant_blueprint_version_variant_version_id: string | null;
  tenant_blueprint_version_industry_class_id: string | null;
  tenant_blueprint_version_size_band_id: string | null;
  tenant_blueprint_version_operating_model_id: string | null;
  tenant_blueprint_version_regulatory_intensity: string | null;
  tenant_blueprint_version_country_code: string | null;
  tenant_blueprint_version_employee_count: number | null;
  tenant_blueprint_version_revenue_eur: string | null;
  tenant_blueprint_version_approved_at: Date | null;
  tenant_blueprint_version_applied_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DecisionRow {
  processId: string;
  processCode: string;
  processName: string;
  ordinal: number;
  inclusion: string | null;
  rationale: string | null;
}

const B_COLS = `tenant_blueprint_id, tenant_blueprint_code, tenant_blueprint_name,
  tenant_blueprint_tenant_id, tenant_blueprint_status, tenant_blueprint_current_version_id,
  created_at, updated_at`;

const V_COLS = `tenant_blueprint_version_id, tenant_blueprint_version_blueprint_id,
  tenant_blueprint_version_number, tenant_blueprint_version_status,
  tenant_blueprint_version_variant_version_id, tenant_blueprint_version_industry_class_id,
  tenant_blueprint_version_size_band_id, tenant_blueprint_version_operating_model_id,
  tenant_blueprint_version_regulatory_intensity, tenant_blueprint_version_country_code,
  tenant_blueprint_version_employee_count, tenant_blueprint_version_revenue_eur,
  tenant_blueprint_version_approved_at, tenant_blueprint_version_applied_at,
  created_at, updated_at`;

function toBlueprint(r: BlueprintRow): TenantBlueprint {
  return {
    tenantBlueprintId: r.tenant_blueprint_id,
    code: r.tenant_blueprint_code,
    name: r.tenant_blueprint_name,
    tenantId: r.tenant_blueprint_tenant_id,
    status: r.tenant_blueprint_status as TenantBlueprint["status"],
    currentVersionId: r.tenant_blueprint_current_version_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toVersion(r: VersionRow): TenantBlueprintVersion {
  return {
    tenantBlueprintVersionId: r.tenant_blueprint_version_id,
    blueprintId: r.tenant_blueprint_version_blueprint_id,
    number: r.tenant_blueprint_version_number,
    status: r.tenant_blueprint_version_status as TenantBlueprintVersion["status"],
    variantVersionId: r.tenant_blueprint_version_variant_version_id,
    identity: {
      industryClassId: r.tenant_blueprint_version_industry_class_id,
      sizeBandId: r.tenant_blueprint_version_size_band_id,
      operatingModelId: r.tenant_blueprint_version_operating_model_id,
      regulatoryIntensity:
        r.tenant_blueprint_version_regulatory_intensity as BlueprintIdentity["regulatoryIntensity"],
      countryCode: r.tenant_blueprint_version_country_code,
      employeeCount: r.tenant_blueprint_version_employee_count,
      // `numeric` torna come stringa dal driver: convertirlo qui evita che il
      // numero diventi testo nel contratto.
      revenueEur:
        r.tenant_blueprint_version_revenue_eur === null
          ? null
          : Number(r.tenant_blueprint_version_revenue_eur),
    },
    approvedAt: r.tenant_blueprint_version_approved_at?.toISOString() ?? null,
    appliedAt: r.tenant_blueprint_version_applied_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/* ------------------------------------------------------------- fascicoli */

export async function listBlueprints(
  db: Db,
  q: TenantBlueprintListQuery,
): Promise<{ items: TenantBlueprint[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.status) {
    params.push(q.status);
    where.push(`tenant_blueprint_status = $${params.length}`);
  }
  if (q.tenantId) {
    params.push(q.tenantId);
    where.push(`tenant_blueprint_tenant_id = $${params.length}`);
  }
  if (q.linked === "yes") where.push(`tenant_blueprint_tenant_id IS NOT NULL`);
  if (q.linked === "no") where.push(`tenant_blueprint_tenant_id IS NULL`);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const tot = await db.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_tenant_blueprints ${w}`,
    params,
  );
  params.push(q.limit);
  const lim = params.length;
  params.push(q.offset);
  const off = params.length;
  const res = await db.query<BlueprintRow>(
    `SELECT ${B_COLS} FROM sys.sys_tenant_blueprints ${w}
      ORDER BY tenant_blueprint_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toBlueprint), total: Number(tot.rows[0]?.total ?? 0) };
}

export async function findBlueprintById(db: Db, id: string): Promise<TenantBlueprint | null> {
  const r = await db.query<BlueprintRow>(
    `SELECT ${B_COLS} FROM sys.sys_tenant_blueprints WHERE tenant_blueprint_id = $1`,
    [id],
  );
  return r.rows[0] ? toBlueprint(r.rows[0]) : null;
}

export async function findBlueprintByCode(db: Db, code: string): Promise<TenantBlueprint | null> {
  const r = await db.query<BlueprintRow>(
    `SELECT ${B_COLS} FROM sys.sys_tenant_blueprints WHERE tenant_blueprint_code = $1`,
    [code],
  );
  return r.rows[0] ? toBlueprint(r.rows[0]) : null;
}

/**
 * Crea il fascicolo E la sua versione 1 nella stessa transazione: un fascicolo
 * senza versione aperta non e' componibile, e lasciarlo nascere cosi' vorrebbe
 * dire che ogni chiamante deve ricordarsi di aprirla.
 */
export async function insertBlueprint(
  client: PoolClient,
  input: { code: string; name: string; tenantId: string | null; actorUserId: string },
): Promise<TenantBlueprint> {
  const b = await client.query<BlueprintRow>(
    `INSERT INTO sys.sys_tenant_blueprints
       (tenant_blueprint_code, tenant_blueprint_name, tenant_blueprint_tenant_id,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING ${B_COLS}`,
    [input.code, input.name, input.tenantId, input.actorUserId],
  );
  const row = b.rows[0];
  if (!row) throw new Error("insertBlueprint: nessuna riga restituita");
  const v = await client.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, created_by, updated_by)
     VALUES ($1, 1, 'DRAFT', $2, $2)
     RETURNING tenant_blueprint_version_id AS id`,
    [row.tenant_blueprint_id, input.actorUserId],
  );
  await client.query(
    `UPDATE sys.sys_tenant_blueprints
        SET tenant_blueprint_current_version_id = $2, updated_by = $3
      WHERE tenant_blueprint_id = $1`,
    [row.tenant_blueprint_id, v.rows[0]?.id ?? null, input.actorUserId],
  );
  return { ...toBlueprint(row), currentVersionId: v.rows[0]?.id ?? null };
}

export async function updateBlueprint(
  db: Db,
  id: string,
  patch: { name?: string; status?: "ACTIVE" | "ARCHIVED" },
  actorUserId: string,
): Promise<TenantBlueprint | null> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (patch.name !== undefined) {
    params.push(patch.name);
    sets.push(`tenant_blueprint_name = $${params.length}`);
  }
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`tenant_blueprint_status = $${params.length}`);
  }
  if (sets.length === 0) return findBlueprintById(db, id);
  params.push(actorUserId);
  sets.push(`updated_by = $${params.length}`);
  const r = await db.query<BlueprintRow>(
    `UPDATE sys.sys_tenant_blueprints SET ${sets.join(", ")}
      WHERE tenant_blueprint_id = $1 RETURNING ${B_COLS}`,
    params,
  );
  return r.rows[0] ? toBlueprint(r.rows[0]) : null;
}

export async function linkTenant(
  db: Db,
  id: string,
  tenantId: string,
  actorUserId: string,
): Promise<TenantBlueprint | null> {
  // UPDATE guardato sullo stato atteso (E24, #199): il legame fascicolo↔azienda e'
  // PERMANENTE, quindi la firma vale solo su un fascicolo che non ne ha ancora una.
  // Senza `IS NULL` questa riga sposta un fascicolo gia' legato su un'altra azienda
  // con una chiamata sola — innocuo finche' nessuna riga nasce da un fascicolo, grave
  // da P3 in poi, quando il registro dell'origine vi si appoggia. E' l'idioma di
  // `applyTenantActivation`, di cui questa funzione era l'eccezione.
  // Un 0-righe qui NON dice «non trovato»: il service ha gia' accertato che esiste.
  const r = await db.query<BlueprintRow>(
    `UPDATE sys.sys_tenant_blueprints
        SET tenant_blueprint_tenant_id = $2, updated_by = $3
      WHERE tenant_blueprint_id = $1
        AND tenant_blueprint_tenant_id IS NULL RETURNING ${B_COLS}`,
    [id, tenantId, actorUserId],
  );
  return r.rows[0] ? toBlueprint(r.rows[0]) : null;
}

/* -------------------------------------------------------------- versioni */

export async function listVersions(
  db: Db,
  blueprintId: string,
): Promise<TenantBlueprintVersion[]> {
  const r = await db.query<VersionRow>(
    `SELECT ${V_COLS} FROM sys.sys_tenant_blueprint_versions
      WHERE tenant_blueprint_version_blueprint_id = $1
      ORDER BY tenant_blueprint_version_number`,
    [blueprintId],
  );
  return r.rows.map(toVersion);
}

/**
 * La chiave della sorgente di costruzione dichiarata dal modello ancorato (#198 T6).
 *
 * Si legge dalla VERSIONE DI VARIANTE, non dalla versione di fascicolo: e' il modello a
 * sapere da dove nasce il suo contenuto, e il fascicolo si limita ad ancorarlo. `null` non
 * e' un ripiego su un archetipo qualsiasi — chi chiama deve fermarsi.
 */
export async function findBuildSourceKey(db: Db, variantVersionId: string): Promise<string | null> {
  const r = await db.query<{ k: string | null }>(
    `SELECT blueprint_variant_version_build_source_key AS k
       FROM sys.sys_blueprint_variant_versions
      WHERE blueprint_variant_version_id = $1`,
    [variantVersionId],
  );
  return r.rows[0]?.k ?? null;
}

export async function findVersion(
  db: Db,
  blueprintId: string,
  number: number,
): Promise<TenantBlueprintVersion | null> {
  const r = await db.query<VersionRow>(
    `SELECT ${V_COLS} FROM sys.sys_tenant_blueprint_versions
      WHERE tenant_blueprint_version_blueprint_id = $1
        AND tenant_blueprint_version_number = $2`,
    [blueprintId, number],
  );
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

export async function findVersionById(
  db: Db,
  versionId: string,
): Promise<TenantBlueprintVersion | null> {
  const r = await db.query<VersionRow>(
    `SELECT ${V_COLS} FROM sys.sys_tenant_blueprint_versions
      WHERE tenant_blueprint_version_id = $1`,
    [versionId],
  );
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

/** Assegna il numero con max(number)+1 DENTRO la stessa transazione. */
export async function insertVersion(
  client: PoolClient,
  blueprintId: string,
  supersedesId: string | null,
  actorUserId: string,
): Promise<TenantBlueprintVersion> {
  const r = await client.query<VersionRow>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_supersedes_id,
        tenant_blueprint_version_variant_version_id,
        tenant_blueprint_version_industry_class_id, tenant_blueprint_version_size_band_id,
        tenant_blueprint_version_operating_model_id,
        tenant_blueprint_version_regulatory_intensity, tenant_blueprint_version_country_code,
        tenant_blueprint_version_employee_count, tenant_blueprint_version_revenue_eur,
        created_by, updated_by)
     SELECT $1,
            COALESCE(max(v.tenant_blueprint_version_number), 0) + 1,
            'DRAFT', $2,
            p.tenant_blueprint_version_variant_version_id,
            p.tenant_blueprint_version_industry_class_id, p.tenant_blueprint_version_size_band_id,
            p.tenant_blueprint_version_operating_model_id,
            p.tenant_blueprint_version_regulatory_intensity, p.tenant_blueprint_version_country_code,
            p.tenant_blueprint_version_employee_count, p.tenant_blueprint_version_revenue_eur,
            $3, $3
       FROM sys.sys_tenant_blueprint_versions v
       LEFT JOIN sys.sys_tenant_blueprint_versions p ON p.tenant_blueprint_version_id = $2
      WHERE v.tenant_blueprint_version_blueprint_id = $1
      GROUP BY p.tenant_blueprint_version_variant_version_id,
               p.tenant_blueprint_version_industry_class_id, p.tenant_blueprint_version_size_band_id,
               p.tenant_blueprint_version_operating_model_id,
               p.tenant_blueprint_version_regulatory_intensity, p.tenant_blueprint_version_country_code,
               p.tenant_blueprint_version_employee_count, p.tenant_blueprint_version_revenue_eur
     RETURNING ${V_COLS}`,
    [blueprintId, supersedesId, actorUserId],
  );
  const row = r.rows[0];
  if (!row) throw new Error("insertVersion: nessuna riga restituita");
  await client.query(
    `UPDATE sys.sys_tenant_blueprints
        SET tenant_blueprint_current_version_id = $2, updated_by = $3
      WHERE tenant_blueprint_id = $1`,
    [blueprintId, row.tenant_blueprint_version_id, actorUserId],
  );
  return toVersion(row);
}

/** Le decisioni si portano dietro: una versione nuova riparte da dove si era. */
export async function copyDecisions(
  client: PoolClient,
  fromVersionId: string,
  toVersionId: string,
): Promise<number> {
  const r = await client.query(
    `INSERT INTO sys.sys_tenant_blueprint_process_decisions
       (tenant_blueprint_process_decision_version_id,
        tenant_blueprint_process_decision_process_id,
        tenant_blueprint_process_decision_inclusion,
        tenant_blueprint_process_decision_rationale,
        created_by, updated_by)
     SELECT $2, d.tenant_blueprint_process_decision_process_id,
            d.tenant_blueprint_process_decision_inclusion,
            d.tenant_blueprint_process_decision_rationale,
            d.created_by, d.updated_by
       FROM sys.sys_tenant_blueprint_process_decisions d
      WHERE d.tenant_blueprint_process_decision_version_id = $1
     ON CONFLICT DO NOTHING`,
    [fromVersionId, toVersionId],
  );
  return r.rowCount ?? 0;
}

const IDENTITY_COLUMNS: Record<keyof BlueprintIdentity, string> = {
  industryClassId: "tenant_blueprint_version_industry_class_id",
  sizeBandId: "tenant_blueprint_version_size_band_id",
  operatingModelId: "tenant_blueprint_version_operating_model_id",
  regulatoryIntensity: "tenant_blueprint_version_regulatory_intensity",
  countryCode: "tenant_blueprint_version_country_code",
  employeeCount: "tenant_blueprint_version_employee_count",
  revenueEur: "tenant_blueprint_version_revenue_eur",
};

export async function patchIdentity(
  db: Db,
  versionId: string,
  patch: Partial<BlueprintIdentity>,
  actorUserId: string,
): Promise<TenantBlueprintVersion | null> {
  const sets: string[] = [];
  const params: unknown[] = [versionId];
  // Le colonne NON vengono dal chiamante: si prendono dalla mappa qui sopra,
  // che e' chiusa sui campi dell'identita'. Nessun nome di colonna puo'
  // arrivare da fuori.
  for (const [campo, colonna] of Object.entries(IDENTITY_COLUMNS)) {
    const k = campo as keyof BlueprintIdentity;
    if (!(k in patch)) continue;
    params.push(patch[k] ?? null);
    sets.push(`${colonna} = $${params.length}`);
  }
  if (sets.length === 0) return findVersionById(db, versionId);
  params.push(actorUserId);
  sets.push(`updated_by = $${params.length}`);
  const r = await db.query<VersionRow>(
    `UPDATE sys.sys_tenant_blueprint_versions SET ${sets.join(", ")}
      WHERE tenant_blueprint_version_id = $1 RETURNING ${V_COLS}`,
    params,
  );
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

export async function pinModel(
  db: Db,
  versionId: string,
  variantVersionId: string,
  actorUserId: string,
): Promise<TenantBlueprintVersion | null> {
  const r = await db.query<VersionRow>(
    `UPDATE sys.sys_tenant_blueprint_versions
        SET tenant_blueprint_version_variant_version_id = $2, updated_by = $3
      WHERE tenant_blueprint_version_id = $1 RETURNING ${V_COLS}`,
    [versionId, variantVersionId, actorUserId],
  );
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

/** Guardata sullo stato: 0 righe = transizione non ammessa, il servizio la traduce. */
export async function setVersionStatus(
  db: Db,
  versionId: string,
  from: readonly string[],
  to: string,
  actorUserId: string,
): Promise<boolean> {
  const r = await db.query(
    `UPDATE sys.sys_tenant_blueprint_versions
        SET tenant_blueprint_version_status = $3, updated_by = $4
      WHERE tenant_blueprint_version_id = $1
        AND tenant_blueprint_version_status = ANY($2::text[])`,
    [versionId, [...from], to, actorUserId],
  );
  return (r.rowCount ?? 0) === 1;
}

/* -------------------------------------------------------------- processi */

/**
 * I processi del modello ancorato, con la decisione SOVRAPPOSTA (null dove non
 * c'e': R1). `LEFT JOIN` e non `JOIN` — con un `JOIN` la cascata mostrerebbe
 * solo i processi gia' decisi, e il consulente non avrebbe piu' niente su cui
 * decidere.
 */
export async function listProcessesWithDecisions(
  db: Db,
  versionId: string,
): Promise<ProcessDecision[]> {
  const r = await db.query<DecisionRow>(
    `SELECT p.blueprint_process_id                        AS "processId",
            p.blueprint_process_code                      AS "processCode",
            p.blueprint_process_name                      AS "processName",
            p.blueprint_process_ordinal                   AS ordinal,
            d.tenant_blueprint_process_decision_inclusion AS inclusion,
            d.tenant_blueprint_process_decision_rationale AS rationale
       FROM sys.sys_tenant_blueprint_versions v
       JOIN sys.sys_blueprint_process_registry p
         ON p.blueprint_process_variant_version_id = v.tenant_blueprint_version_variant_version_id
       LEFT JOIN sys.sys_tenant_blueprint_process_decisions d
         ON d.tenant_blueprint_process_decision_version_id = v.tenant_blueprint_version_id
        AND d.tenant_blueprint_process_decision_process_id = p.blueprint_process_id
      WHERE v.tenant_blueprint_version_id = $1
      ORDER BY p.blueprint_process_ordinal`,
    [versionId],
  );
  return r.rows.map((row) => ({
    processId: row.processId,
    processCode: row.processCode,
    processName: row.processName,
    ordinal: row.ordinal,
    inclusion: row.inclusion as ProcessInclusion | null,
    rationale: row.rationale,
  }));
}

/** Il processo appartiene davvero al modello ancorato da questa versione? */
export async function processBelongsToVersion(
  db: Db,
  versionId: string,
  processId: string,
): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT true AS ok
       FROM sys.sys_tenant_blueprint_versions v
       JOIN sys.sys_blueprint_process_registry p
         ON p.blueprint_process_variant_version_id = v.tenant_blueprint_version_variant_version_id
      WHERE v.tenant_blueprint_version_id = $1 AND p.blueprint_process_id = $2`,
    [versionId, processId],
  );
  return r.rows.length === 1;
}

export async function upsertDecision(
  db: Db,
  versionId: string,
  processId: string,
  inclusion: ProcessInclusion,
  rationale: string,
  actorUserId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO sys.sys_tenant_blueprint_process_decisions
       (tenant_blueprint_process_decision_version_id,
        tenant_blueprint_process_decision_process_id,
        tenant_blueprint_process_decision_inclusion,
        tenant_blueprint_process_decision_rationale,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (tenant_blueprint_process_decision_version_id,
                  tenant_blueprint_process_decision_process_id)
     DO UPDATE SET tenant_blueprint_process_decision_inclusion = EXCLUDED.tenant_blueprint_process_decision_inclusion,
                   tenant_blueprint_process_decision_rationale = EXCLUDED.tenant_blueprint_process_decision_rationale,
                   updated_by = EXCLUDED.updated_by`,
    [versionId, processId, inclusion, rationale, actorUserId],
  );
}

export async function deleteDecision(
  db: Db,
  versionId: string,
  processId: string,
): Promise<boolean> {
  const r = await db.query(
    `DELETE FROM sys.sys_tenant_blueprint_process_decisions
      WHERE tenant_blueprint_process_decision_version_id = $1
        AND tenant_blueprint_process_decision_process_id = $2`,
    [versionId, processId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function findSnapshot(
  db: Db,
  versionId: string,
): Promise<{ payload: unknown; contentHash: string } | null> {
  const r = await db.query<{ payload: unknown; hash: string }>(
    `SELECT tenant_blueprint_snapshot_payload AS payload,
            tenant_blueprint_snapshot_content_hash AS hash
       FROM sys.sys_tenant_blueprint_snapshots
      WHERE tenant_blueprint_snapshot_version_id = $1`,
    [versionId],
  );
  const row = r.rows[0];
  return row ? { payload: row.payload, contentHash: row.hash } : null;
}

/** Gli utenti che possono firmare un fascicolo: chi detiene `tenant_blueprint:approve`. */
export async function findApprovers(db: Db): Promise<Array<{ userId: string }>> {
  const r = await db.query<{ user_id: string }>(
    `SELECT DISTINCT u.user_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur
         ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'tenant_blueprint:approve'
        AND u.user_status = 'ACTIVE'
        AND u.user_tenant_id IS NOT NULL
      ORDER BY u.user_id`,
  );
  return r.rows.map((x) => ({ userId: x.user_id }));
}
