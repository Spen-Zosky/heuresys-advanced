/**
 * packages/shared/src/schemas/successor-readiness.ts
 * Append-only readiness measurements for a successor candidate.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/**
 * L'orizzonte di prontezza è categoriale, non testo libero. Il vocabolario
 * esisteva già ovunque tranne che qui: il database lo impone (migration
 * `000217`, rilievo #41 della coda C5), la UI ne traduce esattamente queste
 * cinque chiavi (`admin.json` → `insightsReadiness.horizon`) e il dato reale
 * non ha mai contenuto altro. Finché il contratto accettava `z.string()`,
 * l'API poteva far passare un valore che il database rifiuta — un 500 al posto
 * di un 400, e una schermata con una traduzione mancante.
 */
export const SUCCESSOR_READINESS_HORIZON_VALUES = [
  "READY_NOW", "READY_6_MONTHS", "READY_1_YEAR", "READY_2_YEARS", "NOT_READY",
] as const;
export const SuccessorReadinessHorizonSchema = z.enum(SUCCESSOR_READINESS_HORIZON_VALUES);
export type SuccessorReadinessHorizon = z.infer<typeof SuccessorReadinessHorizonSchema>;

export const SuccessorReadinessSchema = z.object({
  successorReadinessId: z.uuid(),
  candidateId: z.uuid(),
  tenantId: z.uuid(),
  score: z.number().nullable(),
  horizon: SuccessorReadinessHorizonSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  assessedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type SuccessorReadiness = z.infer<typeof SuccessorReadinessSchema>;

export const SuccessorReadinessListQuerySchema = z.object({
  candidateId: z.uuid().optional(),
  horizon: SuccessorReadinessHorizonSchema.optional(),
  ...paginationFields(200, 50),
});
export type SuccessorReadinessListQuery = z.infer<typeof SuccessorReadinessListQuerySchema>;

export const SuccessorReadinessListResponseSchema = z.object({
  items: z.array(SuccessorReadinessSchema),
  total: z.number().int().min(0),
});

export const CreateSuccessorReadinessBodySchema = z.object({
  candidateId: z.uuid(),
  score: z.number().min(-100).max(100).nullable().optional(),
  horizon: SuccessorReadinessHorizonSchema.nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSuccessorReadinessBody = z.infer<typeof CreateSuccessorReadinessBodySchema>;

export const SuccessorReadinessIdParamSchema = z.object({ id: z.uuid() });
