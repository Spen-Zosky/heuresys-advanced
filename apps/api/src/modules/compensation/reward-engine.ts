/**
 * apps/api/src/modules/compensation/reward-engine.ts
 * #37 (linea B2) — il motore che mancava fra i KPI e la retribuzione variabile.
 *
 * Cosa c'era prima: le tabelle. `sys_payout_curves` conserva la forma delle
 * curve (LINEAR, CAPPED, STEPPED, SIGMOID) e `sys_reward_gate_results` gli
 * esiti dei cancelli — ma nessuna riga di codice leggeva una curva per
 * calcolare un fattore, e nessuna aggregava gli esiti per dire se un premio si
 * possa erogare. I calcoli in `sys_variable_pay_calculations` citano una curva
 * (`payload->>'curve'`) e un raggiungimento (`attainment`) senza che nessuno li
 * mettesse in relazione.
 *
 * Cosa fa questo file: due funzioni pure, entrambe verificabili a mano.
 *
 *   payoutFactor(curva, raggiungimento) → fattore di erogazione
 *   aggregateGates(esiti)               → decisione complessiva
 *
 * Sono pure di proposito: il motore di un premio deve poter essere ricontrollato
 * da chi il premio lo riceve, e una funzione che non tocca il database si
 * ricontrolla con una calcolatrice.
 */

/** Forme ammesse dal CHECK su `sys_payout_curves.payout_curve_kind`. */
export type PayoutCurveKind = "LINEAR" | "CAPPED" | "STEPPED" | "SIGMOID";

export interface PayoutCurveInput {
  code: string;
  kind: PayoutCurveKind;
  /** `payout_curve_payload` — i parametri della curva, per forma. */
  payload: Record<string, unknown>;
}

export interface PayoutFactorResult {
  factor: number;
  /** Come si è arrivati a quel numero, in chiaro. */
  explanation: string;
  /** Il fattore è stato tagliato da un tetto o da una soglia. */
  clamped: boolean;
}

