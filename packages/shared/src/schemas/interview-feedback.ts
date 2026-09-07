/**
 * packages/shared/src/schemas/interview-feedback.ts
 * Schemi per /v1/interview-feedback/* (sys.sys_interview_feedback).
 *
 * #54 F3, sesta fetta — la valutazione di chi ha condotto un colloquio.
 *
 * ⚠ La chiave esterna verso `sys_users` è quella dell'**intervistatore**, non del candidato:
 * il candidato non è un utente (è la scelta di F2, ed è la ragione per cui consenso e
 * scadenza di conservazione stanno su `sys_candidates` come colonne con un CHECK). Qui la
 * persona nominata è un dipendente dell'azienda con un incarico funzionale, e come tale la
 * FK è dichiarata nel registro GDPR dalla migrazione `000304`.
 *
 * Due vincoli del database che questo contratto rispecchia:
 *   · il punteggio, se dichiarato, sta **fra 0 e 10** con due decimali — è
 *     `sys_interview_feedback_score_check`, ricopiato perché contratto e database non
 *     possono divergere in silenzio;
 *   · una persona valuta un colloquio **una volta sola** —
 *     `sys_interview_feedback_unique (interview_id, interviewer_user_id)`. Una seconda
 *     valutazione non è un secondo parere, è una correzione: si fa con PATCH.
 *
 * ⚠ Il punteggio è **facoltativo** e la raccomandazione no. Non è una svista: un
 * intervistatore che dice «no» senza saper mettere un numero ha comunque espresso il
 * giudizio che serve alla decisione, mentre un numero senza raccomandazione non dice se
 * quel 6 significhi «avanti» o «basta così».
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi cinque di `sys_interview_feedback_recommendation_check`. */
export const FEEDBACK_RECOMMENDATIONS = [
  "STRONG_YES",
  "YES",
  "NEUTRAL",
  "NO",
  "STRONG_NO",
] as const;
export const FeedbackRecommendationSchema = z.enum(FEEDBACK_RECOMMENDATIONS);
export type FeedbackRecommendation = z.infer<typeof FeedbackRecommendationSchema>;

export const InterviewFeedbackSchema = z.object({
  feedbackId: z.uuid(),
  tenantId: z.uuid(),
  interviewId: z.uuid(),
  interviewerUserId: z.uuid(),
  recommendation: FeedbackRecommendationSchema,
  score: z.number().nullable(),
  notes: z.string().nullable(),
  submittedOn: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type InterviewFeedback = z.infer<typeof InterviewFeedbackSchema>;

export const InterviewFeedbackListQuerySchema = z.object({
  interviewId: z.uuid().optional(),
  interviewerUserId: z.uuid().optional(),
  recommendation: FeedbackRecommendationSchema.optional(),
  ...paginationFields(200, 50),
});
export type InterviewFeedbackListQuery = z.infer<typeof InterviewFeedbackListQuerySchema>;

export const InterviewFeedbackListResponseSchema = z.object({
  items: z.array(InterviewFeedbackSchema),
  total: z.number().int().min(0),
});
export type InterviewFeedbackListResponse = z.infer<typeof InterviewFeedbackListResponseSchema>;

export const InterviewFeedbackIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/interview-feedback — si registra la valutazione di un colloquio
 * (`job-requisition:manage`).
 *
 * ⚠ `interviewerUserId` si **dichiara**, non si deduce dall'attore. Chi conduce il ciclo di
 * selezione ha `job-requisition:manage` e registra anche le valutazioni di un panel a cui
 * non ha partecipato: dedurre l'intervistatore da chi scrive attribuirebbe a lui giudizi
 * che non sono suoi — e su una decisione di assunzione l'attribuzione è la sostanza.
 *
 * ⚠ `submittedOn` è facoltativa: se manca la scrive il **database** con `current_date`, mai
 * JavaScript. `toISOString()` è UTC e `current_date` è il fuso del server: dopo mezzanotte
 * locale dicono giorni diversi, e quel difetto è già costato un rosso comparso alle 00:30
 * nella quarta fetta.
 */
export const InterviewFeedbackCreateBodySchema = z.object({
  interviewId: z.uuid(),
  interviewerUserId: z.uuid(),
  recommendation: FeedbackRecommendationSchema.optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  submittedOn: z.iso.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type InterviewFeedbackCreateBody = z.infer<typeof InterviewFeedbackCreateBodySchema>;

/**
 * PATCH /v1/interview-feedback/:id — si corregge la propria valutazione
 * (`job-requisition:manage`).
 *
 * ⚠ Né `interviewId` né `interviewerUserId` sono modificabili. Spostare una valutazione su
 * un altro colloquio, o attribuirla a un'altra persona, non è una modifica: è la
 * fabbricazione di un giudizio che nessuno ha espresso. Il vincolo di unicità del database
 * non lo impedirebbe — le due colonne insieme resterebbero uniche.
 */
export const InterviewFeedbackUpdateBodySchema = z
  .object({
    recommendation: FeedbackRecommendationSchema.optional(),
    score: z.number().min(0).max(10).nullable().optional(),
    notes: z.string().max(20000).nullable().optional(),
    submittedOn: z.iso.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type InterviewFeedbackUpdateBody = z.infer<typeof InterviewFeedbackUpdateBodySchema>;
