/**
 * packages/shared/src/schemas/ghost-units.ts
 *
 * Le unità dell'organizzazione ghost (ADR-0063 D2, voce G1 del piano AI-driven): il vertice,
 * le divisioni e le direzioni del tenant, entro il secondo livello sotto il vertice, ricavate
 * dal vivo dall'albero delle unità. Ogni unità ghost avrà un Capo agente (G2) e la sua squadra
 * di specialisti (G3). La storia registra ogni volta che l'albero reale cambia la forma ghost.
 */

import { z } from "zod";

export const GHOST_UNIT_KIND_VALUES = ["VERTICE", "DIVISIONE", "DIREZIONE"] as const;
export const GhostUnitKindSchema = z.enum(GHOST_UNIT_KIND_VALUES);
export type GhostUnitKind = z.infer<typeof GhostUnitKindSchema>;

export const GHOST_UNIT_OPENED_REASON_VALUES = ["FORMAZIONE", "NUOVA", "MODIFICATA"] as const;
export const GHOST_UNIT_CLOSED_REASON_VALUES = ["MODIFICATA", "USCITA"] as const;

export const GhostUnitSchema = z.object({
  ghostUnitId: z.uuid(),
  tenantId: z.uuid(),
  /** L'unità reale da cui deriva; null solo nella storia, se l'unità reale è stata eliminata. */
  sourceUnitId: z.uuid().nullable(),
  sourceParentId: z.uuid().nullable(),
  level: z.number().int().min(0).max(2),
  kind: GhostUnitKindSchema,
  code: z.string(),
  name: z.string(),
  sourceType: z.string().nullable(),
  /** Il responsabile dell'unità reale, «Cognome, Nome»: la persona che il Capo ghost affianca. */
  managerUserId: z.uuid().nullable(),
  managerName: z.string().nullable(),
  openedReason: z.enum(GHOST_UNIT_OPENED_REASON_VALUES),
  validFrom: z.iso.datetime(),
  validTo: z.iso.datetime().nullable(),
  closedReason: z.enum(GHOST_UNIT_CLOSED_REASON_VALUES).nullable(),
});
export type GhostUnit = z.infer<typeof GhostUnitSchema>;

export const GhostUnitsQuerySchema = z.object({
  /** Solo per PLATFORM_ADMIN: il tenant da leggere (gli altri leggono il proprio). */
  tenantId: z.uuid().optional(),
});
export type GhostUnitsQuery = z.infer<typeof GhostUnitsQuerySchema>;

export const GhostUnitsResponseSchema = z.object({
  items: z.array(GhostUnitSchema),
  total: z.number().int().min(0),
  /** true se la storia coincide con l'albero vivo; false se l'albero è cambiato e va riformata. */
  allineata: z.boolean(),
});
export type GhostUnitsResponse = z.infer<typeof GhostUnitsResponseSchema>;

export const GhostUnitsHistoryResponseSchema = z.object({
  items: z.array(GhostUnitSchema),
  total: z.number().int().min(0),
});
export type GhostUnitsHistoryResponse = z.infer<typeof GhostUnitsHistoryResponseSchema>;

export const GhostRiformaBodySchema = z.object({
  tenantId: z.uuid().optional(),
});
export type GhostRiformaBody = z.infer<typeof GhostRiformaBodySchema>;

export const GhostRiformaResponseSchema = z.object({
  aperte: z.number().int().min(0),
  chiuse: z.number().int().min(0),
  attive: z.number().int().min(0),
});
export type GhostRiformaResponse = z.infer<typeof GhostRiformaResponseSchema>;
