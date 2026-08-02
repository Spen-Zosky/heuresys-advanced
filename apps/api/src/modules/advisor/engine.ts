/**
 * apps/api/src/modules/advisor/engine.ts
 * F4 fase 1 — motore prescrittivo DETERMINISTICO sopra le scorecard F1/F2/F3.
 *
 * Funzioni pure: nessun I/O, nessun orologio, nessun modello linguistico. Ogni regola
 * riceve le scorecard così come le vede l'utente e produce raccomandazioni la cui
 * citazione È l'input da cui nascono — non un'aggiunta successiva al testo.
 *
 * Il validatore in coda ri-legge ogni citazione dalle stesse scorecard e scarta il
 * suggerimento se il valore dichiarato non corrisponde. È una guardia contro il motore
 * stesso: se una regola sbaglia a copiare un numero, il suggerimento non esce.
 */
import {
  ADVISOR_THRESHOLDS as T,
  type AdvisorSuggestion,
  type AdvisorCitation,
  type EssentialCapabilityRanking,
  type VrioScorecard,
  type OrgHealthScorecard,
  type OrgHealthUnit,
} from "@heuresys/shared";

const VRIO_ENDPOINT = "/v1/capability/composition/vrio";
const ESSENTIAL_ENDPOINT = "/v1/capability/composition/essential-ranking";
const ORG_HEALTH_ENDPOINT = "/v1/org-health";

const round = (x: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};
const clamp100 = (x: number): number => Math.min(100, Math.max(0, x));

export interface AdvisorInputs {
  essential: EssentialCapabilityRanking;
  vrio: VrioScorecard;
  orgHealth: OrgHealthScorecard;
}

/* ------------------------------- regole ------------------------------- */

/**
 * Una capability che l'organizzazione RICHIEDE e che non ha nessuno è un buco, non un
 * asset raro. La priorità cresce col numero di posizioni scoperte e con quante di esse
 * sono critiche: è la scala del danno, non un giudizio.
 */
function ruleCapabilityGap(inputs: AdvisorInputs): AdvisorSuggestion[] {
  return inputs.vrio.items
    .filter((c) => c.verdict === "CAPABILITY_GAP" && c.evidence.positionsRequiring > 0)
    .map((c) => {
      const share = c.evidence.positionsRequiring / Math.max(1, inputs.vrio.total);
      const criticalShare = c.evidence.criticalPositions / Math.max(1, c.evidence.positionsRequiring);
      return {
        ruleId: "CAPABILITY_GAP_ACQUIRE" as const,
        subjectType: "CAPABILITY" as const,
        subjectId: c.skillGroupId,
        subjectLabel: c.skillGroupName,
        priority: clamp100(round(60 + 30 * criticalShare + 10 * Math.min(1, share))),
        headlineKey: "advisor.rule.capabilityGapAcquire",
        headlineParams: {
          capability: c.skillGroupName,
          positions: c.evidence.positionsRequiring,
          critical: c.evidence.criticalPositions,
        },
        citations: [
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "verdict", c.verdict),
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "evidence.holders", c.evidence.holders),
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "evidence.positionsRequiring", c.evidence.positionsRequiring),
        ],
      };
    });
}

/**
 * Valida, rara e difficile da imitare, ma i requisiti che la chiedono restano scoperti:
 * il vantaggio esiste e non è messo a frutto. L'azione è di allocazione, non di acquisto —
 * la differenza che un consiglio generico non saprebbe fare.
 */
