/**
 * packages/shared/src/schemas/dashboard.ts
 * Schema for GET /v1/dashboard/widgets — role-gated aggregator for the admin
 * landing page. NOT a separate persisted view — composed at request time
 * from existing tables.
 */

import { z } from "zod";

export const DashboardScopeKindSchema = z.enum([
  "PLATFORM",
  "TENANT",
  "TEAM",
]);
export type DashboardScopeKind = z.infer<typeof DashboardScopeKindSchema>;

export const DashboardCountersSchema = z.object({
  tenants: z.number().int().min(0).nullable(),
  users: z.number().int().min(0),
  positions: z.number().int().min(0),
  organizationUnits: z.number().int().min(0),
  learningPaths: z.number().int().min(0),
  learningGaps: z.number().int().min(0),
  blueprints: z.number().int().min(0).nullable(),
  pendingRecommendations: z.number().int().min(0).nullable(),
});
export type DashboardCounters = z.infer<typeof DashboardCountersSchema>;

export const DashboardLearningDeadlineSchema = z.object({
  learningGapId: z.uuid(),
  userId: z.uuid(),
  userDisplayName: z.string(),
  positionId: z.uuid().nullable(),
  positionTitle: z.string().nullable(),
  skillId: z.uuid().nullable(),
  skillName: z.string().nullable(),
  severity: z.string(),
  detectedAt: z.iso.datetime(),
});
export type DashboardLearningDeadline = z.infer<typeof DashboardLearningDeadlineSchema>;

export const DashboardRecentActivitySchema = z.object({
  kind: z.enum(["USER_CREATED", "POSITION_CREATED", "ASSIGNMENT_CHANGED"]),
  occurredAt: z.iso.datetime(),
  summary: z.string(),
  resourceId: z.uuid(),
});
export type DashboardRecentActivity = z.infer<typeof DashboardRecentActivitySchema>;

/**
 * Per-counter trend — week-over-week delta + a weekly cumulative series for
 * StatsCard sparklines. Derived from real `created_at` / `detected_at`
 * timestamps (no fabricated data); a flat or all-zero series faithfully
 * reflects batch-seeded or empty entities. `series` is empty for TEAM scope
 * (MANAGER), where the team-disaggregated history is not yet computed.
 */
export const DashboardTrendKeySchema = z.enum([
  "users",
  "positions",
  "organizationUnits",
  "learningPaths",
  "learningGaps",
]);
export type DashboardTrendKey = z.infer<typeof DashboardTrendKeySchema>;

export const DashboardTrendSchema = z.object({
  key: DashboardTrendKeySchema,
  current: z.number().int().min(0),
  previousWeek: z.number().int().min(0),
  /** Signed week-over-week percent; 0 when not computable (no prior-week data). */
  deltaPct: z.number(),
  direction: z.enum(["up", "down", "flat"]),
  /** Weekly cumulative counts, oldest→newest. Empty for TEAM scope. */
  series: z.array(z.number().int().min(0)),
  weeks: z.number().int().min(0),
});
export type DashboardTrend = z.infer<typeof DashboardTrendSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Il CATALOGO dei cruscotti (#142 F3a) — quali famiglie esistono, per chi, e quali
// viste le compongono. Distinto da `widgets`, che è l'aggregatore della pagina unica:
// quello risponde «cosa mostra il cruscotto», questo «quali cruscotti esistono e quali
// sono tuoi». Il modello vive in `sys_dashboards` → `sys_dashboard_blocks` →
// `sys_dashboard_block_data_classes` (mig. `000316`).
// ─────────────────────────────────────────────────────────────────────────────

/** Le sette classi di M1 (ADR-0036 §7). Stesso vocabolario del CHECK in `000316`. */
export const DashboardDataClassSchema = z.enum([
  "PERSONAL", "COMPENSATION", "SKILL", "EVALUATION", "ACTIVITY", "CREDENTIAL", "SPECIAL_CATEGORY",
]);
export type DashboardDataClass = z.infer<typeof DashboardDataClassSchema>;

export const DashboardBlockSchema = z.object({
  code: z.string(),
  name: z.string(),
  order: z.number().int().min(0),
  /** Le classi che questa vista espone. Vuoto = non espone dati di persona. */
  dataClasses: z.array(DashboardDataClassSchema),
  /**
   * Come l'attore può guardare questa vista. **Tre stati, non due**, ed è il difetto che
   * la prova live ha trovato: un booleano `masked` costringeva a scegliere fra «la vedi» e
   * «non la vedi», e `mask` — il quarto stato di autorizzazione (I20) — finiva dalla parte
   * sbagliata. Un `PLATFORM_ADMIN` si vedeva così la vista delle retribuzioni **in chiaro**,
   * mentre ADR-0032 gliela maschera.
   *  · `open`   — la vista è tua, con i valori
   *  · `masked` — la vista c'è, i valori sono trattenuti (si DICHIARA, non si tace: una
   *               vista che sparisce senza spiegazione è indistinguibile da una che non
   *               esiste, e chi guarda non può nemmeno chiedersi perché)
   *  · `denied` — nessuno dei tuoi domini apre una delle classi che espone
   */
  access: z.enum(["open", "masked", "denied"]),
});
export type DashboardBlock = z.infer<typeof DashboardBlockSchema>;

export const DashboardCatalogEntrySchema = z.object({
  code: z.string(),
  name: z.string(),
  route: z.string(),
  /** `null` solo per il Self-Service: è il pavimento universale (I17), non si concede. */
  permissionCode: z.string().nullable(),
  order: z.number().int().min(0),
  /** `false` finché la pagina non esiste (F4). Un catalogo non è un menu. */
  isActive: z.boolean(),
  /** Quante viste compongono il cruscotto, e come si distribuiscono per l'attore. */
  blockCount: z.number().int().min(0),
  maskedBlockCount: z.number().int().min(0),
  deniedBlockCount: z.number().int().min(0),
});
export type DashboardCatalogEntry = z.infer<typeof DashboardCatalogEntrySchema>;

export const DashboardCatalogResponseSchema = z.object({
  dashboards: z.array(DashboardCatalogEntrySchema),
  generatedAt: z.iso.datetime(),
});
export type DashboardCatalogResponse = z.infer<typeof DashboardCatalogResponseSchema>;

export const DashboardDetailResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  route: z.string(),
  permissionCode: z.string().nullable(),
  isActive: z.boolean(),
  blocks: z.array(DashboardBlockSchema),
  generatedAt: z.iso.datetime(),
});
export type DashboardDetailResponse = z.infer<typeof DashboardDetailResponseSchema>;

