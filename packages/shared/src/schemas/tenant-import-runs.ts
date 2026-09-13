/**
 * packages/shared/src/schemas/tenant-import-runs.ts
 * #206 — Tenant Builder P4: le persone vere entrano nell'azienda che P3 ha costruito.
 *
 * Tre atti, tre contratti: (1) registrare un'ESTRAZIONE dal sistema del cliente come fonte con
 * impronta — le righe atterrano senza tipi; (2) aprire una CORSA su quella fonte, che valida ogni
 * persona contro il profilo atteso della posizione (E19) e produce un referto; (3) SOTTOMETTERE la
 * corsa alla firma (E26): l'iniezione la fa l'effetto di approvazione `TENANT_IMPORT_RUN`.
 *
 * ⚠ La riga di una persona e' TUTTA STRINGHE, di proposito: e' la tabella di atterraggio
 *   (`staging.tenant_import_people`) tradotta in contratto. Una data come '31/02/2024' deve poter
 *   entrare, e il fallimento avra' un nome nella validazione — non un 400 anonimo qui.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";

/** Un campo del cliente: testo libero, o assente. Nessun formato imposto in ingresso. */
const campo = z.string().max(1024).nullable().optional();

/** Le colonne di `staging.tenant_import_people` che arrivano dal cliente, una per una. */
export const TenantImportRowSchema = z.object({
  external_id: campo,
  email: campo,
  personal_email: campo,
  first_name: campo,
  middle_name: campo,
  last_name: campo,
  job_title: campo,
  department: campo,
  location: campo,
  position_code: campo,
  org_unit_code: campo,
  manager_external_id: campo,
  pernr: campo,
  hire_date: campo,
  seniority_date: campo,
  is_active: campo,
  employment_status: campo,
  phone_mobile: campo,
  phone_work: campo,
  address_street: campo,
  address_city: campo,
  address_postal_code: campo,
  address_country: campo,
  /** Codici di competenza dichiarati dal cliente, separati da ';'. */
  skill_codes: campo,
});
export type TenantImportRow = z.infer<typeof TenantImportRowSchema>;

export const TENANT_IMPORT_ROW_COLUMNS = Object.keys(TenantImportRowSchema.shape) as ReadonlyArray<
  keyof TenantImportRow
>;

// ---------------------------------------------------------------------------
// (1) La fonte: un'estrazione registrata con impronta.
// ---------------------------------------------------------------------------

export const TenantImportSourceSchema = z.object({
  sourceExportId: z.uuid(),
  name: z.string(),
  /** sha-256 esadecimale del contenuto canonico: e' lei che rende la corsa idempotente. */
  fileHash: z.string().length(64),
  retrievedAt: z.iso.datetime(),
  sizeBytes: z.number().int().min(0),
  status: z.enum(["AVAILABLE", "INGESTED", "ARCHIVED", "CORRUPTED"]),
  /** Quante righe sono atterrate per questa fonte. */
  rowCount: z.number().int().min(0),
});
export type TenantImportSource = z.infer<typeof TenantImportSourceSchema>;

