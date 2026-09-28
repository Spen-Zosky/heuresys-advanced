/**
 * @heuresys/shared — Data classification (I23/ADR-0041) schemas. #262.
 * Backs /v1/data-classification over sys.sys_classificazione_direzione_dato
 * (mig 000429): la direzione del dato — nativo/importato/ibrido/infrastruttura
 * — per ogni tabella sys.sys_* di dato cliente. READ-only, platform-wide: la
 * tabella non ha tenant_id, classifica lo SCHEMA, non un dato di un cliente.
 */
import { z } from "zod";

export const DataClassificationStatoEnum = z.enum(["nativo", "importato", "ibrido", "infrastruttura"]);

export const DataClassificationRowSchema = z.object({
  tabella: z.string(),
  stato: DataClassificationStatoEnum,
  motivo: z.string(),
  adr: z.string(),
  ratificatoIl: z.iso.date(),
});
export type DataClassificationRow = z.infer<typeof DataClassificationRowSchema>;

export const DataClassificationTotalsSchema = z.object({
  nativo: z.number().int(),
  importato: z.number().int(),
  ibrido: z.number().int(),
  infrastruttura: z.number().int(),
});
export type DataClassificationTotals = z.infer<typeof DataClassificationTotalsSchema>;

export const DataClassificationListResponseSchema = z.object({
  items: z.array(DataClassificationRowSchema),
  totals: DataClassificationTotalsSchema,
});
export type DataClassificationListResponse = z.infer<typeof DataClassificationListResponseSchema>;
