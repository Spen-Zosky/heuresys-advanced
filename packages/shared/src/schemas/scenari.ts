/**
 * packages/shared/src/schemas/scenari.ts — il motore degli scenari what-if (ADR-0063 D5, D6),
 * voce F3a del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md.
 *
 * Il contratto di ciò che la migrazione 000515 conserva: scenario, versioni, opzioni, leve,
 * ipotesi, risultati, fonti cliccabili (E13), controlli di equità dichiarati (E12) e la struttura
 * ombra del tenant su cui si calcola. Disegno in docs/piani/ai-driven_20261126/F3a_motore_degli_scenari.md.
 *
 * Le regole che contano stanno nel database (guardie G1-G4 della 000515) e qui sono ripetute come
 * raffinamenti, così l'API e l'assistente le vedono prima di scrivere:
 *   · i numeri li calcola il codice: ogni risultato porta `computedBy` nella forma `calcolatore@x.y.z`;
 *   · una versione calcolata ha almeno due opzioni, al più una «nessuna azione», ogni risultato con
 *     almeno una fonte, ogni opzione che tocca persone con il suo controllo di equità;
 *   · un'opzione che tocca persone è raccomandata solo se i controlli di equità sono tutti superati.
 *
 * Gli elenchi `*_VALUES` sono lo specchio dei CHECK della 000515: la prova
 * `scenari-schema.integration.test.ts` li confronta con il database e diventa rossa se divergono.
 */
import { z } from "zod";

// ── Elenchi chiusi (specchio dei CHECK della 000515) ────────────────────────────────────────

export const SCENARIO_FAMILY_VALUES = [
  "EFFETTO_DIRETTO",
  "CASCATA",
  "NEL_TEMPO",
  "SOTTO_VINCOLI",
  "COMBINATO",
] as const;
export const ScenarioFamilySchema = z.enum(SCENARIO_FAMILY_VALUES);
export type ScenarioFamily = z.infer<typeof ScenarioFamilySchema>;

export const SCENARIO_DOMAIN_VALUES = [
  "TALENTI",
  "COMPETENZE",
  "KPI",
  "SELEZIONE",
  "ORGANIZZAZIONE",
  "CAMBIAMENTO",
  "PROCESSI",
  "PERSONE",
  "COMBINATO",
] as const;
export const ScenarioDomainSchema = z.enum(SCENARIO_DOMAIN_VALUES);
export type ScenarioDomain = z.infer<typeof ScenarioDomainSchema>;

export const SCENARIO_STATUS_VALUES = ["APERTO", "CHIUSO"] as const;
export const ScenarioStatusSchema = z.enum(SCENARIO_STATUS_VALUES);

export const SCENARIO_ORIGIN_VALUES = ["PERSONA", "ASSISTENTE", "SEGNALATORE"] as const;
export const ScenarioOriginSchema = z.enum(SCENARIO_ORIGIN_VALUES);
export type ScenarioOrigin = z.infer<typeof ScenarioOriginSchema>;

export const SCENARIO_VERSION_STATUS_VALUES = ["BOZZA", "CALCOLATA", "ARCHIVIATA"] as const;
export const ScenarioVersionStatusSchema = z.enum(SCENARIO_VERSION_STATUS_VALUES);
export type ScenarioVersionStatus = z.infer<typeof ScenarioVersionStatusSchema>;

