/**
 * packages/shared/src/schemas/job-postings.ts
 * Schemi per /v1/job-postings/* (sys.sys_job_postings).
 *
 * #54 F3, seconda fetta. L'annuncio pende dalla RICHIESTA: `posting_requisition_id` e'
 * `NOT NULL` con `ON DELETE CASCADE`, quindi non esiste un annuncio senza il posto che
 * dichiara di voler coprire. E' la stessa catena che I1 impone piu' in alto — un annuncio
 * scollegato sarebbe un'offerta di lavoro senza un posto nell'organigramma.
 *
 * ⚠ `visibility` NON e' un dettaglio di presentazione: e' il confine fra il percorso
 * autenticato e quello pubblico di ADR-0026. `PUBLIC` significa che l'annuncio e'
 * leggibile da chi non ha un account, e quel percorso e' un'altra superficie (prospect).
 * Questo modulo espone la sola faccia AUTENTICATA; la vetrina pubblica, quando ci sara',
 * sara' un endpoint suo con il suo permesso — non un filtro passato da fuori.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi quattro di `sys_job_postings_status_check`. */
export const JOB_POSTING_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "EXPIRED"] as const;
export const JobPostingStatusSchema = z.enum(JOB_POSTING_STATUSES);
export type JobPostingStatus = z.infer<typeof JobPostingStatusSchema>;

/** Gli stessi tre di `sys_job_postings_visibility_check`. */
export const JOB_POSTING_VISIBILITIES = ["INTERNAL", "EXTERNAL", "PUBLIC"] as const;
export const JobPostingVisibilitySchema = z.enum(JOB_POSTING_VISIBILITIES);
export type JobPostingVisibility = z.infer<typeof JobPostingVisibilitySchema>;

export const JobPostingSchema = z.object({
  postingId: z.uuid(),
  tenantId: z.uuid(),
  requisitionId: z.uuid(),
  requisitionCode: z.string().nullable(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  visibility: JobPostingVisibilitySchema,
  status: JobPostingStatusSchema,
  publishedOn: z.string().nullable(),
  expiresOn: z.string().nullable(),
  location: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobPosting = z.infer<typeof JobPostingSchema>;

export const JobPostingListQuerySchema = z.object({
  status: JobPostingStatusSchema.optional(),
  visibility: JobPostingVisibilitySchema.optional(),
  requisitionId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type JobPostingListQuery = z.infer<typeof JobPostingListQuerySchema>;

export const JobPostingListResponseSchema = z.object({
  items: z.array(JobPostingSchema),
  total: z.number().int().min(0),
});
export type JobPostingListResponse = z.infer<typeof JobPostingListResponseSchema>;

export const JobPostingIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/job-postings — apertura (`job-requisition:manage`).
 * Il tenant NON si passa: si eredita dalla richiesta, che e' l'unica fonte possibile.
 * Passarlo a parte aprirebbe la strada a un annuncio in un tenant e a una richiesta in
 * un altro, cioe' a una riga che il database accetta e che non significa niente.
 * Come per la richiesta, `status` nasce `DRAFT`: pubblicare e' una decisione, non un campo.
 */
export const JobPostingCreateBodySchema = z.object({
  requisitionId: z.uuid(),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Codice maiuscolo, cifre, '-' '_'"),
  title: z.string().min(2).max(255),
  description: z.string().max(20000).nullable().optional(),
  visibility: JobPostingVisibilitySchema.optional(),
  publishedOn: z.iso.date().nullable().optional(),
  expiresOn: z.iso.date().nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type JobPostingCreateBody = z.infer<typeof JobPostingCreateBodySchema>;

/**
 * PATCH /v1/job-postings/:id — modifica parziale (`job-requisition:manage`).
 * `requisitionId` non e' modificabile, per la stessa ragione per cui non lo e' la
 * posizione di una richiesta: spostare un annuncio sotto un'altra richiesta non e' una
 * modifica, e' un altro annuncio.
 */
export const JobPostingUpdateBodySchema = z
  .object({
    title: z.string().min(2).max(255).optional(),
    description: z.string().max(20000).nullable().optional(),
    visibility: JobPostingVisibilitySchema.optional(),
    status: JobPostingStatusSchema.optional(),
    publishedOn: z.iso.date().nullable().optional(),
    expiresOn: z.iso.date().nullable().optional(),
    location: z.string().max(255).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type JobPostingUpdateBody = z.infer<typeof JobPostingUpdateBodySchema>;