function ruleUnusedAdvantage(inputs: AdvisorInputs): AdvisorSuggestion[] {
  // Il criterio è il VERDETTO di F2, non una seconda soglia di copertura. Misurato S1041:
  // l'unico caso reale ha 17 requisiti coperti su 20 (0,85) ed è comunque classificato
  // UNUSED_ADVANTAGE, perché F2 giudica l'organizzazione per PERCENTILE fra le capability
  // del tenant, non per quota assoluta. Una soglia assoluta qui avrebbe silenziosamente
  // contraddetto la scorecard che l'advisor cita — due verità sullo stesso dato.
  return inputs.vrio.items
    .filter((c) => c.verdict === "UNUSED_ADVANTAGE" && c.evidence.totalRequirements > 0)
    .map((c) => {
      const deployment = c.evidence.coveredRequirements / c.evidence.totalRequirements;
      return {
        ruleId: "UNUSED_ADVANTAGE_DEPLOY" as const,
        subjectType: "CAPABILITY" as const,
        subjectId: c.skillGroupId,
        subjectLabel: c.skillGroupName,
        priority: clamp100(round(50 + 40 * (1 - deployment))),
        headlineKey: "advisor.rule.unusedAdvantageDeploy",
        headlineParams: {
          capability: c.skillGroupName,
          holders: c.evidence.holders,
          covered: c.evidence.coveredRequirements,
          required: c.evidence.totalRequirements,
        },
        citations: [
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "verdict", c.verdict),
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "evidence.coveredRequirements", c.evidence.coveredRequirements),
          cite("VRIO", VRIO_ENDPOINT, c.skillGroupId, c.skillGroupName, "evidence.totalRequirements", c.evidence.totalRequirements),
        ],
      };
    });
}

/**
 * Fra le capability essenziali (F1), quelle possedute a un livello basso o poco verificate.
 * «Poco verificata» non è un difetto della persona: è un'affermazione che l'organizzazione
 * non ha ancora messo alla prova, e su una capability essenziale è un rischio.
 */
function ruleFragileMastery(inputs: AdvisorInputs): AdvisorSuggestion[] {
  const top = [...inputs.essential.items]
    .sort((a, b) => b.essentialityScore - a.essentialityScore)
    .slice(0, T.essentialTopN);
  const out: AdvisorSuggestion[] = [];
  for (const skill of top) {
    if (skill.holders === 0) continue; // è un gap, non una padronanza fragile: la copre l'altra regola
    const groupId = skillGroupOf(skill);
    const group = groupId
      ? inputs.vrio.items.find((c) => c.skillGroupId === groupId && c.evidence.holders > 0)
      : undefined;
    const heldRank = group?.evidence.avgHeldRank ?? null;
    const verified = group?.evidence.verifiedShare ?? null;
    const fragileRank = heldRank !== null && heldRank < T.fragileHeldRank;
    const fragileVerified = verified !== null && verified < T.fragileVerifiedShare;
    if (!group || (!fragileRank && !fragileVerified)) continue;
    const citations: AdvisorCitation[] = [
      cite("ESSENTIAL_RANKING", ESSENTIAL_ENDPOINT, skill.skillId, skill.skillName, "essentialityScore", skill.essentialityScore),
      cite("ESSENTIAL_RANKING", ESSENTIAL_ENDPOINT, skill.skillId, skill.skillName, "holders", skill.holders),
    ];
    if (fragileRank) {
      citations.push(cite("VRIO", VRIO_ENDPOINT, group.skillGroupId, group.skillGroupName, "evidence.avgHeldRank", heldRank!));
    }
    if (fragileVerified) {
      citations.push(cite("VRIO", VRIO_ENDPOINT, group.skillGroupId, group.skillGroupName, "evidence.verifiedShare", round(verified!, 4)));
    }
    out.push({
      ruleId: "ESSENTIAL_MASTERY_FRAGILE",
      subjectType: "CAPABILITY",
      subjectId: skill.skillId,
      subjectLabel: skill.skillName,
      priority: clamp100(round(40 + 0.4 * skill.essentialityScore)),
      headlineKey: "advisor.rule.essentialMasteryFragile",
      headlineParams: {
        capability: skill.skillName,
        holders: skill.holders,
        ...(fragileRank ? { heldRank: round(heldRank!, 2) } : {}),
        ...(fragileVerified ? { verifiedShare: round(verified! * 100, 1) } : {}),
      },
      citations,
    });
  }
  return out;
}

