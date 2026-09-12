/**
 * packages/shared/src/schemas/performance-reviews.ts
 * #92 passo 3/7 — le valutazioni della persona (548 storiche reali, mig 000256
 * per la FK al ciclo; le 16 colonne di workflow si popolano dal passo 4).
 *
 * Classe EVALUATION (ADR-0036 M1): i campi-GIUDIZIO sono optional perche' sotto
 * il mandato piattaforma vengono RIMOSSI e dichiarati in `masked` (ADR-0032).
 * La riga resta: soggetto, valutatore, periodo, tipo, stato e le date di
 * workflow — l'amministratore sa che la valutazione esiste, non cosa dice.
 */
import { z } from "zod";
import { queryBoolean } from "./_query-boolean.js";

/**
 * L'ECCEZIONE DI CONDIVISIONE (mig 000396, decisione di Enzo 2026-09-09): una valutazione
 * COMPLETED mai condivisa perche' il passo di condivisione del workflow non e' mai stato
 * costruito, con la ragione, chi ha deciso, quando, e la condizione che la chiude. E' un
 * dato di GOVERNO sul percorso — come le date di workflow — non un giudizio: quindi NON
 * viene mascherato sotto il mandato piattaforma. Nulla quando la valutazione non e' coperta.
 * Fino a S1097 il registro (568 righe) non era esposto da nessuna API (deroga #79).
 */
export const CondivisioneEccezioneSchema = z.object({
  motivo: z.string(),
  decisaDa: z.string(),
  decisaIl: z.string(),
  condizioneChiusura: z.string(),
});
export type CondivisioneEccezione = z.infer<typeof CondivisioneEccezioneSchema>;

export const PerformanceReviewSchema = z.object({
  reviewId: z.uuid(),
  tenantId: z.uuid(),
  subjectUserId: z.uuid().nullable(),
  subjectEmail: z.string().nullable(),
  reviewerUserId: z.uuid().nullable(),
  reviewCycleId: z.uuid().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  type: z.string().nullable(),
  status: z.string().nullable(),
  selfAssessmentStatus: z.string().nullable(),
  // workflow: le date raccontano il percorso, non il giudizio — restano visibili
  selfSubmittedAt: z.iso.datetime().nullable(),
  managerSubmittedAt: z.iso.datetime().nullable(),
  calibratedAt: z.iso.datetime().nullable(),
  finalizedAt: z.iso.datetime().nullable(),
  sharedAt: z.iso.datetime().nullable(),
  acknowledgedAt: z.iso.datetime().nullable(),
  condivisioneEccezione: CondivisioneEccezioneSchema.nullable(),
  // giudizio (mascherabile, ADR-0032)
  overallRating: z.number().nullable().optional(),
  goalAchievementRating: z.number().nullable().optional(),
  competencyRating: z.number().nullable().optional(),
  selfRating: z.number().nullable().optional(),
  calibratedRating: z.number().nullable().optional(),
  preCalibrationRating: z.number().nullable().optional(),
  potentialRating: z.string().nullable().optional(),
  performanceBox: z.number().int().nullable().optional(),
  potentialBox: z.number().int().nullable().optional(),
  strengths: z.string().nullable().optional(),
  areasForImprovement: z.string().nullable().optional(),
  managerComments: z.string().nullable().optional(),
  employeeComments: z.string().nullable().optional(),
  selfComments: z.string().nullable().optional(),
  developmentPlan: z.string().nullable().optional(),
  careerAspirations: z.string().nullable().optional(),
  calibrationNotes: z.string().nullable().optional(),
  masked: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PerformanceReview = z.infer<typeof PerformanceReviewSchema>;

export const PerformanceReviewListQuerySchema = z.object({
  subjectUserId: z.uuid().optional(),
  reviewCycleId: z.uuid().optional(),
  type: z.string().max(32).optional(),
  status: z.string().max(32).optional(),
  /** solo le valutazioni coperte da un'eccezione di condivisione (registro 000396) */
  soloEccezioni: queryBoolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PerformanceReviewListQuery = z.infer<typeof PerformanceReviewListQuerySchema>;

export const PerformanceReviewListResponseSchema = z.object({
  items: z.array(PerformanceReviewSchema),
  total: z.number().int().min(0),
});
export type PerformanceReviewListResponse = z.infer<typeof PerformanceReviewListResponseSchema>;

export const PerformanceReviewParamSchema = z.object({ reviewId: z.uuid() });
export type PerformanceReviewParam = z.infer<typeof PerformanceReviewParamSchema>;
