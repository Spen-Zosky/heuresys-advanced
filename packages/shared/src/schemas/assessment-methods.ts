/**
 * packages/shared/src/schemas/assessment-methods.ts
 * Read-only catalog: 5 methods seeded by migration 000017
 * (RATING/NARRATIVE/EVIDENCE_BASED/PEER_360/MANAGER_DIRECT).
 */

import { z } from "zod";

export const AssessmentMethodCodeSchema = z.enum([
  "RATING",
  "NARRATIVE",
  "EVIDENCE_BASED",
  "PEER_360",
  "MANAGER_DIRECT",
]);
export type AssessmentMethodCode = z.infer<typeof AssessmentMethodCodeSchema>;

export const AssessmentMethodSchema = z.object({
  assessmentMethodId: z.uuid(),
  code: AssessmentMethodCodeSchema,
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type AssessmentMethod = z.infer<typeof AssessmentMethodSchema>;

export const AssessmentMethodListResponseSchema = z.object({
  items: z.array(AssessmentMethodSchema),
  total: z.number().int().min(0),
});
