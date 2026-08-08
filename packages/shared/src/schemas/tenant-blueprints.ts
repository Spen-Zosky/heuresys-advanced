/**
 * packages/shared/src/schemas/tenant-blueprints.ts
 *
 * Il fascicolo di configurazione di un'azienda (#131 Tenant Builder P1).
 *
 * Un fascicolo nasce PRIMA dell'azienda — durante una trattativa non c'e' ancora
 * un tenant a cui legarlo — e vive per versioni: si compone, si ancora a una
 * versione di un modello di settore, si sottopone alla firma. Da qui il
 * `tenantId` che puo' essere `null` e la versione come oggetto di primo piano.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
// La scala di vigilanza NON si ridichiara qui: e' la stessa che descrive il
// profilo di tipizzazione di un'azienda, e due definizioni della stessa scala
// sono due fonti di verita' destinate a divergere. Si importa quella.
import { RegulatoryIntensitySchema } from "./enterprise-typing-profiles.js";

export const TENANT_BLUEPRINT_VERSION_STATUS_VALUES = [
  "DRAFT",
  "IN_APPROVAL",
  "APPROVED",
  "APPLIED",
  "SUPERSEDED",
  "ABANDONED",
] as const;
export const TenantBlueprintVersionStatusSchema = z.enum(TENANT_BLUEPRINT_VERSION_STATUS_VALUES);
export type TenantBlueprintVersionStatus = z.infer<typeof TenantBlueprintVersionStatusSchema>;

/** Stesso dominio degli scostamenti che esistono gia': i valori non si sdoppiano. */
export const PROCESS_INCLUSION_VALUES = ["IN", "PARTIAL", "OUT"] as const;
export const ProcessInclusionSchema = z.enum(PROCESS_INCLUSION_VALUES);
export type ProcessInclusion = z.infer<typeof ProcessInclusionSchema>;

