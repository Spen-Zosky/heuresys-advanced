/**
 * apps/api/src/modules/semantic-matching/repository.ts
 * Raw parameterized SQL for the embedding substrate (sys.sys_*_embeddings) +
 * kNN cosine queries (pgvector <=>). Person profiles are mean-pooled in SQL.
 */
import type { Pool, PoolClient } from "pg";
import type { OccupationMatch, SkillMatch } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/** pgvector text input format: '[v1,v2,...]'. */
export const toVectorLiteral = (v: number[]): string => `[${v.join(",")}]`;

const num = (v: string | null): number => (v === null ? 0 : Number(v));

// ── Corpus reads (entity → text to embed) ──
export interface CorpusItem { id: string; text: string }

export async function readSkillCorpus(q: DbConnector): Promise<CorpusItem[]> {
  const r = await q.query<CorpusItem>(
    `SELECT skill_id AS id,
            btrim(coalesce(skill_name,'') || ' ' || coalesce(skill_description,'')) AS text
     FROM sys.sys_skills
     WHERE skill_name IS NOT NULL AND btrim(skill_name) <> ''`);
  return r.rows;
}

export async function readJobRoleCorpus(q: DbConnector): Promise<CorpusItem[]> {
  const r = await q.query<CorpusItem>(
    `SELECT job_role_id AS id,
            btrim(coalesce(job_role_name,'') || ' ' || coalesce(job_role_description,'')) AS text
     FROM sys.sys_job_roles
     WHERE job_role_name IS NOT NULL AND btrim(job_role_name) <> ''`);
  return r.rows;
}

export interface OccCorpusItem { uri: string; label: string; isco: string | null; text: string }
export async function readOccupationCorpus(q: DbConnector): Promise<OccCorpusItem[]> {
  // One row per distinct URI (the embedding table is keyed by URI). Text = label.
  const r = await q.query<OccCorpusItem>(
    `SELECT DISTINCT ON (esco_occupation_mapping_esco_uri)
            esco_occupation_mapping_esco_uri   AS uri,
            esco_occupation_mapping_esco_label AS label,
            esco_occupation_mapping_isco_code  AS isco,
            btrim(coalesce(esco_occupation_mapping_esco_label,'')) AS text
     FROM sys.sys_esco_occupation_mappings
     WHERE esco_occupation_mapping_esco_label IS NOT NULL
       AND btrim(esco_occupation_mapping_esco_label) <> ''
     ORDER BY esco_occupation_mapping_esco_uri`);
  return r.rows;
}

// ── Existing-hash reads (for hash-skip idempotency) ──
export async function readSkillHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ skill_id: string; source_text_hash: string | null }>(
    `SELECT skill_id, source_text_hash FROM sys.sys_skill_embeddings`);
  return new Map(r.rows.map((x) => [x.skill_id, x.source_text_hash ?? ""]));
}
export async function readJobRoleHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ job_role_id: string; source_text_hash: string | null }>(
    `SELECT job_role_id, source_text_hash FROM sys.sys_job_role_embeddings`);
  return new Map(r.rows.map((x) => [x.job_role_id, x.source_text_hash ?? ""]));
}
export async function readOccupationHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ esco_uri: string; source_text_hash: string | null }>(
    `SELECT esco_uri, source_text_hash FROM sys.sys_esco_occupation_embeddings`);
  return new Map(r.rows.map((x) => [x.esco_uri, x.source_text_hash ?? ""]));
}

// ── Upserts (1:1 on the natural key; re-embed = clean overwrite) ──
export async function upsertSkillEmbedding(q: DbConnector, skillId: string, vec: number[], modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_skill_embeddings (skill_id, embedding, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (skill_id) DO UPDATE SET embedding = EXCLUDED.embedding, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [skillId, toVectorLiteral(vec), modelId, hash]);
}
export async function upsertJobRoleEmbedding(q: DbConnector, jobRoleId: string, vec: number[], modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_job_role_embeddings (job_role_id, embedding, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (job_role_id) DO UPDATE SET embedding = EXCLUDED.embedding, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [jobRoleId, toVectorLiteral(vec), modelId, hash]);
}
export async function upsertOccupationEmbedding(q: DbConnector, uri: string, vec: number[], label: string | null, isco: string | null, modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_esco_occupation_embeddings (esco_uri, embedding, label_text, isco_code, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4, $5, $6)
     ON CONFLICT (esco_uri) DO UPDATE SET embedding = EXCLUDED.embedding, label_text = EXCLUDED.label_text, isco_code = EXCLUDED.isco_code, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [uri, toVectorLiteral(vec), label, isco, modelId, hash]);
}

/**
 * Mean-pool every person's skill-evidence skill embeddings into a profile vector (SQL avg).
 * Dedupes to DISTINCT (user, skill) first: sys_user_skill_evidence has no UNIQUE on (user, skill)
 * and allows multiple sources per skill (SELF/MANAGER/CERTIFICATION/...), so without DISTINCT a
 * repeatedly-assessed skill would be weighted N times (skewing the profile) and the count would
 * report evidence-rows, not distinct skills. derived_from_evidence_count = #distinct skills.
 * Returns #profiles written.
 */
