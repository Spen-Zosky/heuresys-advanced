/**
 * packages/shared/src/schemas/user-target-positions.ts
 *
 * L'obiettivo di carriera di una persona: quale posizione punta, entro quando,
 * e l'esito della revisione di chi deve dire sì.
 *
 * Rilievo #40 della coda C5: la tabella portava da sempre uno stato di
 * revisione, un revisore e delle note, ma nessuna API permetteva di REVISIONARE
 * — lo stato esisteva e nessuno poteva cambiarlo. Da qui l'endpoint dedicato
 * `POST /:id/review`, che è l'atto, non un aggiornamento di campo qualsiasi:
 * il revisore è chi compie l'azione, non un id passato dal chiamante.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

export const USER_TARGET_POSITION_HORIZON_VALUES = ["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"] as const;
export const UserTargetPositionHorizonSchema = z.enum(USER_TARGET_POSITION_HORIZON_VALUES);
export type UserTargetPositionHorizon = z.infer<typeof UserTargetPositionHorizonSchema>;

export const USER_TARGET_POSITION_REVIEW_STATUS_VALUES = [
  "PENDING_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN",
] as const;
export const UserTargetPositionReviewStatusSchema = z.enum(USER_TARGET_POSITION_REVIEW_STATUS_VALUES);
export type UserTargetPositionReviewStatus = z.infer<typeof UserTargetPositionReviewStatusSchema>;

/** L'esito che una revisione può produrre: gli altri due stati non sono decisioni
 *  del revisore (PENDING_REVIEW è l'attesa, WITHDRAWN è il ritiro di chi propone). */
export const USER_TARGET_POSITION_REVIEW_DECISION_VALUES = ["APPROVED", "REJECTED"] as const;
export const UserTargetPositionReviewDecisionSchema = z.enum(USER_TARGET_POSITION_REVIEW_DECISION_VALUES);
export type UserTargetPositionReviewDecision = z.infer<typeof UserTargetPositionReviewDecisionSchema>;

export const UserTargetPositionSchema = z.object({
  userTargetPositionId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  positionId: z.uuid(),
  horizon: UserTargetPositionHorizonSchema.nullable(),
  reviewStatus: UserTargetPositionReviewStatusSchema,
  reviewerUserId: z.uuid().nullable(),
  // Opzionale per la MASCHERATURA (#124): e' il giudizio scritto SU una persona
  // a proposito del suo obiettivo di carriera, classe EVALUATION.
  reviewNotes: z.string().nullable().optional(),
  masked: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserTargetPosition = z.infer<typeof UserTargetPositionSchema>;

export const UserTargetPositionListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  horizon: UserTargetPositionHorizonSchema.optional(),
  reviewStatus: UserTargetPositionReviewStatusSchema.optional(),
  reviewerUserId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type UserTargetPositionListQuery = z.infer<typeof UserTargetPositionListQuerySchema>;

export const UserTargetPositionListResponseSchema = z.object({
  items: z.array(UserTargetPositionSchema),
  total: z.number().int().min(0),
});

export const CreateUserTargetPositionBodySchema = z.object({
  userId: z.uuid(),
  positionId: z.uuid(),
  horizon: UserTargetPositionHorizonSchema.nullable().optional(),
  reviewStatus: UserTargetPositionReviewStatusSchema.optional().default("PENDING_REVIEW"),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateUserTargetPositionBody = z.infer<typeof CreateUserTargetPositionBodySchema>;

export const UpdateUserTargetPositionBodySchema = z.object({
  positionId: z.uuid().optional(),
  horizon: UserTargetPositionHorizonSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateUserTargetPositionBody = z.infer<typeof UpdateUserTargetPositionBodySchema>;

/** Il corpo della revisione. Non contiene il revisore: quello è l'attore. */
export const ReviewUserTargetPositionBodySchema = z.object({
  decision: UserTargetPositionReviewDecisionSchema,
  notes: z.string().max(2000).nullable().optional(),
});
export type ReviewUserTargetPositionBody = z.infer<typeof ReviewUserTargetPositionBodySchema>;

export const UserTargetPositionIdParamSchema = z.object({ id: z.uuid() });