export const TenantBlueprintSchema = z.object({
  tenantBlueprintId: z.uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  tenantId: z.uuid().nullable(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
  currentVersionId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TenantBlueprint = z.infer<typeof TenantBlueprintSchema>;

export const BlueprintIdentitySchema = z.object({
  industryClassId: z.uuid().nullable(),
  sizeBandId: z.uuid().nullable(),
  operatingModelId: z.uuid().nullable(),
  regulatoryIntensity: RegulatoryIntensitySchema.nullable(),
  countryCode: z.string().length(2).nullable(),
  employeeCount: z.number().int().min(0).nullable(),
  revenueEur: z.number().min(0).nullable(),
});
export type BlueprintIdentity = z.infer<typeof BlueprintIdentitySchema>;

export const ProcessDecisionSchema = z.object({
  processId: z.uuid(),
  processCode: z.string(),
  processName: z.string(),
  ordinal: z.number().int(),
  /** null = nessuna decisione esplicita: vale il modello (R1). */
  inclusion: ProcessInclusionSchema.nullable(),
  rationale: z.string().nullable(),
});
export type ProcessDecision = z.infer<typeof ProcessDecisionSchema>;

export const TenantBlueprintVersionSchema = z.object({
  tenantBlueprintVersionId: z.uuid(),
  blueprintId: z.uuid(),
  number: z.number().int().min(1),
  status: TenantBlueprintVersionStatusSchema,
  variantVersionId: z.uuid().nullable(),
  identity: BlueprintIdentitySchema,
  approvedAt: z.iso.datetime().nullable(),
  appliedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TenantBlueprintVersion = z.infer<typeof TenantBlueprintVersionSchema>;

/** R4: se non c'e' un modello lo si dice, non si ripiega sul piu' vicino. */
export const ModelProposalResponseSchema = z.discriminatedUnion("available", [
  z.object({
    available: z.literal(true),
    variantVersionId: z.uuid(),
    variantCode: z.string(),
    variantName: z.string(),
    versionNumber: z.number().int(),
    processCount: z.number().int(),
    matchedOn: z.object({ industryFamilyCode: z.string(), sizeBandCode: z.string() }),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string(),
    availableCombinations: z.array(
      z.object({
        industryFamilyCode: z.string(),
        sizeBandCode: z.string(),
        variantCode: z.string(),
      }),
    ),
  }),
]);
export type ModelProposalResponse = z.infer<typeof ModelProposalResponseSchema>;

export const BlueprintDiffResponseSchema = z.object({
  model: z.object({
    changed: z.boolean(),
    fromVersionNumber: z.number().int().nullable(),
    toVersionNumber: z.number().int().nullable(),
    processesAdded: z.array(z.string()),
    processesRemoved: z.array(z.string()),
    processesRenamed: z.array(
      z.object({ code: z.string(), from: z.string(), to: z.string() }),
    ),
  }),
  decisions: z.object({
    added: z.array(ProcessDecisionSchema),
    removed: z.array(ProcessDecisionSchema),
    changed: z.array(
      z.object({
        processCode: z.string(),
        fromInclusion: ProcessInclusionSchema,
        toInclusion: ProcessInclusionSchema,
        fromRationale: z.string(),
        toRationale: z.string(),
      }),
    ),
    identityChanged: z.array(
      z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
    ),
  }),
  /**
   * Cosa succederebbe all'azienda gia' costruita. In P1 NON e' calcolabile, e
   * si dichiara. Uno zero verrebbe letto come «nessuna conseguenza», che e' il
   * contrario della verita'.
   */
  impact: z.object({ computable: z.literal(false), reason: z.string() }),
});
export type BlueprintDiffResponse = z.infer<typeof BlueprintDiffResponseSchema>;

export const CreateTenantBlueprintBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  tenantId: z.uuid().nullable().optional(),
});
export type CreateTenantBlueprintBody = z.infer<typeof CreateTenantBlueprintBodySchema>;

export const UpdateTenantBlueprintBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});
export type UpdateTenantBlueprintBody = z.infer<typeof UpdateTenantBlueprintBodySchema>;

export const LinkTenantBodySchema = z.object({ tenantId: z.uuid() });
export type LinkTenantBody = z.infer<typeof LinkTenantBodySchema>;

/** Tutti i campi facoltativi: una bozza incompleta deve poter essere salvata. */
export const PatchIdentityBodySchema = BlueprintIdentitySchema.partial();
export type PatchIdentityBody = z.infer<typeof PatchIdentityBodySchema>;

export const PinModelBodySchema = z.object({ variantVersionId: z.uuid() });
export type PinModelBody = z.infer<typeof PinModelBodySchema>;

export const PutProcessDecisionBodySchema = z.object({
  inclusion: ProcessInclusionSchema,
  rationale: z.string().trim().min(1, "una decisione senza motivazione non e' una decisione"),
});
export type PutProcessDecisionBody = z.infer<typeof PutProcessDecisionBodySchema>;

export const TenantBlueprintListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  tenantId: z.uuid().optional(),
  linked: z.enum(["yes", "no"]).optional(),
  ...paginationFields(200, 50),
});
export type TenantBlueprintListQuery = z.infer<typeof TenantBlueprintListQuerySchema>;

export const TenantBlueprintListResponseSchema = z.object({
  items: z.array(TenantBlueprintSchema),
  total: z.number().int().min(0),
});

/** L'intestazione di un fascicolo con tutte le sue versioni. */
export const TenantBlueprintDetailSchema = TenantBlueprintSchema.extend({
  versions: z.array(TenantBlueprintVersionSchema),
});
export type TenantBlueprintDetail = z.infer<typeof TenantBlueprintDetailSchema>;

export const ProcessDecisionListResponseSchema = z.object({
  items: z.array(ProcessDecisionSchema),
});
export const TenantBlueprintVersionListResponseSchema = z.object({
  items: z.array(TenantBlueprintVersionSchema),
});
export const TenantBlueprintIdParamSchema = z.object({ id: z.uuid() });
export const VersionParamSchema = z.object({
  id: z.uuid(),
  number: z.coerce.number().int().min(1),
});
export const ProcessParamSchema = VersionParamSchema.extend({ processId: z.uuid() });
export const DiffQuerySchema = z.object({
  against: z.union([z.coerce.number().int().min(1), z.literal("MODEL_LATEST")]),
});

/** La sottomissione apre una richiesta di approvazione: se ne restituisce l'identificativo. */
export const SubmitVersionResponseSchema = z.object({
  approvalRequestId: z.uuid(),
  version: TenantBlueprintVersionSchema,
});
export type SubmitVersionResponse = z.infer<typeof SubmitVersionResponseSchema>;
