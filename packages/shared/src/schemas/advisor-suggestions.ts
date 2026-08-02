/**
 * packages/shared/src/schemas/advisor-suggestions.ts
 * F4 — AI Advisor prescrittivo, fase 1.
 *
 * PERCHÉ NON UN LLM (decisione tecnica, S1041). Il criterio di questa capability è
 * «ogni raccomandazione porta una citazione verificabile a un dato reale; nessun output
 * senza fonte». Un modello linguistico non può GARANTIRE quella proprietà: può citare, e
 * può anche inventare, e non esiste test che lo escluda in modo stabile. Un motore a
 * regole sopra le scorecard F1/F2/F3 la garantisce per costruzione — la citazione non è
 * un'aggiunta al testo, è l'input da cui la raccomandazione nasce.
 *
 * La formulazione in linguaggio naturale è fase 2, e vale solo se costruita SOPRA
 * raccomandazioni già tracciabili. Invertire l'ordine è il modo tipico in cui un
 * "advisor" diventa un generatore di frasi plausibili.
 *
 * Nota sul tipo: `citations` ha `.min(1)`. Un suggerimento senza fonte non è "un caso da
 * testare", è un valore che non esiste — lo schema lo rifiuta prima di ogni test.
 */
import { z } from "zod";

/** Le tre scorecard che l'advisor legge. Nessuna regola inventa dati propri. */
export const ADVISOR_SOURCES = ["ESSENTIAL_RANKING", "VRIO", "ORG_HEALTH"] as const;
export const AdvisorSourceSchema = z.enum(ADVISOR_SOURCES);
export type AdvisorSource = z.infer<typeof AdvisorSourceSchema>;

export const ADVISOR_RULES = [
  /** Richiesta da posizioni, posseduta da nessuno: si acquisisce o si forma. */
  "CAPABILITY_GAP_ACQUIRE",
  /** Valida, rara, difficile da imitare — ma non messa a frutto: si alloca. */
  "UNUSED_ADVANTAGE_DEPLOY",
  /** Essenziale ma con padronanza fragile (livello basso o poco verificata): si consolida. */
  "ESSENTIAL_MASTERY_FRAGILE",
  /** Unità nel terzile inferiore: si interviene sulla sua dimensione peggiore. */
  "LAGGING_UNIT_INTERVENE",
  /** Copertura del modello sotto la soglia: non è una diagnosi, è cecità strumentale. */
  "INSUFFICIENT_COVERAGE_INSTRUMENT",
] as const;
export const AdvisorRuleSchema = z.enum(ADVISOR_RULES);
export type AdvisorRule = z.infer<typeof AdvisorRuleSchema>;

export const ADVISOR_SUBJECT_TYPES = ["CAPABILITY", "ORG_UNIT"] as const;
export const AdvisorSubjectTypeSchema = z.enum(ADVISOR_SUBJECT_TYPES);
export type AdvisorSubjectType = z.infer<typeof AdvisorSubjectTypeSchema>;

/**
 * Una citazione è un puntatore RI-VERIFICABILE: chi legge deve poter rifare la stessa
 * lettura e ritrovare lo stesso valore. Per questo porta l'endpoint, il soggetto e il
 * campo, non solo una frase.
 */
export const AdvisorCitationSchema = z.object({
  source: AdvisorSourceSchema,
  /** L'endpoint da cui il valore si rilegge, es. "/v1/capability/composition/vrio". */
  endpoint: z.string().min(1),
  /** Identità del soggetto citato dentro quella risposta (skillGroupId / orgUnitId / skillId). */
  subjectId: z.string().min(1),
  subjectLabel: z.string().min(1),
  /** Il campo letto, col suo nome reale nello schema della fonte, es. "evidence.holders". */
  field: z.string().min(1),
  /** Il valore letto al momento della derivazione. Numerico o testuale, mai una parafrasi. */
  value: z.union([z.number(), z.string()]),
});
export type AdvisorCitation = z.infer<typeof AdvisorCitationSchema>;

export const AdvisorSuggestionSchema = z.object({
  ruleId: AdvisorRuleSchema,
  subjectType: AdvisorSubjectTypeSchema,
  subjectId: z.string().min(1),
  subjectLabel: z.string().min(1),
  /** 0-100, derivata dai valori citati — non un giudizio libero. */
  priority: z.number().min(0).max(100),
  /** Chiave i18n dell'azione proposta; il testo vive nei file di traduzione, non qui. */
  headlineKey: z.string().min(1),
  /** Valori che la UI interpola nella frase. Numeri già arrotondati alla resa. */
  headlineParams: z.record(z.string(), z.union([z.number(), z.string()])),
  /** Almeno una: senza fonte il suggerimento non è rappresentabile. */
  citations: z.array(AdvisorCitationSchema).min(1),
});
export type AdvisorSuggestion = z.infer<typeof AdvisorSuggestionSchema>;

export const AdvisorSuggestionsResponseSchema = z.object({
  items: z.array(AdvisorSuggestionSchema),
  total: z.number().int().min(0),
  /** Regole valutate in questo giro — anche quelle che non hanno prodotto nulla. */
  rulesEvaluated: z.array(AdvisorRuleSchema),
  /**
   * Suggerimenti scartati dal validatore perché una citazione non si risolveva.
   * Pubblicato di proposito: uno scarto silenzioso renderebbe invisibile un difetto del motore.
   */
  discarded: z.number().int().min(0),
  modelVersion: z.string(),
  generatedAt: z.string(),
});
export type AdvisorSuggestionsResponse = z.infer<typeof AdvisorSuggestionsResponseSchema>;

/** Soglie delle regole. Esportate come per F1/F2/F3: un numero nel codice è un numero che nessuno rivede. */
export const ADVISOR_THRESHOLDS = {
  /** Sotto questo livello medio (su 6) la padronanza di una capability essenziale è fragile. */
  fragileHeldRank: 3.5,
  /** Sotto questa quota di possessi verificati la padronanza è dichiarata, non dimostrata. */
  fragileVerifiedShare: 0.5,
  /** Quante capability essenziali in cima alla classifica F1 la regola considera. */
  essentialTopN: 10,
} as const;

/**
 * Nota su una soglia RITIRATA prima di spedire (S1041): `lowDeployment: 0.6` filtrava i
 * vantaggi inutilizzati per quota assoluta di requisiti coperti. Misurato sui dati veri,
 * l'unico caso reale ne ha 17 su 20 (0,85) ed è comunque `UNUSED_ADVANTAGE`, perché F2
 * giudica per percentile fra le capability del tenant e non per quota assoluta. La soglia
 * avrebbe quindi contraddetto in silenzio la scorecard che l'advisor cita — due verità sullo
 * stesso dato. Il criterio è il verdetto di F2.
 */

export const ADVISOR_MODEL_VERSION = "advisor-rules-v1" as const;
