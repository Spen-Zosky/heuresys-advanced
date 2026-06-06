/**
 * @heuresys/shared — semantic-matching schemas (AI ② P1).
 * Backs /v1/matching/* read endpoints (kNN cosine over pgvector embeddings).
 * Matches are derived/read-only; score = cosine similarity in [0,1].
 */
import { z } from "zod";

export const MatchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type MatchQuery = z.infer<typeof MatchQuerySchema>;

export const OccupationMatchSchema = z.object({
  escoUri: z.string(),
  label: z.string().nullable(),
  iscoCode: z.string().nullable(),
  score: z.number(),
});
export type OccupationMatch = z.infer<typeof OccupationMatchSchema>;

export const OccupationMatchListResponseSchema = z.object({
  items: z.array(OccupationMatchSchema),
  total: z.number().int().min(0),
  evidenceCount: z.number().int().min(0), // person-profile sparsity, honest empty-state
});

export const SkillMatchSchema = z.object({
  skillId: z.uuid(),
  skillName: z.string().nullable(),
  score: z.number(),
});
export type SkillMatch = z.infer<typeof SkillMatchSchema>;

export const SkillMatchListResponseSchema = z.object({
  items: z.array(SkillMatchSchema),
  total: z.number().int().min(0),
});

/**
 * Person → positions match (AI ②·Fase 3, "option C", read-only).
 * Positions are NOT embedded; the score is the cosine affinity of the position's
 * job_role embedding to the caller's profile, JOINed via position_job_role_id.
 */
export const PositionMatchSchema = z.object({
  positionId: z.uuid(),
  positionCode: z.string(),
  positionTitle: z.string().nullable(),
  jobRoleId: z.uuid().nullable(),
  score: z.number(),
});
export type PositionMatch = z.infer<typeof PositionMatchSchema>;

export const PositionMatchListResponseSchema = z.object({
  items: z.array(PositionMatchSchema),
  total: z.number().int().min(0),
  evidenceCount: z.number().int().min(0), // person-profile sparsity, honest empty-state
});

export const MatchUserIdParamSchema = z.object({ userId: z.uuid() });
export const MatchSkillIdParamSchema = z.object({ skillId: z.uuid() });

/**
 * Person → job_roles match (AI ②·Fase 2, read-only). The caller's mean-pooled
 * profile vector is cosine-ranked against sys_job_role_embeddings (tenant-aware I5
 * via the role's positions / global roles). score = cosine in [0,1].
 */
export const JobRoleMatchSchema = z.object({
  jobRoleId: z.uuid(),
  jobRoleCode: z.string(),
  jobRoleName: z.string().nullable(),
  seniorityLevel: z.string().nullable(),
  score: z.number(),
});
export type JobRoleMatch = z.infer<typeof JobRoleMatchSchema>;

export const JobRoleMatchListResponseSchema = z.object({
  items: z.array(JobRoleMatchSchema),
  total: z.number().int().min(0),
  evidenceCount: z.number().int().min(0), // person-profile sparsity, honest empty-state
});

/**
 * Person ↔ person similarity (AI ②·Fase 2, read-only, ELEVATED-ROLE only).
 * Profile→profile cosine; the queried user is SELF-EXCLUDED, results are tenant-scoped (I5).
 * No ESS self surface (privacy) — this is a manager/admin discovery tool.
 */
export const SimilarUserMatchSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().nullable(),
  score: z.number(),
});
export type SimilarUserMatch = z.infer<typeof SimilarUserMatchSchema>;

export const SimilarUserMatchListResponseSchema = z.object({
  items: z.array(SimilarUserMatchSchema),
  total: z.number().int().min(0),
});

/**
 * Free-text query (AI ②·Fase 2, behind MATCHING_FREETEXT_ENABLED, default OFF).
 * The query string is embedded AT REQUEST TIME via the injectable Embedder seam
 * (the same seam the backfill uses), then kNN over occupations + skills.
 */
export const FreeTextQuerySchema = z.object({
  q: z.string().trim().min(1).max(512),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type FreeTextQuery = z.infer<typeof FreeTextQuerySchema>;

export const FreeTextSearchResponseSchema = z.object({
  occupations: z.array(OccupationMatchSchema),
  skills: z.array(SkillMatchSchema),
});

/** POST /v1/matching/reindex — trigger the embedding backfill (matching:admin). */
export const ReindexResponseSchema = z.object({
  accepted: z.boolean(),
  skills: z.object({ embedded: z.number().int().min(0), skipped: z.number().int().min(0) }),
  jobRoles: z.object({ embedded: z.number().int().min(0), skipped: z.number().int().min(0) }),
  occupations: z.object({ embedded: z.number().int().min(0), skipped: z.number().int().min(0) }),
  profilesWritten: z.number().int().min(0),
});
export type ReindexResponse = z.infer<typeof ReindexResponseSchema>;
