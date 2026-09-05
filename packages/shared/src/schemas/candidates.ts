/**
 * packages/shared/src/schemas/candidates.ts
 * Schemi per /v1/candidates/* (sys.sys_candidates).
 *
 * #54 F3, terza fetta — e la piu' delicata delle sette.
 *
 * ⚠⚠ UN CANDIDATO NON E' UN UTENTE, e la conseguenza e' di sostanza. Il registro GDPR
 * sorveglia le FK verso `sys_users` e **non vedrebbe `sys_candidates`**: la guardia
 * resterebbe verde su dati personali di persone reali — nome, cognome, indirizzo di posta,
 * telefono — che nessun altro presidio del sistema copre. Per questo il consenso e la
 * scadenza di conservazione sono **colonne con un CHECK** e non una riga in un documento
 * (F2 lo dichiara esplicitamente), e per questo il contratto qui sotto li tratta come
 * campi di prim'ordine invece che come metadati facoltativi.
 *
 * Tre vincoli del database che questo contratto rispecchia, e nessuno e' decorativo:
 *   · `retention_until >= consent_given_on` — non si conserva un dato da prima di averne
 *     avuto il permesso;
 *   · `status = 'HIRED'` **impone** `hired_user_id` — un assunto senza l'utente nato
 *     dall'assunzione e' uno stato impossibile, non «da controllare»;
 *   · l'indirizzo di posta e' **unico dentro il tenant**: la stessa persona non esiste due
 *     volte nella stessa azienda.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi sei di `sys_candidates_source_check`. */
export const CANDIDATE_SOURCES = [
  "DIRECT",
  "REFERRAL",
  "AGENCY",
  "JOB_BOARD",
  "INTERNAL",
  "EVENT",
] as const;
export const CandidateSourceSchema = z.enum(CANDIDATE_SOURCES);
export type CandidateSource = z.infer<typeof CandidateSourceSchema>;

/** Gli stessi cinque di `sys_candidates_status_check`. */
export const CANDIDATE_STATUSES = [
  "ACTIVE",
  "HIRED",
  "WITHDRAWN",
  "BLACKLISTED",
  "ARCHIVED",
] as const;
export const CandidateStatusSchema = z.enum(CANDIDATE_STATUSES);
export type CandidateStatus = z.infer<typeof CandidateStatusSchema>;

export const CandidateSchema = z.object({
  candidateId: z.uuid(),
  tenantId: z.uuid(),
  externalCode: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  source: CandidateSourceSchema,
  status: CandidateStatusSchema,
  consentGivenOn: z.string().nullable(),
  retentionUntil: z.string().nullable(),
  hiredUserId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidateListQuerySchema = z.object({
  status: CandidateStatusSchema.optional(),
  source: CandidateSourceSchema.optional(),
  ...paginationFields(200, 50),
});
export type CandidateListQuery = z.infer<typeof CandidateListQuerySchema>;

export const CandidateListResponseSchema = z.object({
  items: z.array(CandidateSchema),
  total: z.number().int().min(0),
});
export type CandidateListResponse = z.infer<typeof CandidateListResponseSchema>;

export const CandidateIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/candidates — registrazione (`job-requisition:manage`).
 * Nasce `ACTIVE`: `HIRED` non si scrive in creazione, perche' pretende l'utente nato
 * dall'assunzione e quell'utente a quel punto non esiste ancora.
 */
export const CandidateCreateBodySchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.email().max(320),
  phone: z.string().max(64).nullable().optional(),
  source: CandidateSourceSchema,
  externalCode: z.string().max(128).nullable().optional(),
  consentGivenOn: z.iso.date().nullable().optional(),
  retentionUntil: z.iso.date().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type CandidateCreateBody = z.infer<typeof CandidateCreateBodySchema>;

/**
 * PATCH /v1/candidates/:id — modifica parziale (`job-requisition:manage`).
 * L'indirizzo di posta **non e' modificabile**: e' la chiave naturale dentro il tenant, e
 * cambiarlo trasformerebbe una persona in un'altra lasciando appese le sue candidature.
 * Per correggere un indirizzo sbagliato si archivia e si registra la persona giusta.
 */
export const CandidateUpdateBodySchema = z
  .object({
    firstName: z.string().min(1).max(255).optional(),
    lastName: z.string().min(1).max(255).optional(),
    phone: z.string().max(64).nullable().optional(),
    source: CandidateSourceSchema.optional(),
    status: CandidateStatusSchema.optional(),
    externalCode: z.string().max(128).nullable().optional(),
    consentGivenOn: z.iso.date().nullable().optional(),
    retentionUntil: z.iso.date().nullable().optional(),
    /** Obbligatorio quando `status` diventa `HIRED`: lo impone un CHECK del database. */
    hiredUserId: z.uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type CandidateUpdateBody = z.infer<typeof CandidateUpdateBodySchema>;