export const RegisterTenantImportSourceBodySchema = z.object({
  name: z.string().min(1).max(255),
  rows: z.array(TenantImportRowSchema).min(1).max(5000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type RegisterTenantImportSourceBody = z.infer<typeof RegisterTenantImportSourceBodySchema>;

export const RegisterTenantImportSourceResponseSchema = z.object({
  source: TenantImportSourceSchema,
  /**
   * `true` quando lo stesso CONTENUTO era gia' registrato — con qualunque nome. La fonte
   * restituita e' quella esistente e nessuna riga e' atterrata di nuovo.
   */
  alreadyRegistered: z.boolean(),
});
export type RegisterTenantImportSourceResponse = z.infer<typeof RegisterTenantImportSourceResponseSchema>;

// ---------------------------------------------------------------------------
// (2) La corsa: validazione contro il profilo atteso (E19) e referto.
// ---------------------------------------------------------------------------

/** L'esito E19 di una persona per la sua posizione. `CIECA` non e' «a posto»: e' «niente da controllare». */
export const E19_ESITO_VALUES = ["AMMESSA", "AMMESSA_CON_SCOSTAMENTO", "CIECA"] as const;
export const E19EsitoSchema = z.enum(E19_ESITO_VALUES);
export type E19Esito = z.infer<typeof E19EsitoSchema>;

export const TENANT_IMPORT_RULE_CODES = [
  "PERSON_EMAIL",
  "PERSON_NOT_YET_PRESENT",
  "POSITION_EXISTS",
  "POSITION_VACANT",
  "HIRE_DATE_PARSEABLE",
  "E19_CRITICAL_SKILL_COVERAGE",
] as const;
export const TenantImportRuleCodeSchema = z.enum(TENANT_IMPORT_RULE_CODES);
export type TenantImportRuleCode = z.infer<typeof TenantImportRuleCodeSchema>;

export const TenantImportValidationSchema = z.object({
  ruleCode: TenantImportRuleCodeSchema,
  status: z.enum(["PASSED", "FAILED", "WARNING", "SKIPPED"]),
  message: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type TenantImportValidation = z.infer<typeof TenantImportValidationSchema>;

export const TenantImportCandidateSchema = z.object({
  candidateId: z.uuid(),
  rowNo: z.number().int().min(1),
  naturalKey: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  positionCode: z.string().nullable(),
  positionId: z.uuid().nullable(),
  /** PENDING | PASSED | WARNING | FAILED | APPLIED (il vocabolario di `sys_seed_candidate_records`). */
  status: z.string(),
  e19: E19EsitoSchema.nullable(),
  validations: z.array(TenantImportValidationSchema),
});
export type TenantImportCandidate = z.infer<typeof TenantImportCandidateSchema>;

/** Il referto: numeri che si RI-DERIVANO dai candidati, mai scritti a mano. */
export const TenantImportRefertoSchema = z.object({
  persone: z.number().int().min(0),
  ammesse: z.number().int().min(0),
  conScostamento: z.number().int().min(0),
  /** Posizioni senza requisiti CRITICAL: una verifica cieca, dichiarata tale. */
  cieche: z.number().int().min(0),
  /** Persone che NON entreranno (una regola FAILED): sono le eccezioni elencate nella firma. */
  escluse: z.number().int().min(0),
});
export type TenantImportReferto = z.infer<typeof TenantImportRefertoSchema>;

export const TENANT_IMPORT_RUN_STATUS_VALUES = ["RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export const TenantImportRunStatusSchema = z.enum(TENANT_IMPORT_RUN_STATUS_VALUES);
export type TenantImportRunStatus = z.infer<typeof TenantImportRunStatusSchema>;

export const TenantImportRunSchema = z.object({
  runId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  sourceExportId: z.uuid(),
  status: TenantImportRunStatusSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  referto: TenantImportRefertoSchema,
  /** La richiesta di approvazione aperta per questa corsa, se e' stata sottomessa. */
  approvalRequestId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type TenantImportRun = z.infer<typeof TenantImportRunSchema>;

export const TenantImportRunDetailSchema = TenantImportRunSchema.extend({
  candidates: z.array(TenantImportCandidateSchema),
});
export type TenantImportRunDetail = z.infer<typeof TenantImportRunDetailSchema>;

export const CreateTenantImportRunBodySchema = z.object({
  sourceExportId: z.uuid(),
  /** Solo per PLATFORM_ADMIN: l'azienda di destinazione. Gli altri importano nella propria. */
  tenantId: z.uuid().optional(),
});
export type CreateTenantImportRunBody = z.infer<typeof CreateTenantImportRunBodySchema>;

export const TenantImportRunListQuerySchema = z.object({
  status: TenantImportRunStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type TenantImportRunListQuery = z.infer<typeof TenantImportRunListQuerySchema>;

export const TenantImportRunListResponseSchema = z.object({
  items: z.array(TenantImportRunSchema),
  total: z.number().int().min(0),
});

export const TenantImportRunIdParamSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------
// (3) La firma (E26): si firma la CORSA, non la persona.
// ---------------------------------------------------------------------------

export const SubmitTenantImportRunResponseSchema = z.object({
  approvalRequestId: z.uuid(),
  runId: z.uuid(),
  /** Le eccezioni che la firma include, nominate: chi non entra e chi entra con scostamento. */
  referto: TenantImportRefertoSchema,
});
export type SubmitTenantImportRunResponse = z.infer<typeof SubmitTenantImportRunResponseSchema>;
