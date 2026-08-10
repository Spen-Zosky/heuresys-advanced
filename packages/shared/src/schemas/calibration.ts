/**
 * packages/shared/src/schemas/calibration.ts
 * #92 passo 3/7 — le sessioni di calibrazione reali di RTL Bank (35 sessioni,
 * 20 partecipazioni, 40 discussioni — ingerite dal legacy, mig 000257).
 *
 * Tre grane, tre trattamenti (ADR-0036):
 * - la SESSIONE e' meta organizzativa (chi, dove, quando): visibile a chi legge
 *   le valutazioni; `summaryNotes` (misurato: testo aggregato, 4/35) e'
 *   mascherabile sotto mandato piattaforma (aggregato senza soggetto);
 * - la PARTECIPAZIONE e' appartenenza (ACTIVITY);
 * - la DISCUSSIONE e' il giudizio su UNA persona (EVALUATION): passa dalla
 *   catena organizzativa (I18) e i voti sono mascherabili (ADR-0032).
 */
import { z } from "zod";

export const CalibrationSessionSchema = z.object({
  calibrationSessionId: z.uuid(),
  tenantId: z.uuid(),
  reviewCycleId: z.uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  organizationUnitId: z.uuid().nullable(),
  department: z.string().nullable(),
  scheduledAt: z.iso.datetime().nullable(),
  durationMin: z.number().int().nullable(),
  location: z.string().nullable(),
  facilitatorUserId: z.uuid().nullable(),
  status: z.string(),
  summaryNotes: z.string().nullable().optional(),
  masked: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CalibrationSession = z.infer<typeof CalibrationSessionSchema>;

export const CalibrationParticipantSchema = z.object({
  calibrationParticipantId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.uuid(),
  userEmail: z.string().nullable(),
  role: z.string(),
  joinedAt: z.iso.datetime().nullable(),
});
export type CalibrationParticipant = z.infer<typeof CalibrationParticipantSchema>;

export const CalibrationDiscussionSchema = z.object({
  calibrationDiscussionId: z.uuid(),
  sessionId: z.uuid(),
  subjectUserId: z.uuid(),
  subjectEmail: z.string().nullable(),
  reviewId: z.uuid().nullable(),
  wasAdjusted: z.boolean(),
  discussedAt: z.iso.datetime().nullable(),
  // giudizio (mascherabile, ADR-0032)
  originalRating: z.number().nullable().optional(),
  originalPotential: z.string().nullable().optional(),
  calibratedRating: z.number().nullable().optional(),
  calibratedPotential: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  adjustmentReason: z.string().nullable().optional(),
  masked: z.array(z.string()).optional(),
});
export type CalibrationDiscussion = z.infer<typeof CalibrationDiscussionSchema>;

export const CalibrationSessionListQuerySchema = z.object({
  status: z.string().max(32).optional(),
  reviewCycleId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CalibrationSessionListQuery = z.infer<typeof CalibrationSessionListQuerySchema>;

export const CalibrationSessionListResponseSchema = z.object({
  items: z.array(CalibrationSessionSchema),
  total: z.number().int().min(0),
});
export type CalibrationSessionListResponse = z.infer<typeof CalibrationSessionListResponseSchema>;

export const CalibrationSessionDetailSchema = z.object({
  session: CalibrationSessionSchema,
  participants: z.array(CalibrationParticipantSchema),
});
export type CalibrationSessionDetail = z.infer<typeof CalibrationSessionDetailSchema>;

export const CalibrationDiscussionListResponseSchema = z.object({
  items: z.array(CalibrationDiscussionSchema),
  total: z.number().int().min(0),
});
export type CalibrationDiscussionListResponse = z.infer<typeof CalibrationDiscussionListResponseSchema>;

export const CalibrationSessionParamSchema = z.object({ sessionId: z.uuid() });
export type CalibrationSessionParam = z.infer<typeof CalibrationSessionParamSchema>;
