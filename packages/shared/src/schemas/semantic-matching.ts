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
