/**
 * @heuresys/shared — costruzione di un'azienda da un MODELLO.
 *
 * Regge `POST /v1/tenant-materialization` (+ `GET /sources`): dato un modello, crea per
 * l'azienda di destinazione unità, posizioni, competenze e indicatori, in modo idempotente
 * (`ON CONFLICT`). Riservato a `PLATFORM_ADMIN`; l'azienda di destinazione deve esistere ed
 * essere `ACTIVE` (isolamento M-1: ogni riga porta il `tenant_id` validato, I5).
 *
 * ⚠ COSA È CAMBIATO, e perché (#132 F3, decisione E29 di Enzo — 2026-08-17). Questo modulo
 * nasceva (#4 WI-C) su un **archetipo deterministico**: 296 righe di TypeScript che
 * descrivevano una banca al dettaglio. *«Il fascicolo non può avere un archetipo aprioristico,
 * altrimenti genera sempre una banca come RTL»* — e infatti il 2026-08-19 una costruzione di
 * prova in produzione è nata banca senza che nessuno lo chiedesse, ed è stata disfatta per
 * intero.
 *
 * Il campo `archetypeKey` è quindi **ritirato** e sostituito da `variantVersionId`: la
 * versione di modello da cui leggere il contenuto (`sys.sys_blueprint_content_*`, mig.
 * `000327`). Non è una rinomina — cambia *dove vive* il contenuto: prima in un file di
 * codice uguale per tutti, ora nel database, una riga per modello.
 */
import { z } from "zod";

export const MaterializeModeEnum = z.enum(["plan", "apply"]);
export type MaterializeMode = z.infer<typeof MaterializeModeEnum>;

export const MaterializeRequestBodySchema = z.object({
  tenantId: z.uuid(),
  /** La versione di modello da cui costruire. Sostituisce `archetypeKey` (#132 F3). */
  variantVersionId: z.uuid(),
  mode: MaterializeModeEnum,
});
export type MaterializeRequestBody = z.infer<typeof MaterializeRequestBodySchema>;

export const MaterializeCountsSchema = z.object({
  orgUnits: z.number().int(),
  positions: z.number().int(),
  users: z.number().int(),
  assignments: z.number().int(),
  skills: z.number().int(),
  kpis: z.number().int(),
  skillEvidence: z.number().int(),
  kpiEvidence: z.number().int(),
});
export type MaterializeCounts = z.infer<typeof MaterializeCountsSchema>;

export const MaterializeResultSchema = z.object({
  tenantId: z.uuid(),
  variantVersionId: z.uuid(),
  /** `famiglia/variante v<n>` — il modello, per nome, così il referto si legge da solo. */
  sourceLabel: z.string(),
  mode: MaterializeModeEnum,
  /** `plan` → cosa nascerebbe · `apply` → cosa è nato davvero (inserito con ON CONFLICT). */
  created: MaterializeCountsSchema,
  /** già presente → saltato (ri-esecuzione idempotente). */
  skipped: MaterializeCountsSchema,
  /** la dimensione del modello. `created + skipped == total`. */
  total: MaterializeCountsSchema,
});
export type MaterializeResult = z.infer<typeof MaterializeResultSchema>;

/**
 * Un modello da cui si può costruire.
 *
 * ⚠ «Da cui si PUÒ costruire» non vuol dire «che esiste»: l'elenco riporta solo le versioni
 * che hanno davvero del contenuto. Una versione vuota non è una scelta possibile — e
 * mostrarla produrrebbe il difetto che `#132` F2 esiste per chiudere: una costruzione che
 * riesce creando zero righe, indistinguibile da un successo.
 */
export const BuildSourceSummarySchema = z.object({
  variantVersionId: z.uuid(),
  /** `famiglia/variante v<n>`. */
  label: z.string(),
  familyCode: z.string(),
  variantCode: z.string(),
  versionNumber: z.number().int(),
  status: z.string(),
  orgUnitCount: z.number().int(),
  positionCount: z.number().int(),
  skillCount: z.number().int(),
  kpiCount: z.number().int(),
});
export type BuildSourceSummary = z.infer<typeof BuildSourceSummarySchema>;

export const BuildSourceListResponseSchema = z.object({
  items: z.array(BuildSourceSummarySchema),
});
export type BuildSourceListResponse = z.infer<typeof BuildSourceListResponseSchema>;
