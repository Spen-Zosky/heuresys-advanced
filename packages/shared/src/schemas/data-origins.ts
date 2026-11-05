/**
 * packages/shared/src/schemas/data-origins.ts — piano interfacce L10, voce A-14.
 *
 * L'ORIGINE DEL DATO (I23, ADR-0041): ogni tabella di dato del cliente è nativa (nasce da un
 * gesto nell'applicazione), importata (arriva da un sistema esterno o da una materializzazione)
 * o ibrida (entrambe le strade, con i conflitti registrati). Lo stato è dichiarato nel database
 * (`sys.sys_classificazione_direzione_dato`, 000429); qui lo si rende visibile per modulo, cioè
 * per ciò che una pagina o un agente leggono.
 */
import { z } from "zod";

/** Intestazione di ogni lettura JSON su /v1/*: l'origine del modulo che risponde. */
export const DATA_ORIGIN_HEADER = "x-heuresys-data-origin";

export const DATA_ORIGIN_STATES = ["nativo", "importato", "ibrido", "infrastruttura"] as const;
export const DataOriginStateSchema = z.enum(DATA_ORIGIN_STATES);
export type DataOriginState = z.infer<typeof DataOriginStateSchema>;

/**
 * Il riassunto di un modulo: lo stato comune delle sue tabelle di dato del cliente (le tabelle
 * `infrastruttura` non contano), `misto` se sono di stati diversi, `infrastruttura` se il modulo
 * tocca solo tabelle tecniche, `null` se nessuna sua tabella è classificata.
 */
export const DATA_ORIGIN_SUMMARIES = ["nativo", "importato", "ibrido", "misto", "infrastruttura"] as const;
export const DataOriginSummarySchema = z.enum(DATA_ORIGIN_SUMMARIES);
export type DataOriginSummary = z.infer<typeof DataOriginSummarySchema>;

export const DataOriginTableSchema = z.object({
  table: z.string(),
  state: DataOriginStateSchema.nullable(),
  /** La tabella porta l'origine riga per riga (colonna `origine_dato`, X-2). */
  perRow: z.boolean(),
});
export type DataOriginTable = z.infer<typeof DataOriginTableSchema>;

export const DataOriginModuleSchema = z.object({
  module: z.string(),
  prefixes: z.array(z.string()),
  origin: DataOriginSummarySchema.nullable(),
  tables: z.array(DataOriginTableSchema),
});
export type DataOriginModule = z.infer<typeof DataOriginModuleSchema>;

export const DataOriginsQuerySchema = z
  .object({
    /** Solo il modulo di questo percorso API (es. `/v1/time-off/requests`). */
    path: z.string().trim().startsWith("/v1/").max(300).optional(),
  })
  .strict();
export type DataOriginsQuery = z.infer<typeof DataOriginsQuerySchema>;

export const DataOriginsResponseSchema = z.object({
  /** Quando la classificazione è stata letta dal database. */
  classifiedAt: z.string(),
  modules: z.array(DataOriginModuleSchema),
});
export type DataOriginsResponse = z.infer<typeof DataOriginsResponseSchema>;

/**
 * L'origine di UNA riga, dove la tabella la porta (colonna `origine_dato`, X-2, 000433-000450):
 * IMPORT da un sistema esterno reale, NATIVO da un gesto nell'applicazione, MATERIALIZZAZIONE
 * seminata (collaudo o materializzazione del modello) e dichiarata come tale.
 */
export const DATA_ROW_ORIGINS = ["IMPORT", "NATIVO", "MATERIALIZZAZIONE"] as const;
export const DataRowOriginSchema = z.enum(DATA_ROW_ORIGINS);
export type DataRowOrigin = z.infer<typeof DataRowOriginSchema>;