/** Le leve: che cosa si muove in un'opzione. Una leva nuova emenda anche il CHECK della 000515. */
export const SCENARIO_LEVER_KIND_VALUES = [
  "PERSONA_ESCE",
  "PERSONA_SI_SPOSTA",
  "TASSO_DI_USCITA",
  "POSIZIONE_APRE",
  "POSIZIONE_CHIUDE",
  "POSIZIONE_CAMBIA_RIPORTO",
  "UNITA_FONDE",
  "UNITA_DIVIDE",
  "UNITA_SPOSTA",
  "COPERTURA_INTERNA",
  "COPERTURA_ESTERNA",
  "BUDGET_FORMAZIONE",
  "INIZIATIVA_FORMATIVA",
  "BUDGET_MERITO",
  "PESO_KPI",
  "OBIETTIVO_CAMBIA",
  "ATTIVITA_TOGLIE",
  "ATTIVITA_UNISCE",
  "ATTIVITA_AUTOMATIZZA",
  "VINCOLO_COSTO",
  "VINCOLO_AMPIEZZA_CONTROLLO",
  "VINCOLO_TEMPO",
] as const;
export const ScenarioLeverKindSchema = z.enum(SCENARIO_LEVER_KIND_VALUES);
export type ScenarioLeverKind = z.infer<typeof ScenarioLeverKindSchema>;

export const SCENARIO_TARGET_TYPE_VALUES = [
  "PERSONA",
  "POSIZIONE",
  "UNITA",
  "PROCESSO",
  "ATTIVITA",
  "COMPETENZA",
  "KPI",
  "OBIETTIVO",
  "TENANT",
] as const;
export const ScenarioTargetTypeSchema = z.enum(SCENARIO_TARGET_TYPE_VALUES);
export type ScenarioTargetType = z.infer<typeof ScenarioTargetTypeSchema>;

export const SCENARIO_ASSUMPTION_KIND_VALUES = ["DATO", "STIMA", "VINCOLO", "POLITICA"] as const;
export const ScenarioAssumptionKindSchema = z.enum(SCENARIO_ASSUMPTION_KIND_VALUES);

export const SCENARIO_SOURCE_KIND_VALUES = [
  "DATO",
  "PAGINA",
  "REGOLA",
  "DOCUMENTO",
  "DATASTORE",
  "STORIA",
] as const;
export const ScenarioSourceKindSchema = z.enum(SCENARIO_SOURCE_KIND_VALUES);

export const SCENARIO_EQUITY_TRAIT_VALUES = [
  "GENERE",
  "ETA",
  "DISABILITA",
  "NAZIONALITA",
  "ALTRO",
] as const;
export const ScenarioEquityTraitSchema = z.enum(SCENARIO_EQUITY_TRAIT_VALUES);

export const SCENARIO_EQUITY_OUTCOME_VALUES = ["SUPERATO", "NON_SUPERATO", "DATI_INSUFFICIENTI"] as const;
export const ScenarioEquityOutcomeSchema = z.enum(SCENARIO_EQUITY_OUTCOME_VALUES);

export const SHADOW_CHANGE_VALUES = ["INVARIATA", "NUOVA", "MODIFICATA", "CHIUSA"] as const;
export const ShadowChangeSchema = z.enum(SHADOW_CHANGE_VALUES);

export const SHADOW_ASSIGNMENT_KIND_VALUES = ["PRIMARY", "SECONDARY", "INTERIM", "ACTING"] as const;
export const ShadowAssignmentKindSchema = z.enum(SHADOW_ASSIGNMENT_KIND_VALUES);

// ── Formati (specchio delle espressioni regolari dei CHECK) ─────────────────────────────────

