/**
 * packages/shared/src/schemas/job-requisitions.ts
 * Schemi per /v1/job-requisitions/* (sys.sys_job_requisitions).
 *
 * #54 F3 — la prima fetta del ciclo di recruiting. La richiesta di personale e' la RADICE:
 * tutto il resto del ciclo (annunci, candidature, colloqui, offerte) le sta appeso sotto.
 *
 * ⚠ I1 NON E' UN COMMENTO, E' UN VINCOLO. `requisition_position_id` e' `NOT NULL` nello
 * schema (mig 000364): si copre un POSTO dell'organigramma, non si assume una persona.
 * Percio' `positionId` e' obbligatorio anche qui, e non `.optional()`: se il contratto lo
 * ammettesse nullo, l'API accetterebbe una richiesta che il database rifiuta — cioe' un
 * 500 al posto di un 400, e un modello che I1 vieta travestito da campo facoltativo.
 *
 * Gli stati e i motivi ricalcano i CHECK della tabella, uno per uno. Sono discriminatori
 * TS-side (RD-08: mai un ENUM di PostgreSQL), e se la tabella ne guadagna uno vanno
 * aggiunti qui — o il contratto rifiuta un valore che il database accetta.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Gli stessi sei di `sys_job_requisitions_status_check`. */
export const JOB_REQUISITION_STATUSES = [
  "DRAFT",
  "APPROVED",
  "OPEN",
  "ON_HOLD",
  "FILLED",
  "CANCELLED",
] as const;
export const JobRequisitionStatusSchema = z.enum(JOB_REQUISITION_STATUSES);
export type JobRequisitionStatus = z.infer<typeof JobRequisitionStatusSchema>;

/** Gli stessi cinque di `sys_job_requisitions_reason_check`. */
export const JOB_REQUISITION_REASONS = [
  "NEW_ROLE",
  "REPLACEMENT",
  "GROWTH",
  "TEMPORARY",
  "INTERNAL_MOBILITY",
] as const;
export const JobRequisitionReasonSchema = z.enum(JOB_REQUISITION_REASONS);
export type JobRequisitionReason = z.infer<typeof JobRequisitionReasonSchema>;

export const JobRequisitionSchema = z.object({
  requisitionId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  positionId: z.uuid(),
  positionTitle: z.string().nullable(),
  headcount: z.number().int().min(1),
  status: JobRequisitionStatusSchema,
  reason: JobRequisitionReasonSchema.nullable(),
  openedOn: z.string().nullable(),
  targetStart: z.string().nullable(),
  closedOn: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobRequisition = z.infer<typeof JobRequisitionSchema>;

export const JobRequisitionListQuerySchema = z.object({
  status: JobRequisitionStatusSchema.optional(),
  positionId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type JobRequisitionListQuery = z.infer<typeof JobRequisitionListQuerySchema>;

export const JobRequisitionListResponseSchema = z.object({
  items: z.array(JobRequisitionSchema),
  total: z.number().int().min(0),
});
export type JobRequisitionListResponse = z.infer<typeof JobRequisitionListResponseSchema>;

export const JobRequisitionIdParamSchema = z.object({ id: z.uuid() });

/**
 * POST /v1/job-requisitions — apertura (`job-requisition:manage`).
 * Gli attori non-platform creano nel proprio tenant; `PLATFORM_ADMIN` puo' passare `tenantId`.
 * `status` non si accetta in creazione: una richiesta nasce `DRAFT` e cambia stato per PATCH.
 * Il ciclo di vita e' una successione di decisioni, non un campo che si scrive all'inizio.
 */
export const JobRequisitionCreateBodySchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Codice maiuscolo, cifre, '-' '_'"),
  positionId: z.uuid(),
  headcount: z.number().int().min(1).max(999).optional(),
  reason: JobRequisitionReasonSchema.nullable().optional(),
  openedOn: z.iso.date().nullable().optional(),
  targetStart: z.iso.date().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.uuid().optional(),
});
export type JobRequisitionCreateBody = z.infer<typeof JobRequisitionCreateBodySchema>;

/**
 * PATCH /v1/job-requisitions/:id — modifica parziale (`job-requisition:manage`).
 * `positionId` NON e' modificabile: cambiare il posto coperto non e' una modifica della
 * richiesta, e' un'altra richiesta — e lasciarlo mutabile scollegherebbe dall'organigramma
 * le candidature gia' appese sotto.
 */
export const JobRequisitionUpdateBodySchema = z
  .object({
    headcount: z.number().int().min(1).max(999).optional(),
    status: JobRequisitionStatusSchema.optional(),
    reason: JobRequisitionReasonSchema.nullable().optional(),
    openedOn: z.iso.date().nullable().optional(),
    targetStart: z.iso.date().nullable().optional(),
    closedOn: z.iso.date().nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "Almeno un campo dev'essere fornito" });
export type JobRequisitionUpdateBody = z.infer<typeof JobRequisitionUpdateBodySchema>;
