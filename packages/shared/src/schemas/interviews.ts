/**
 * packages/shared/src/schemas/interviews.ts
 * Schemi per /v1/interviews/* (sys.sys_interviews).
 *
 * #54 F3, quinta fetta — il colloquio si appende a una CANDIDATURA, non a una persona, e la
 * differenza è di sostanza: la stessa persona può candidarsi a due annunci, e i colloqui
 * dell'uno non sono quelli dell'altro. Lo dice anche la chiave esterna, che punta a
 * `sys_candidate_applications` e non a `sys_candidates`.
 *
 * ⚠ E porta un `ON DELETE CASCADE`: cancellare una candidatura porterebbe via i suoi
 * colloqui. È una ragione in più per cui il modulo delle candidature non espone DELETE — la
 * cascata esiste per l'integrità del modello, non per essere usata.
 *
 * Due vincoli del database che questo contratto rispecchia:
 *   · la durata, se dichiarata, è **positiva** — un colloquio di zero minuti non è un dato,
 *     è un errore di digitazione;
 *   · i cinque tipi e i quattro stati sono quelli dei CHECK, ricopiati perché il contratto
 *     e il database non possono divergere in silenzio.
 *
 * ⚠ La data è **facoltativa**, e non è una dimenticanza: un colloquio si registra anche
 * prima di avere una data (`SCHEDULED` senza `scheduledAt` = «da fissare»). Pretenderla in
 * creazione obbligherebbe a inventarne una, e una data inventata è peggio di una assente
 * perché nessuno saprà più distinguerla da una vera.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi cinque di `sys_interviews_kind_check`. */
export const INTERVIEW_KINDS = [
  "SCREENING",
  "TECHNICAL",
  "BEHAVIORAL",
  "PANEL",
  "FINAL",
] as const;
export const InterviewKindSchema = z.enum(INTERVIEW_KINDS);
export type InterviewKind = z.infer<typeof InterviewKindSchema>;

/** Gli stessi quattro di `sys_interviews_status_check`. */
export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export const InterviewStatusSchema = z.enum(INTERVIEW_STATUSES);
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;

export const InterviewSchema = z.object({
  interviewId: z.uuid(),
  tenantId: z.uuid(),
  applicationId: z.uuid(),
  kind: InterviewKindSchema,
  status: InterviewStatusSchema,
  scheduledAt: z.iso.datetime().nullable(),
  durationMin: z.number().int().nullable(),
  location: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Interview = z.infer<typeof InterviewSchema>;

export const InterviewListQuerySchema = z.object({
  applicationId: z.uuid().optional(),
  kind: InterviewKindSchema.optional(),
  status: InterviewStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type InterviewListQuery = z.infer<typeof InterviewListQuerySchema>;

export const InterviewListResponseSchema = z.object({
  items: z.array(InterviewSchema),
  total: z.number().int().min(0),
});
export type InterviewListResponse = z.infer<typeof InterviewListResponseSchema>;

export const InterviewIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/interviews — si fissa un colloquio su una candidatura
 * (`job-requisition:manage`).
 *
 * Nasce `SCHEDULED`: uno stato terminale non si registra in creazione. Un colloquio nato
 * `COMPLETED` non è mai stato fissato, e la sua storia — che è ciò che questo modulo
 * conserva — non esisterebbe.
 */
export const InterviewCreateBodySchema = z.object({
  applicationId: z.uuid(),
  kind: InterviewKindSchema,
  /** Assente = «da fissare». Vedi la nota in testa: una data inventata è peggio di una assente. */
  scheduledAt: z.iso.datetime().nullable().optional(),
  durationMin: z.number().int().positive().max(1440).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type InterviewCreateBody = z.infer<typeof InterviewCreateBodySchema>;

/**
 * PATCH /v1/interviews/:id — riprogrammazione ed esito (`job-requisition:manage`).
 *
 * ⚠ `applicationId` NON è modificabile: un colloquio appartiene alla candidatura per cui è
 * stato fissato, e spostarlo altrove riscriverebbe la storia di due selezioni insieme.
 *
 * ⚠ E il controllo «un colloquio COMPLETED deve avere una data» NON sta qui: questo schema
 * guarda il corpo e non sa se la data è già sulla riga. È la lezione della quarta fetta,
 * dove un `refine` messo nel posto sbagliato respingeva un caso legittimo. Il controllo vive
 * nel service, che legge la riga.
 */
export const InterviewUpdateBodySchema = z
  .object({
    kind: InterviewKindSchema.optional(),
    status: InterviewStatusSchema.optional(),
    scheduledAt: z.iso.datetime().nullable().optional(),
    durationMin: z.number().int().positive().max(1440).nullable().optional(),
    location: z.string().max(255).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type InterviewUpdateBody = z.infer<typeof InterviewUpdateBodySchema>;