/** Voce del catalogo del piano, sezione 4: S-T1 … S-X2. */
export const ScenarioCatalogCodeSchema = z.string().regex(/^S-[A-Z][0-9]{1,2}$/);
/** Il calcolatore che ha prodotto il numero, con la sua versione: mai il modello (D5). */
export const ScenarioCalculatorRefSchema = z.string().max(96).regex(/^[a-z][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$/);
export const ScenarioMetricCodeSchema = z.string().max(64).regex(/^[a-z][a-z0-9_]*$/);
export const ScenarioOptionCodeSchema = z.string().regex(/^[A-Z][0-9]?$/);
/** Fonte cliccabile: rotta o pagina (/…), documento del repo (doc:), ADR (adr:NNNN), voce del datastore. */
export const ScenarioSourceRefSchema = z.string().regex(/^(\/\S*|doc:\S+|adr:[0-9]{4}|datastore:\S+)$/);

// ── Le righe ────────────────────────────────────────────────────────────────────────────────

export const ScenarioSourceSchema = z
  .object({
    id: z.string().uuid(),
    kind: ScenarioSourceKindSchema,
    ref: ScenarioSourceRefSchema,
    label: z.string().min(1).max(255),
  })
  .strict();
export type ScenarioSource = z.infer<typeof ScenarioSourceSchema>;

export const ScenarioLeverSchema = z
  .object({
    id: z.string().uuid(),
    kind: ScenarioLeverKindSchema,
    targetType: ScenarioTargetTypeSchema,
    targetId: z.string().uuid().nullable(),
    parameters: z.record(z.string(), z.unknown()),
    ordinal: z.number().int(),
  })
  .strict()
  .refine((l) => (l.targetType === "TENANT") === (l.targetId === null), {
    message: "una leva sul tenant non ha bersaglio; ogni altra leva lo ha",
    path: ["targetId"],
  });
export type ScenarioLever = z.infer<typeof ScenarioLeverSchema>;

export const ScenarioAssumptionSchema = z
  .object({
    id: z.string().uuid(),
    optionId: z.string().uuid().nullable(),
    kind: ScenarioAssumptionKindSchema,
    statement: z.string().min(1),
    value: z.number().nullable(),
    unit: z.string().max(32).nullable(),
    low: z.number().nullable(),
    high: z.number().nullable(),
    sources: z.array(ScenarioSourceSchema),
  })
  .strict()
  .refine((a) => a.kind !== "STIMA" || (a.low !== null && a.high !== null), {
    message: "una stima dichiara la sua incertezza (low e high)",
    path: ["low"],
  })
  .refine((a) => a.low === null || a.high === null || a.low <= a.high, {
    message: "low non supera high",
    path: ["high"],
  });
export type ScenarioAssumption = z.infer<typeof ScenarioAssumptionSchema>;

export const ScenarioResultSchema = z
  .object({
    id: z.string().uuid(),
    metricCode: ScenarioMetricCodeSchema,
    metricLabel: z.string().min(1).max(255),
    value: z.number(),
    unit: z.string().min(1).max(32),
    low: z.number().nullable(),
    high: z.number().nullable(),
    draws: z.number().int().positive().nullable(),
    horizonMonths: z.number().int().min(0).max(120).nullable(),
    computedBy: ScenarioCalculatorRefSchema,
    computedAt: z.string().datetime({ offset: true }),
    sources: z.array(ScenarioSourceSchema),
  })
  .strict()
  .refine((r) => (r.low === null) === (r.high === null), {
    message: "la banda di incertezza ha entrambi gli estremi o nessuno",
    path: ["low"],
  })
  .refine((r) => r.low === null || r.high === null || (r.low <= r.value && r.value <= r.high), {
    message: "il valore sta dentro la sua banda",
    path: ["value"],
  });
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;

/** La dichiarazione di equità (E12): esito, gruppi confrontati, rapporto misurato, soglia, metodo. */
export const ScenarioEquityCheckSchema = z
  .object({
    id: z.string().uuid(),
    trait: ScenarioEquityTraitSchema,
    groups: z.string().min(1),
    ratio: z.number().min(0).nullable(),
    threshold: z.number().gt(0).max(1),
    outcome: ScenarioEquityOutcomeSchema,
    method: ScenarioCalculatorRefSchema,
    computedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((e) => (e.outcome === "DATI_INSUFFICIENTI") === (e.ratio === null), {
    message: "un esito misurato porta il rapporto; «dati insufficienti» non lo inventa",
    path: ["ratio"],
  });
export type ScenarioEquityCheck = z.infer<typeof ScenarioEquityCheckSchema>;

export const ScenarioOptionSchema = z
  .object({
    id: z.string().uuid(),
    code: ScenarioOptionCodeSchema,
    label: z.string().min(1).max(255),
    description: z.string().nullable(),
    isBaseline: z.boolean(),
    touchesPeople: z.boolean(),
    recommended: z.boolean(),
    ordinal: z.number().int(),
    levers: z.array(ScenarioLeverSchema),
    results: z.array(ScenarioResultSchema),
    equityChecks: z.array(ScenarioEquityCheckSchema),
  })
  .strict()
  .refine((o) => !o.isBaseline || !o.touchesPeople, {
    message: "«nessuna azione» non tocca persone",
    path: ["touchesPeople"],
  })
  .refine(
    (o) =>
      !(o.recommended && o.touchesPeople) ||
      (o.equityChecks.length > 0 && o.equityChecks.every((e) => e.outcome === "SUPERATO")),
    {
      message: "un'opzione che tocca persone si raccomanda solo con i controlli di equità tutti superati (E12)",
      path: ["recommended"],
    },
  );
export type ScenarioOption = z.infer<typeof ScenarioOptionSchema>;

// ── La struttura ombra ──────────────────────────────────────────────────────────────────────

export const ShadowUnitSchema = z
  .object({
    id: z.string().uuid(),
    optionId: z.string().uuid().nullable(),
    sourceId: z.string().uuid().nullable(),
    parentId: z.string().uuid().nullable(),
    code: z.string().min(1).max(128),
    name: z.string().min(1).max(255),
    type: z.string().max(64).nullable(),
    managerUserId: z.string().uuid().nullable(),
    change: ShadowChangeSchema,
  })
  .strict();
export type ShadowUnit = z.infer<typeof ShadowUnitSchema>;

export const ShadowPositionSchema = z
  .object({
    id: z.string().uuid(),
    optionId: z.string().uuid().nullable(),
    sourceId: z.string().uuid().nullable(),
    unitId: z.string().uuid().nullable(),
    reportsToId: z.string().uuid().nullable(),
    code: z.string().min(1).max(128),
    title: z.string().min(1).max(255),
    jobRoleId: z.string().uuid().nullable(),
    criticality: z.string().max(32).nullable(),
    economicWeight: z.number().nullable(),
    change: ShadowChangeSchema,
  })
  .strict();
export type ShadowPosition = z.infer<typeof ShadowPositionSchema>;

export const ShadowAssignmentSchema = z
  .object({
    id: z.string().uuid(),
    optionId: z.string().uuid().nullable(),
    sourceId: z.string().uuid().nullable(),
    positionId: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    kind: ShadowAssignmentKindSchema,
    fte: z.number().gt(0).max(1),
    change: ShadowChangeSchema,
  })
  .strict();
export type ShadowAssignment = z.infer<typeof ShadowAssignmentSchema>;

/** L'esito della fotografia (`sys.sys_scenario_fotografa`): quante righe e l'impronta. */
export const ScenarioSnapshotSchema = z
  .object({
    units: z.number().int().nonnegative(),
    positions: z.number().int().nonnegative(),
    assignments: z.number().int().nonnegative(),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export type ScenarioSnapshot = z.infer<typeof ScenarioSnapshotSchema>;

// ── Versione e scenario ─────────────────────────────────────────────────────────────────────

export const ScenarioVersionSchema = z
  .object({
    id: z.string().uuid(),
    number: z.number().int().min(1),
    status: ScenarioVersionStatusSchema,
    notes: z.string().nullable(),
    baselineAt: z.string().datetime({ offset: true }).nullable(),
    baselineDigest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    computedAt: z.string().datetime({ offset: true }).nullable(),
    assumptions: z.array(ScenarioAssumptionSchema),
    options: z.array(ScenarioOptionSchema),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.baselineAt === null) !== (v.baselineDigest === null)) {
      ctx.addIssue({ code: "custom", path: ["baselineDigest"], message: "data e impronta della fotografia vanno insieme" });
    }
    if ((v.status === "BOZZA") !== (v.computedAt === null)) {
      ctx.addIssue({ code: "custom", path: ["computedAt"], message: "solo una versione calcolata ha la data di calcolo" });
    }
    if (v.options.filter((o) => o.isBaseline).length > 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "al più una opzione «nessuna azione»" });
    }
    if (v.status === "BOZZA") return;
    // Ciò che il database pretende al passaggio a CALCOLATA (G2 della 000515).
    if (v.status === "CALCOLATA") {
      if (v.baselineDigest === null) {
        ctx.addIssue({ code: "custom", path: ["baselineDigest"], message: "una versione calcolata parte da una fotografia" });
      }
      if (v.options.length < 2) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "servono almeno due opzioni (ADR-0063 D5)" });
      }
      v.options.forEach((o, i) => {
        if (o.results.length === 0) {
          ctx.addIssue({ code: "custom", path: ["options", i, "results"], message: "opzione senza risultati calcolati" });
        }
        o.results.forEach((r, j) => {
          if (r.sources.length === 0) {
            ctx.addIssue({ code: "custom", path: ["options", i, "results", j, "sources"], message: "risultato senza fonte cliccabile (E13)" });
          }
        });
        if (o.touchesPeople && o.equityChecks.length === 0) {
          ctx.addIssue({ code: "custom", path: ["options", i, "equityChecks"], message: "opzione che tocca persone senza controllo di equità (E12)" });
        }
      });
    }
  });
