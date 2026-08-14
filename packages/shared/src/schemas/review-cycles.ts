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

/* ─────────────────────────────────────────────────────────────────────────────
 * #92 F4 — LA MACCHINA A STATI, dichiarata una volta e condivisa.
 *
 * Gli stati sono quelli del CHECK della 000256, letti dal database e non inventati
 * qui. Le transizioni vivono nel contratto — non nel servizio e non nella UI —
 * perche' servono a entrambi: l'API le fa rispettare, il frontend ci disegna sopra
 * i comandi possibili. Due copie della stessa regola divergono sempre.
 *
 * La forma e' una progressione: il ciclo apre in bozza, raccoglie le autovalutazioni,
 * passa ai responsabili, calibra, chiude e infine condivide gli esiti. Si annulla
 * finche' non e' FINALIZED: dopo, il giudizio esiste gia' e cancellarlo sarebbe
 * riscrivere la storia, non correggerla.
 * ──────────────────────────────────────────────────────────────────────────── */

export const REVIEW_CYCLE_STATUSES = [
  "DRAFT", "SELF_ASSESSMENT", "MANAGER_REVIEW", "CALIBRATION", "FINALIZED", "SHARED", "CANCELLED",
] as const;
export type ReviewCycleStatus = (typeof REVIEW_CYCLE_STATUSES)[number];
export const ReviewCycleStatusSchema = z.enum(REVIEW_CYCLE_STATUSES);

/** Da ogni stato, gli stati raggiungibili. Vuoto = terminale. */
export const REVIEW_CYCLE_TRANSITIONS: Readonly<Record<ReviewCycleStatus, readonly ReviewCycleStatus[]>> = {
  DRAFT:           ["SELF_ASSESSMENT", "CANCELLED"],
  SELF_ASSESSMENT: ["MANAGER_REVIEW", "CANCELLED"],
  MANAGER_REVIEW:  ["CALIBRATION", "CANCELLED"],
  CALIBRATION:     ["FINALIZED", "CANCELLED"],
  FINALIZED:       ["SHARED"],
  SHARED:          [],
  CANCELLED:       [],
} as const;

/** Vero se il passaggio e' previsto. Unica autorita': la usa il servizio, non la UI. */
export function canTransitionReviewCycle(da: ReviewCycleStatus, a: ReviewCycleStatus): boolean {
  return REVIEW_CYCLE_TRANSITIONS[da].includes(a);
}

export const CreateReviewCycleBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  type: z.string().min(1).max(32),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data YYYY-MM-DD"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data YYYY-MM-DD"),
  selfDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  managerDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
export type CreateReviewCycleBody = z.infer<typeof CreateReviewCycleBodySchema>;
export type CreateReviewCycleBodyInput = z.input<typeof CreateReviewCycleBodySchema>;

/** Il corpo di un passaggio di stato: solo la destinazione, mai lo stato di partenza —
 *  quello lo legge il servizio dal database, o un client potrebbe dichiararne uno falso. */
export const ReviewCycleTransitionBodySchema = z.object({
  to: ReviewCycleStatusSchema,
  note: z.string().max(500).optional(),
});
export type ReviewCycleTransitionBody = z.infer<typeof ReviewCycleTransitionBodySchema>;
