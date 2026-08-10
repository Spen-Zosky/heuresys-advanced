/**
 * packages/shared/src/schemas/review-cycles.ts
 * #92 passo 3/7 — i cicli di valutazione (catalogo di tenant, mig 000256).
 *
 * Il ciclo e' META del processo di valutazione: finestre, scadenze, stato della
 * macchina (DRAFT→…→CLOSED via 000256 CHECK). Nessun giudizio per-persona vive
 * qui, quindi niente mask: la classe EVALUATION sta nelle review e nelle
 * discussioni di calibrazione, non nel calendario.
 *
 * Oggi la tabella e' VUOTA per costruzione (i cicli legacy erano 'Test Auth
 * Cycle' in draft, decisi da non importare): la lista vuota e' un empty-state
 * reale e legittimo, non un difetto.
 */
import { z } from "zod";

export const ReviewCycleSchema = z.object({
  reviewCycleId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  periodStart: z.string(), // date (YYYY-MM-DD)
  periodEnd: z.string(),
  selfDeadline: z.string().nullable(),
  managerDeadline: z.string().nullable(),
  status: z.string(),
  openedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ReviewCycle = z.infer<typeof ReviewCycleSchema>;

export const ReviewCycleListQuerySchema = z.object({
  status: z.string().max(32).optional(),
  type: z.string().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ReviewCycleListQuery = z.infer<typeof ReviewCycleListQuerySchema>;

export const ReviewCycleListResponseSchema = z.object({
  items: z.array(ReviewCycleSchema),
  total: z.number().int().min(0),
});
export type ReviewCycleListResponse = z.infer<typeof ReviewCycleListResponseSchema>;

export const ReviewCycleParamSchema = z.object({ cycleId: z.uuid() });
export type ReviewCycleParam = z.infer<typeof ReviewCycleParamSchema>;