/**
 * F1 ragiona per skill, F2 per gruppo: il ponte è il gruppo a cui la skill appartiene.
 *
 * La prima versione agganciava per NOME e non poteva mai funzionare: F1 elenca skill
 * («Leadership», «Innovazione»), F2 gruppi («contabilità e fiscalità») — misurato sui dati
 * veri, 0 coincidenze su 10. La regola sembrava scritta e non scattava mai. Ora il legame
 * è `sys_skills.skill_group_id`, portato da F1 fino a qui.
 */
function skillGroupOf(skill: { skillGroupId: string | null }): string | undefined {
  return skill.skillGroupId ?? undefined;
}

/**
 * Le unità nel terzile inferiore, con indicata la dimensione che le tiene indietro.
 * Il rango serve dove la fascia assoluta tace: un composito di sei dimensioni comprime la
 * varianza, e senza il rango «dove intervengo per primo» resta senza risposta (lezione F3).
 */
function ruleLaggingUnit(inputs: AdvisorInputs): AdvisorSuggestion[] {
  return inputs.orgHealth.units
    .filter((u) => u.standing === "LAGGING" && u.index !== null)
    .map((u) => {
      const worst = worstDimension(u);
      const citations: AdvisorCitation[] = [
        cite("ORG_HEALTH", ORG_HEALTH_ENDPOINT, u.orgUnitId, u.orgUnitName, "index", round(u.index!, 2)),
        cite("ORG_HEALTH", ORG_HEALTH_ENDPOINT, u.orgUnitId, u.orgUnitName, "standing", u.standing),
      ];
      if (worst) {
        citations.push(
          cite("ORG_HEALTH", ORG_HEALTH_ENDPOINT, u.orgUnitId, u.orgUnitName, `dimensions.${worst.dimension}.score`, round(worst.score!, 4)),
        );
      }
      return {
        ruleId: "LAGGING_UNIT_INTERVENE" as const,
        subjectType: "ORG_UNIT" as const,
        subjectId: u.orgUnitId,
        subjectLabel: u.orgUnitName,
        priority: clamp100(round(45 + 35 * (1 - (u.percentile ?? 0)))),
        headlineKey: "advisor.rule.laggingUnitIntervene",
        headlineParams: {
          unit: u.orgUnitName,
          index: round(u.index!, 1),
          ...(worst ? { dimension: worst.dimension, dimensionScore: round(worst.score! * 100, 1) } : {}),
        },
        citations,
      };
    });
}

/**
 * Copertura sotto la soglia: non è una diagnosi negativa, è l'assenza di una diagnosi.
 * Dirlo esplicitamente evita che un indice mancante venga letto come «va tutto bene».
 */
function ruleInsufficientCoverage(inputs: AdvisorInputs): AdvisorSuggestion[] {
  return inputs.orgHealth.units
    .filter((u) => u.coverage < inputs.orgHealth.minCoverage)
    .map((u) => {
      const missing = u.dimensions.filter((d) => d.score === null || d.sampleSize === 0).map((d) => d.dimension);
      return {
        ruleId: "INSUFFICIENT_COVERAGE_INSTRUMENT" as const,
        subjectType: "ORG_UNIT" as const,
        subjectId: u.orgUnitId,
        subjectLabel: u.orgUnitName,
        priority: clamp100(round(30 + 40 * (1 - u.coverage))),
        headlineKey: "advisor.rule.insufficientCoverageInstrument",
        headlineParams: {
          unit: u.orgUnitName,
          coverage: round(u.coverage * 100, 1),
          missing: missing.join(", "),
        },
        citations: [
          cite("ORG_HEALTH", ORG_HEALTH_ENDPOINT, u.orgUnitId, u.orgUnitName, "coverage", round(u.coverage, 4)),
          cite("ORG_HEALTH", ORG_HEALTH_ENDPOINT, u.orgUnitId, u.orgUnitName, "headcount", u.headcount),
        ],
      };
    });
}