export type ScenarioVersion = z.infer<typeof ScenarioVersionSchema>;

export const ScenarioSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    title: z.string().min(1).max(255),
    question: z.string().min(1),
    family: ScenarioFamilySchema,
    domain: ScenarioDomainSchema,
    catalogCode: ScenarioCatalogCodeSchema.nullable(),
    status: ScenarioStatusSchema,
    origin: ScenarioOriginSchema,
    agentRef: z.string().max(128).nullable(),
    ownerUserId: z.string().uuid().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((s) => s.origin === "PERSONA" || s.agentRef !== null, {
    message: "uno scenario aperto da un agente dichiara quale agente (anagrafe)",
    path: ["agentRef"],
  });
export type Scenario = z.infer<typeof ScenarioSchema>;

/** Che cosa si chiede per aprire uno scenario: la domanda e la sua forma, non i numeri. */
export const ScenarioCreateSchema = z
  .object({
    title: z.string().min(1).max(255),
    question: z.string().min(1).max(4000),
    family: ScenarioFamilySchema,
    domain: ScenarioDomainSchema,
    catalogCode: ScenarioCatalogCodeSchema.optional(),
  })
  .strict();
export type ScenarioCreate = z.infer<typeof ScenarioCreateSchema>;

// ── Le rotte (voce F3b-2) ───────────────────────────────────────────────────────────────────

/** Lo scenario di uscita (S-T1 effetto diretto, S-T2 cascata): chi esce e fin dove si copre. */
export const ScenarioExitsCreateSchema = z
  .object({
    userIds: z.array(z.string().uuid()).min(1).max(20),
    family: z.enum(["EFFETTO_DIRETTO", "CASCATA"]),
  })
  .strict();
export type ScenarioExitsCreate = z.infer<typeof ScenarioExitsCreateSchema>;

/** Uno scenario con la sua versione più recente (null se non ne ha ancora una). */
export const ScenarioDetailSchema = z
  .object({
    scenario: ScenarioSchema,
    version: ScenarioVersionSchema.nullable(),
  })
  .strict();
export type ScenarioDetail = z.infer<typeof ScenarioDetailSchema>;

/** L'elenco degli scenari del tenant: tutti, con il loro numero (niente elenchi troncati, R5). */
export const ScenarioListSchema = z
  .object({
    items: z.array(ScenarioSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type ScenarioList = z.infer<typeof ScenarioListSchema>;