export const DashboardWidgetsResponseSchema = z.object({
  role: z.string(),
  scope: z.object({
    kind: DashboardScopeKindSchema,
    tenantId: z.uuid().nullable(),
    teamPositionIds: z.array(z.uuid()),
  }),
  counters: DashboardCountersSchema,
  trends: z.array(DashboardTrendSchema),
  upcomingLearningDeadlines: z.array(DashboardLearningDeadlineSchema),
  recentActivity: z.array(DashboardRecentActivitySchema),
  generatedAt: z.iso.datetime(),
});
export type DashboardWidgetsResponse = z.infer<typeof DashboardWidgetsResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// #142 F3b — i dati DENTRO le viste
//
// F3a ha consegnato il catalogo: quali viste esistono e come l'attore può guardarle
// (`open` / `masked` / `denied`). Qui la granularità smette di essere un modello e
// diventa una query: ogni vista `open` porta il proprio contenuto reale.
//
// LA REGOLA CHE GOVERNA QUESTA SUPERFICIE, ed è la stessa di F3a vista dal lato dei dati:
//  · `open`   → `content` valorizzato, `withheldReason` assente
//  · `masked` → `content` NULLO e `withheldReason` che DICHIARA il perché, nominando le
//               classi trattenute. Una vista che sparisce senza spiegazione è
//               indistinguibile da una che non esiste (ADR-0032: la riga, il soggetto, il
//               periodo e lo stato restano visibili — sono i VALORI a essere trattenuti)
//  · `denied` → `content` nullo, e la query non viene nemmeno eseguita
// ─────────────────────────────────────────────────────────────────────────────

/** Un contatore: un numero con la sua etichetta. La forma più comune fra le 27 viste. */
export const DashboardBlockCounterSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
});
export type DashboardBlockCounter = z.infer<typeof DashboardBlockCounterSchema>;

/** Un punto di una serie temporale: il bucket è già formattato per l'asse. */
export const DashboardBlockPointSchema = z.object({
  bucket: z.string(),
  value: z.number(),
});
export type DashboardBlockPoint = z.infer<typeof DashboardBlockPointSchema>;

/** Una riga di elenco: identità, etichetta, e i due campi liberi che le viste usano. */
export const DashboardBlockRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  value: z.number().nullable(),
});
export type DashboardBlockRow = z.infer<typeof DashboardBlockRowSchema>;

/**
 * Il contenuto di una vista, in tre forme discriminate. Non è una scelta estetica: il
 * frontend (F4) deve poter disegnare una vista senza sapere quale sia, o ogni vista nuova
 * pretenderebbe un componente nuovo — che è esattamente il modo in cui un catalogo
 * dichiarato smette di essere derivabile.
 */
export const DashboardBlockContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("counters"), counters: z.array(DashboardBlockCounterSchema) }),
  z.object({ kind: z.literal("series"), points: z.array(DashboardBlockPointSchema) }),
  z.object({ kind: z.literal("list"), rows: z.array(DashboardBlockRowSchema) }),
]);
export type DashboardBlockContent = z.infer<typeof DashboardBlockContentSchema>;

export const DashboardBlockDataSchema = DashboardBlockSchema.extend({
  /** I dati reali. `null` per ogni vista che non è `open` — mai un oggetto vuoto. */
  content: DashboardBlockContentSchema.nullable(),
  /**
   * Perché i valori non ci sono. Presente **solo** quando `content` è nullo, e nomina la
   * causa: le classi mascherate, o il diniego. È la parte che ADR-0032 pretende resti
   * visibile quando i valori non lo sono.
   */
  withheldReason: z.string().nullable(),
});
export type DashboardBlockData = z.infer<typeof DashboardBlockDataSchema>;

export const DashboardDataResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  route: z.string(),
  permissionCode: z.string().nullable(),
  isActive: z.boolean(),
  /** Il perimetro su cui i contenuti sono stati calcolati — dichiarato, non implicito. */
  scope: z.object({
    kind: DashboardScopeKindSchema,
    tenantId: z.uuid().nullable(),
    teamPositionIds: z.array(z.uuid()),
  }),
  blocks: z.array(DashboardBlockDataSchema),
  generatedAt: z.iso.datetime(),
});
export type DashboardDataResponse = z.infer<typeof DashboardDataResponseSchema>;
