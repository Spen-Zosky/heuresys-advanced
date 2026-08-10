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
