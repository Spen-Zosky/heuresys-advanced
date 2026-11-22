/**
 * packages/shared/src/schemas/blueprint-processes.ts
 * Process registry rows scoped to a blueprint variant.
 * Unique (variant_id, code).
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const BlueprintProcessSchema = z.object({
  blueprintProcessId: z.uuid(),
  variantId: z.uuid(),
  variantVersionId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  ordinal: z.number().int(),
  description: z.string().nullable(),
  isOptional: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BlueprintProcess = z.infer<typeof BlueprintProcessSchema>;

export const BlueprintProcessListQuerySchema = z.object({
  variantId: z.uuid().optional(),
  /**
   * La versione del modello (C4, 000463: il codice è unico per versione). Una variante può avere più
   * versioni: senza questo filtro l'elenco somma i processi di tutte e il conteggio non è quello del
   * tenant (misurato il 2026-11-18: 53 righe in due versioni contro i 23 processi del modello in vigore).
   */
  variantVersionId: z.uuid().optional(),
  isOptional: queryBoolean().optional(),
  ...paginationFields(500, 100),
});
export type BlueprintProcessListQuery = z.infer<typeof BlueprintProcessListQuerySchema>;

export const BlueprintProcessListResponseSchema = z.object({
  items: z.array(BlueprintProcessSchema), total: z.number().int().min(0),
});

export const CreateBlueprintProcessBodySchema = z.object({
  variantId: z.uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  ordinal: z.number().int().min(0).max(32767),
  description: z.string().max(4096).nullable().optional(),
  isOptional: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBlueprintProcessBody = z.infer<typeof CreateBlueprintProcessBodySchema>;

export const UpdateBlueprintProcessBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ordinal: z.number().int().min(0).max(32767).optional(),
  description: z.string().max(4096).nullable().optional(),
  isOptional: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBlueprintProcessBody = z.infer<typeof UpdateBlueprintProcessBodySchema>;

export const BlueprintProcessIdParamSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------------------------
// ADR-0061 D10, passo 3: il controllo di pubblicazione dei processi del modello. Sola lettura: per
// ogni processo gli otto criteri, soddisfatti o no, e che cosa manca (codici stabili, tradotti nella
// pagina). È un rapporto, non un cancello (raccomandazione Q3 accettata da Enzo il 2026-11-22).
// ---------------------------------------------------------------------------------------------
export const PublishabilityQuerySchema = z.object({ variantVersionId: z.uuid() });
export type PublishabilityQuery = z.infer<typeof PublishabilityQuerySchema>;

export const PublishabilityCriterionSchema = z.object({
  numero: z.number().int().min(1).max(8),
  soddisfatto: z.boolean(),
  mancanze: z.array(z.string()),
});
export type PublishabilityCriterion = z.infer<typeof PublishabilityCriterionSchema>;

export const ProcessPublishabilitySchema = z.object({
  processId: z.uuid(),
  code: z.string(),
  name: z.string(),
  soddisfatti: z.number().int(),
  pubblicabile: z.boolean(),
  criteri: z.array(PublishabilityCriterionSchema),
});
export type ProcessPublishability = z.infer<typeof ProcessPublishabilitySchema>;

export const PublishabilityResponseSchema = z.object({
  variantVersionId: z.uuid(),
  total: z.number().int(),
  pubblicabili: z.number().int(),
  items: z.array(ProcessPublishabilitySchema),
});
export type PublishabilityResponse = z.infer<typeof PublishabilityResponseSchema>;
