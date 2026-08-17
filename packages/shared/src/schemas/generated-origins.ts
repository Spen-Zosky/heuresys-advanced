/**
 * packages/shared/src/schemas/generated-origins.ts
 * IL REGISTRO DELL'ORIGINE (#198 T6, Tenant Builder P3 — S1067).
 *
 * Risponde a una domanda che nessun'altra superficie sa rispondere: **quanto di questa
 * azienda è ancora inventato?** Ogni riga creata da una costruzione lascia qui la sua
 * origine — quale tabella, quale record, quale versione di fascicolo, e la ragione.
 *
 * Perché non basta `metadata.materialized_from` (`#197`): quel marchio copre **3 tabelle su
 * 8** di quelle che il motore scrive, e su una riga senza marchio «non è stata generata» e
 * «è stata generata da un pezzo che non marca» sono indistinguibili. Un campo che risponde
 * «no» sia quando la risposta è no sia quando non sa, non è una fonte.
 *
 * Il permesso è `provenance:read`, che **esiste già** (mig `000171`, `PLATFORM_ADMIN` +
 * `TENANT_ADMIN`) ed è esattamente il diritto giusto: sapere quanto della propria azienda è
 * ancora provvisorio è informazione del cliente, non un segreto della piattaforma. Crearne
 * uno nuovo duplicherebbe un permesso esistente sulla stessa materia.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

/**
 * Lo stato di una riga generata. `GENERATED` = provvisoria, l'ha creata la costruzione ·
 * `CONFIRMED` = un dato vero l'ha presa in carico (sarà P4) · `SUPERSEDED` = una corsa
 * successiva l'ha sostituita. Sono i tre valori del `CHECK` in `sys` (mig `000319`).
 */
export const GeneratedOriginStatusEnum = z.enum(["GENERATED", "CONFIRMED", "SUPERSEDED"]);
export type GeneratedOriginStatus = z.infer<typeof GeneratedOriginStatusEnum>;

export const GeneratedOriginSchema = z.object({
  generatedRecordOriginId: z.uuid(),
  tenantId: z.uuid(),
  targetTable: z.string(),
  targetRecordId: z.uuid(),
  blueprintVersionId: z.uuid(),
  status: GeneratedOriginStatusEnum,
  supersededByRunId: z.uuid().nullable(),
  statusChangedAt: z.string().nullable(),
  /** La decisione che giustifica questa riga, scritta dalla sorgente che l'ha pianificata. */
  justification: z.string().nullable(),
  createdAt: z.string(),
});
export type GeneratedOrigin = z.infer<typeof GeneratedOriginSchema>;

export const GeneratedOriginListQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  targetTable: z.string().max(63).optional(),
  blueprintVersionId: z.uuid().optional(),
  status: GeneratedOriginStatusEnum.optional(),
  ...paginationFields(200, 50),
});
export type GeneratedOriginListQuery = z.infer<typeof GeneratedOriginListQuerySchema>;

export const GeneratedOriginListResponseSchema = z.object({
  items: z.array(GeneratedOriginSchema),
  total: z.number().int().min(0),
});
export type GeneratedOriginListResponse = z.infer<typeof GeneratedOriginListResponseSchema>;

export const GeneratedOriginSummaryQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  blueprintVersionId: z.uuid().optional(),
});

export const GeneratedOriginSummaryRowSchema = z.object({
  targetTable: z.string(),
  generated: z.number().int(),
  confirmed: z.number().int(),
  superseded: z.number().int(),
  total: z.number().int(),
});

export const GeneratedOriginSummaryResponseSchema = z.object({
  byTable: z.array(GeneratedOriginSummaryRowSchema),
  totals: z.object({
    generated: z.number().int(),
    confirmed: z.number().int(),
    superseded: z.number().int(),
    total: z.number().int(),
  }),
});
export type GeneratedOriginSummaryResponse = z.infer<typeof GeneratedOriginSummaryResponseSchema>;

/**
 * Il piano di costruzione, in sola lettura (`build-plan`). `willCreate` è quante righe
 * NASCEREBBERO, `alreadyThere` quante esistono già: la seconda non è un dettaglio, è ciò
 * che distingue una costruzione nuova da una ri-applicazione su un'azienda già popolata.
 */
export const BuildPlanPreviewSchema = z.object({
  sourceKey: z.string(),
  label: z.string(),
  tenantId: z.uuid(),
  willCreate: z.object({
    orgUnits: z.number().int(),
    positions: z.number().int(),
    users: z.number().int(),
    assignments: z.number().int(),
    skills: z.number().int(),
    kpis: z.number().int(),
    skillEvidence: z.number().int(),
    kpiEvidence: z.number().int(),
  }),
  alreadyThere: z.object({
    orgUnits: z.number().int(),
    positions: z.number().int(),
    users: z.number().int(),
    assignments: z.number().int(),
    skills: z.number().int(),
    kpis: z.number().int(),
    skillEvidence: z.number().int(),
    kpiEvidence: z.number().int(),
  }),
});
export type BuildPlanPreview = z.infer<typeof BuildPlanPreviewSchema>;

/**
 * L'esito di `apply`. **Non contiene conteggi di righe create, e non è una dimenticanza**:
 * `apply` NON costruisce — apre una richiesta di approvazione, e la costruzione avviene
 * quando quella richiesta viene approvata. Restituire numeri qui farebbe credere il
 * contrario a chi legge la risposta.
 */
export const ApplyVersionResponseSchema = z.object({
  approvalRequestId: z.uuid(),
  versionId: z.uuid(),
  status: z.string(),
});
export type ApplyVersionResponse = z.infer<typeof ApplyVersionResponseSchema>;