function worstDimension(u: OrgHealthUnit) {
  const measured = u.dimensions.filter((d) => d.score !== null && d.sampleSize > 0);
  if (measured.length === 0) return null;
  return measured.reduce((a, b) => (a.score! <= b.score! ? a : b));
}

function cite(
  source: AdvisorCitation["source"],
  endpoint: string,
  subjectId: string,
  subjectLabel: string,
  field: string,
  value: number | string,
): AdvisorCitation {
  return { source, endpoint, subjectId, subjectLabel, field, value };
}

/* ------------------------------ validatore ------------------------------ */

/**
 * Ri-legge ogni citazione dalle scorecard e verifica che il valore dichiarato sia quello
 * vero. Serve contro il motore stesso: una regola che sbaglia a copiare un numero produce
 * un suggerimento plausibile e falso, che è esattamente ciò che questa capability non deve
 * poter fare.
 */
export function resolveCitation(inputs: AdvisorInputs, c: AdvisorCitation): number | string | null {
  if (c.source === "VRIO") {
    const item = inputs.vrio.items.find((i) => i.skillGroupId === c.subjectId);
    if (!item) return null;
    if (c.field === "verdict") return item.verdict;
    const key = c.field.startsWith("evidence.") ? c.field.slice("evidence.".length) : null;
    if (!key) return null;
    const v = (item.evidence as unknown as Record<string, unknown>)[key];
    return typeof v === "number" ? v : typeof v === "string" ? v : null;
  }
  if (c.source === "ESSENTIAL_RANKING") {
    const item = inputs.essential.items.find((i) => i.skillId === c.subjectId);
    if (!item) return null;
    const v = (item as unknown as Record<string, unknown>)[c.field];
    return typeof v === "number" ? v : typeof v === "string" ? v : null;
  }
  const unit = inputs.orgHealth.units.find((u) => u.orgUnitId === c.subjectId);
  if (!unit) return null;
  if (c.field.startsWith("dimensions.")) {
    const [, dim] = c.field.split(".");
    const d = unit.dimensions.find((x) => x.dimension === dim);
    return d?.score ?? null;
  }
  const v = (unit as unknown as Record<string, unknown>)[c.field];
  return typeof v === "number" ? v : typeof v === "string" ? v : null;
}

/** Tolleranza sul confronto numerico: le citazioni portano valori arrotondati alla resa. */
const EPSILON = 0.011;

export function citationHolds(inputs: AdvisorInputs, c: AdvisorCitation): boolean {
  const actual = resolveCitation(inputs, c);
  if (actual === null) return false;
  if (typeof c.value === "number" && typeof actual === "number") {
    return Math.abs(actual - c.value) <= EPSILON;
  }
  return String(actual) === String(c.value);
}

/* ------------------------------- motore -------------------------------- */

const RULES = [
  ruleCapabilityGap,
  ruleUnusedAdvantage,
  ruleFragileMastery,
  ruleLaggingUnit,
  ruleInsufficientCoverage,
] as const;

export function computeSuggestions(inputs: AdvisorInputs): {
  items: AdvisorSuggestion[];
  discarded: number;
} {
  const produced = RULES.flatMap((rule) => rule(inputs));
  const items: AdvisorSuggestion[] = [];
  let discarded = 0;
  for (const s of produced) {
    if (s.citations.length === 0 || !s.citations.every((c) => citationHolds(inputs, c))) {
      discarded += 1;
      continue;
    }
    items.push(s);
  }
  // Ordine stabile: priorità decrescente, poi soggetto — due giri sugli stessi dati
  // devono produrre la stessa lista, altrimenti "deterministico" è una parola vuota.
  items.sort((a, b) => (b.priority - a.priority) || (a.subjectLabel < b.subjectLabel ? -1 : a.subjectLabel > b.subjectLabel ? 1 : a.ruleId < b.ruleId ? -1 : 1));
  return { items, discarded };
}