export async function deriveUserProfiles(q: DbConnector, modelId: string): Promise<number> {
  const r = await q.query(
    `INSERT INTO sys.sys_user_profile_embeddings (user_id, tenant_id, embedding, derived_from_evidence_count, model_id)
     WITH distinct_skill AS (
       SELECT DISTINCT user_skill_evidence_user_id AS uid, user_skill_evidence_skill_id AS sid
       FROM sys.sys_user_skill_evidence
     )
     SELECT d.uid, u.user_tenant_id, avg(se.embedding), count(*)::int, $1
     FROM distinct_skill d
     JOIN sys.sys_skill_embeddings se ON se.skill_id = d.sid
     JOIN sys.sys_users u ON u.user_id = d.uid
     GROUP BY d.uid, u.user_tenant_id
     ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, derived_from_evidence_count = EXCLUDED.derived_from_evidence_count, model_id = EXCLUDED.model_id`,
    [modelId]);
  return r.rowCount ?? 0;
}

// ── kNN queries (cosine; ORDER BY <=> ASC = nearest) ──
export async function knnOccupationsForUser(q: DbConnector, userId: string, limit: number): Promise<{ items: OccupationMatch[]; evidenceCount: number }> {
  const prof = await q.query<{ derived_from_evidence_count: number }>(
    `SELECT derived_from_evidence_count FROM sys.sys_user_profile_embeddings WHERE user_id = $1`, [userId]);
  if (prof.rowCount === 0) return { items: [], evidenceCount: 0 };
  const r = await q.query<{ esco_uri: string; label_text: string | null; isco_code: string | null; score: string }>(
    `WITH me AS (SELECT embedding FROM sys.sys_user_profile_embeddings WHERE user_id = $1)
     SELECT oe.esco_uri, oe.label_text, oe.isco_code,
            (1 - (oe.embedding <=> (SELECT embedding FROM me)))::text AS score
     FROM sys.sys_esco_occupation_embeddings oe
     ORDER BY oe.embedding <=> (SELECT embedding FROM me)
     LIMIT $2`, [userId, limit]);
  return {
    items: r.rows.map((x) => ({ escoUri: x.esco_uri, label: x.label_text, iscoCode: x.isco_code, score: num(x.score) })),
    evidenceCount: prof.rows[0]!.derived_from_evidence_count,
  };
}

/**
 * A skill → top-N similar skills, TENANT-SCOPED (I5): a skill is visible iff global
 * OR owned by `tenantId`. PLATFORM_ADMIN passes tenantId=undefined → no filter (sees all).
 * The visibility predicate guards BOTH the input-skill existence (return [] when the actor
 * can't see it → no cross-tenant existence oracle) AND the result set.
 */
export async function knnSimilarSkills(q: DbConnector, skillId: string, tenantId: string | undefined, limit: number): Promise<SkillMatch[]> {
  const vis = (paramIdx: number): string =>
    tenantId === undefined ? "" : ` AND (sk.skill_is_global = true OR sk.skill_tenant_id = $${paramIdx})`;

  // Input skill must be visible to the actor.
  const existsParams: unknown[] = tenantId === undefined ? [skillId] : [skillId, tenantId];
  const exists = await q.query(
    `SELECT 1 FROM sys.sys_skill_embeddings se JOIN sys.sys_skills sk ON sk.skill_id = se.skill_id
     WHERE se.skill_id = $1${vis(2)}`, existsParams);
  if (exists.rowCount === 0) return [];

  const params: unknown[] = tenantId === undefined ? [skillId, limit] : [skillId, tenantId, limit];
  const limIdx = params.length;
  const r = await q.query<{ skill_id: string; skill_name: string | null; score: string }>(
    `WITH s AS (SELECT embedding FROM sys.sys_skill_embeddings WHERE skill_id = $1)
     SELECT se.skill_id, sk.skill_name,
            (1 - (se.embedding <=> (SELECT embedding FROM s)))::text AS score
     FROM sys.sys_skill_embeddings se
     JOIN sys.sys_skills sk ON sk.skill_id = se.skill_id
     WHERE se.skill_id <> $1${vis(2)}
     ORDER BY se.embedding <=> (SELECT embedding FROM s)
     LIMIT $${limIdx}`, params);
  return r.rows.map((x) => ({ skillId: x.skill_id, skillName: x.skill_name, score: num(x.score) }));
}

/** Resolve a target user's tenant (for admin scope checks). */
export async function findUserTenant(q: DbConnector, userId: string): Promise<string | null> {
  const r = await q.query<{ user_tenant_id: string }>(`SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId]);
  return r.rows[0]?.user_tenant_id ?? null;
}