function num(payload: Record<string, unknown>, key: string, fallback: number): number {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Il fattore di erogazione per un dato raggiungimento.
 *
 * `attainment` è il rapporto fra risultato e obiettivo: 1.0 = obiettivo
 * centrato. Il fattore che esce moltiplica il premio target.
 */
export function payoutFactor(curve: PayoutCurveInput, attainment: number): PayoutFactorResult {
  if (!Number.isFinite(attainment)) {
    throw new Error(`attainment must be a finite number, got ${attainment}`);
  }
  const p = curve.payload;

  switch (curve.kind) {
    case "LINEAR": {
      // Il fattore segue il raggiungimento, contenuto fra un minimo e un massimo.
      const min = num(p, "min", 0);
      const max = num(p, "max", Number.POSITIVE_INFINITY);
      const raw = attainment;
      const factor = Math.min(Math.max(raw, min), max);
      return {
        factor,
        clamped: factor !== raw,
        explanation: `LINEAR: fattore = raggiungimento ${attainment} contenuto fra ${min} e ${max} → ${factor}`,
      };
    }

    case "CAPPED": {
      // Sotto la soglia non si eroga nulla; alla soglia si parte dal pavimento;
      // da lì si sale linearmente fino all'obiettivo (fattore 1) e oltre, fino
      // al tetto.
      const threshold = num(p, "threshold", 0);
      const target = num(p, "target", 1);
      const cap = num(p, "cap", Number.POSITIVE_INFINITY);
      const floor = num(p, "floor_payout", 0);

      if (attainment < threshold) {
        return {
          factor: 0,
          clamped: true,
          explanation: `CAPPED: raggiungimento ${attainment} sotto la soglia ${threshold} → nessuna erogazione`,
        };
      }
      // Interpolazione fra (soglia → pavimento) e (obiettivo → 1).
      const span = target - threshold;
      const raw = span === 0
        ? Math.max(floor, 1)
        : floor + ((attainment - threshold) / span) * (1 - floor);
      const factor = Math.min(raw, cap);
      return {
        factor,
        clamped: factor !== raw,
        explanation:
          `CAPPED: fra soglia ${threshold} (pavimento ${floor}) e obiettivo ${target} (fattore 1), ` +
          `raggiungimento ${attainment} → ${raw.toFixed(4)}${factor !== raw ? `, tagliato al tetto ${cap}` : ""}`,
      };
    }

    case "STEPPED": {
      // Scalini espliciti: il primo scalino la cui soglia è superata vince.
      // `steps` = [{ from: number, factor: number }, ...]
      const rawSteps = Array.isArray(p["steps"]) ? (p["steps"] as unknown[]) : [];
      const steps = rawSteps
        .filter((s): s is { from: number; factor: number } =>
          typeof s === "object" && s !== null &&
          typeof (s as { from?: unknown }).from === "number" &&
          typeof (s as { factor?: unknown }).factor === "number")
        .sort((a, b) => a.from - b.from);
      if (steps.length === 0) {
        return { factor: 0, clamped: false, explanation: "STEPPED: nessuno scalino definito → 0" };
      }
      let chosen: { from: number; factor: number } | null = null;
      for (const s of steps) if (attainment >= s.from) chosen = s;
      return {
        factor: chosen?.factor ?? 0,
        clamped: false,
        explanation: chosen
          ? `STEPPED: raggiungimento ${attainment} ricade nello scalino da ${chosen.from} → ${chosen.factor}`
          : `STEPPED: raggiungimento ${attainment} sotto il primo scalino (${steps[0]!.from}) → 0`,
      };
    }

    case "SIGMOID": {
      // Curva a S centrata sull'obiettivo: penalizza lo scarto sotto e satura
      // sopra, invece di premiare linearmente ogni decimale.
      const midpoint = num(p, "midpoint", 1);
      const steepness = num(p, "steepness", 4);
      const cap = num(p, "cap", Number.POSITIVE_INFINITY);
      const raw = 2 / (1 + Math.exp(-steepness * (attainment - midpoint)));
      const factor = Math.min(raw, cap);
      return {
        factor,
        clamped: factor !== raw,
        explanation:
          `SIGMOID: centro ${midpoint}, pendenza ${steepness}, raggiungimento ${attainment} → ` +
          `${raw.toFixed(4)}${factor !== raw ? `, tagliato al tetto ${cap}` : ""}`,
      };
    }
  }
}

// --------------------------------------------------------------- cancelli

/** Stati ammessi dai dati reali di `sys_reward_gate_results`. */
export type GateStatus = "PASSED" | "WARNING" | "BLOCKED" | "OVERRIDDEN_WITH_REASON";

export interface GateOutcome {
  gateCode: string;
  gateName: string;
  /** Un cancello non bloccante segnala e basta: non ferma l'erogazione. */
  isBlocking: boolean;
  status: GateStatus;
  overrideReason: string | null;
}

export type GateDecision = "ALLOW" | "ALLOW_WITH_WARNING" | "BLOCK";

export interface GateAggregate {
  decision: GateDecision;
  /** I cancelli che hanno determinato la decisione. */
  blocking: GateOutcome[];
  warnings: GateOutcome[];
  overridden: GateOutcome[];
  explanation: string;
}

/**
 * La decisione complessiva a partire dagli esiti dei singoli cancelli.
 *
 * Regole, nell'ordine:
 *   - un cancello BLOCCANTE in stato BLOCKED ferma tutto;
 *   - una deroga motivata (OVERRIDDEN_WITH_REASON) lascia passare, ma resta
 *     scritta: chi ha derogato deve poter essere chiamato a risponderne;
 *   - un cancello non bloccante non ferma mai nulla, nemmeno se BLOCKED —
 *     altrimenti "non bloccante" non vorrebbe dire niente;
 *   - i WARNING lasciano passare e restano visibili.
 */
export function aggregateGates(outcomes: GateOutcome[]): GateAggregate {
  const blocking = outcomes.filter((o) => o.isBlocking && o.status === "BLOCKED");
  const overridden = outcomes.filter((o) => o.status === "OVERRIDDEN_WITH_REASON");
  const warnings = outcomes.filter((o) => o.status === "WARNING" ||
    (!o.isBlocking && o.status === "BLOCKED"));

  if (blocking.length > 0) {
    return {
      decision: "BLOCK",
      blocking, warnings, overridden,
      explanation:
        `Erogazione bloccata da ${blocking.length} cancello/i vincolante/i: ` +
        blocking.map((b) => b.gateCode).join(", "),
    };
  }
  if (overridden.length > 0 || warnings.length > 0) {
    const parts: string[] = [];
    if (overridden.length > 0) {
      parts.push(`${overridden.length} deroga/he motivata/e (${overridden.map((o) => o.gateCode).join(", ")})`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} segnalazione/i (${warnings.map((w) => w.gateCode).join(", ")})`);
    }
    return {
      decision: "ALLOW_WITH_WARNING",
      blocking, warnings, overridden,
      explanation: `Erogazione consentita con riserva: ${parts.join(" · ")}`,
    };
  }
  return {
    decision: "ALLOW",
    blocking, warnings, overridden,
    explanation: outcomes.length === 0
      ? "Nessun cancello applicabile al periodo: nulla da verificare"
      : `Tutti i ${outcomes.length} cancelli superati`,
  };
}

/**
 * Il fattore finale: la curva dice quanto spetterebbe, i cancelli dicono se
 * spetta. Un blocco porta a zero — non a una riduzione — perché un cancello
 * vincolante non è uno sconto.
 */
export function finalFactor(curveFactor: number, decision: GateDecision): number {
  return decision === "BLOCK" ? 0 : curveFactor;
}
