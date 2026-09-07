/**
 * packages/shared/src/schemas/candidate-applications.ts
 * Schemi per /v1/candidate-applications/* (sys.sys_candidate_applications).
 *
 * #54 F3, quarta fetta — ed è la CERNIERA del ciclo: una candidatura è ciò che lega una
 * persona (`sys_candidates`) a un annuncio (`sys_job_postings`). Le tre fette precedenti
 * hanno costruito i due capi; questa costruisce il legame, e senza di essa il recruiting
 * resta un elenco di persone accanto a un elenco di annunci.
 *
 * Tre vincoli del database che questo contratto rispecchia, e nessuno è decorativo:
 *   · `stage = 'REJECTED'` **impone** `rejectReason` — un rifiuto senza motivo è uno stato
 *     impossibile, non «da compilare più tardi». Lo dice un CHECK, non una convenzione;
 *   · `closedOn >= appliedOn` — una candidatura non si chiude prima di essere arrivata;
 *   · le sette fasi sono quelle di `sys_candidate_applications_stage_check`, e questo elenco
 *     le ricopia perché il contratto e il database non possono divergere in silenzio.
 *
 * ⚠ E una scelta che vale la pena nominare: la fase **non è un percorso obbligato**. Il
 * database ammette qualunque transizione, e il contratto non ne inventa uno: una candidatura
 * può passare da `APPLIED` a `HIRED` senza toccare le fasi intermedie, perché nella realtà
 * capita (un rientro, una posizione urgente). Imporre qui una macchina a stati che il
 * database non ha significherebbe avere DUE verità sullo stesso fatto — è lo stesso difetto
 * che `#143` registra sulle due fonti del «capo funzionale».
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Le stesse sette di `sys_candidate_applications_stage_check`. */
export const APPLICATION_STAGES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export const ApplicationStageSchema = z.enum(APPLICATION_STAGES);
export type ApplicationStage = z.infer<typeof ApplicationStageSchema>;

export const CandidateApplicationSchema = z.object({
  applicationId: z.uuid(),
  tenantId: z.uuid(),
  candidateId: z.uuid(),
  postingId: z.uuid(),
  stage: ApplicationStageSchema,
  appliedOn: z.string(),
  closedOn: z.string().nullable(),
  rejectReason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CandidateApplication = z.infer<typeof CandidateApplicationSchema>;

export const CandidateApplicationListQuerySchema = z.object({
  stage: ApplicationStageSchema.optional(),
  candidateId: z.uuid().optional(),
  postingId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type CandidateApplicationListQuery = z.infer<typeof CandidateApplicationListQuerySchema>;

export const CandidateApplicationListResponseSchema = z.object({
  items: z.array(CandidateApplicationSchema),
  total: z.number().int().min(0),
});
export type CandidateApplicationListResponse = z.infer<
  typeof CandidateApplicationListResponseSchema
>;

export const CandidateApplicationIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/candidate-applications — una persona si candida a un annuncio
 * (`job-requisition:manage`).
 *
 * Nasce `APPLIED`: la fase non si sceglie in creazione. Registrare una candidatura già
 * `HIRED` salterebbe ogni traccia del percorso, e il percorso è il valore di questo modulo —
 * senza, resterebbe una tabella di esiti senza storia.
 */
export const CandidateApplicationCreateBodySchema = z.object({
  candidateId: z.uuid(),
  postingId: z.uuid(),
  /** Assente = oggi. Ammessa nel passato: le candidature si registrano anche a posteriori. */
  appliedOn: z.iso.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type CandidateApplicationCreateBody = z.infer<
  typeof CandidateApplicationCreateBodySchema
>;

/**
 * PATCH /v1/candidate-applications/:id — avanzamento (`job-requisition:manage`).
 *
 * ⚠ `candidateId` e `postingId` NON sono modificabili: sono l'identità stessa della
 * candidatura. Spostarla su un altro annuncio ne farebbe un'altra, e la storia della prima
 * sparirebbe senza che nessuno se ne accorga. Per un annuncio diverso si registra una
 * candidatura nuova — che è anche ciò che è accaduto nella realtà.
 *
 * ⚠ Il rifiuto senza motivo NON è respinto qui, ed è una correzione fatta dopo che il test
 * l'ha smentito. La prima stesura portava un `refine` «se `stage` è REJECTED allora
 * `rejectReason` non è vuoto», che sembrava prudente e invece **respingeva un caso
 * legittimo**: una candidatura che ha già il suo motivo sulla riga e cambia solo fase, cioè
 * `PATCH {stage:"REJECTED"}` da solo. Lo schema guarda il CORPO e non conosce lo stato di
 * arrivo, quindi non può decidere. Il controllo vive dove l'informazione c'è — nel service,
 * che legge la riga e risponde 409 — con il CHECK del database come ultima rete.
 * Un presidio messo dove non ha i dati per giudicare non è un presidio in più: è un rifiuto
 * sbagliato in più.
 */
export const CandidateApplicationUpdateBodySchema = z
  .object({
    stage: ApplicationStageSchema.optional(),
    closedOn: z.iso.date().nullable().optional(),
    rejectReason: z.string().max(512).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type CandidateApplicationUpdateBody = z.infer<
  typeof CandidateApplicationUpdateBodySchema
>;
