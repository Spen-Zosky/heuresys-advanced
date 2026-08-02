/**
 * apps/api/test/unit/reward-engine.unit.test.ts
 * #37 (B2) — il motore delle curve e dei cancelli.
 *
 * I parametri delle curve NON sono inventati per il test: sono quelli reali di
 * `sys.sys_payout_curves` (MBO_STANDARD, VAP_LINEAR, EXEC_SIGMOID), ricopiati
 * qui perché un test unitario non tocca il database. La coerenza fra questi
 * valori e le righe vive è verificata dal test di integrazione compagno.
 */
import { describe, it, expect } from "vitest";
import {
  payoutFactor, aggregateGates, finalFactor,
  type PayoutCurveInput, type GateOutcome,
} from "../../src/modules/compensation/reward-engine.js";

const MBO: PayoutCurveInput = {
  code: "MBO_STANDARD", kind: "CAPPED",
  payload: { cap: 1.5, target: 1.0, threshold: 0.8, floor_payout: 0.5 },
};
const VAP: PayoutCurveInput = {
  code: "VAP_LINEAR", kind: "LINEAR",
  payload: { max: 1.2, min: 0 },
};
const EXEC: PayoutCurveInput = {
  code: "EXEC_SIGMOID", kind: "SIGMOID",
  payload: { cap: 1.5, midpoint: 1.0, steepness: 4 },
};

describe("payoutFactor — curve reali", () => {
  it("CAPPED: sotto la soglia non eroga nulla", () => {
    const r = payoutFactor(MBO, 0.79);
    expect(r.factor).toBe(0);
    expect(r.clamped).toBe(true);
  });

  it("CAPPED: alla soglia esatta eroga il pavimento", () => {
    expect(payoutFactor(MBO, 0.8).factor).toBeCloseTo(0.5, 6);
  });

  it("CAPPED: a obiettivo centrato eroga esattamente 1", () => {
    expect(payoutFactor(MBO, 1.0).factor).toBeCloseTo(1.0, 6);
  });

  it("CAPPED: a metà strada fra soglia e obiettivo eroga metà del divario", () => {
    // 0.9 è a metà fra 0.8 e 1.0 → a metà fra 0.5 e 1.0.
    expect(payoutFactor(MBO, 0.9).factor).toBeCloseTo(0.75, 6);
  });

  it("CAPPED: oltre l'obiettivo sale, ma si ferma al tetto", () => {
    expect(payoutFactor(MBO, 1.2).factor).toBeCloseTo(1.5, 6);
    const oltre = payoutFactor(MBO, 3.0);
    expect(oltre.factor).toBe(1.5);
    expect(oltre.clamped).toBe(true);
  });

  it("LINEAR: segue il raggiungimento e rispetta il massimo", () => {
    expect(payoutFactor(VAP, 0.6).factor).toBeCloseTo(0.6, 6);
    expect(payoutFactor(VAP, 1.0).factor).toBeCloseTo(1.0, 6);
    expect(payoutFactor(VAP, 5).factor).toBe(1.2);
    expect(payoutFactor(VAP, -3).factor).toBe(0);
  });

  it("SIGMOID: vale 1 al centro ed è monotona crescente", () => {
    expect(payoutFactor(EXEC, 1.0).factor).toBeCloseTo(1.0, 6);
    const sotto = payoutFactor(EXEC, 0.8).factor;
    const centro = payoutFactor(EXEC, 1.0).factor;
    const sopra = payoutFactor(EXEC, 1.2).factor;
    expect(sotto).toBeLessThan(centro);
    expect(centro).toBeLessThan(sopra);
    // e satura al tetto invece di crescere all'infinito
    expect(payoutFactor(EXEC, 10).factor).toBe(1.5);
  });

  it("STEPPED: sceglie l'ultimo scalino superato", () => {
    const stepped: PayoutCurveInput = {
      code: "TEST_STEPPED", kind: "STEPPED",
      payload: { steps: [{ from: 0.8, factor: 0.5 }, { from: 1.0, factor: 1 }, { from: 1.2, factor: 1.4 }] },
    };
    expect(payoutFactor(stepped, 0.7).factor).toBe(0);
    expect(payoutFactor(stepped, 0.8).factor).toBe(0.5);
    expect(payoutFactor(stepped, 1.19).factor).toBe(1);
    expect(payoutFactor(stepped, 1.25).factor).toBe(1.4);
  });

  it("rifiuta un raggiungimento non numerico invece di produrre NaN", () => {
    expect(() => payoutFactor(MBO, Number.NaN)).toThrow();
  });
});

describe("aggregateGates — decisione complessiva", () => {
  const gate = (over: Partial<GateOutcome>): GateOutcome => ({
    gateCode: "X", gateName: "X", isBlocking: true, status: "PASSED", overrideReason: null, ...over,
  });

  it("tutti superati → consentito", () => {
    const r = aggregateGates([gate({}), gate({ gateCode: "Y" })]);
    expect(r.decision).toBe("ALLOW");
  });

  it("un cancello vincolante bloccato ferma l'erogazione", () => {
    const r = aggregateGates([gate({}), gate({ gateCode: "RISK_GATE", status: "BLOCKED" })]);
    expect(r.decision).toBe("BLOCK");
    expect(r.blocking.map((b) => b.gateCode)).toEqual(["RISK_GATE"]);
  });

  it("un cancello NON vincolante bloccato non ferma nulla: segnala", () => {
    const r = aggregateGates([gate({ gateCode: "SOFT", isBlocking: false, status: "BLOCKED" })]);
    expect(r.decision).toBe("ALLOW_WITH_WARNING");
    expect(r.warnings.map((w) => w.gateCode)).toEqual(["SOFT"]);
  });

  it("una deroga motivata lascia passare ma resta scritta", () => {
    const r = aggregateGates([
      gate({ gateCode: "CONDUCT_GATE", status: "OVERRIDDEN_WITH_REASON", overrideReason: "Delibera CdA 12/2026" }),
    ]);
    expect(r.decision).toBe("ALLOW_WITH_WARNING");
    expect(r.overridden[0]!.overrideReason).toBe("Delibera CdA 12/2026");
  });

  it("un blocco vero prevale su una deroga su un ALTRO cancello", () => {
    const r = aggregateGates([
      gate({ gateCode: "CONDUCT_GATE", status: "OVERRIDDEN_WITH_REASON", overrideReason: "motivo" }),
      gate({ gateCode: "RISK_GATE", status: "BLOCKED" }),
    ]);
    expect(r.decision).toBe("BLOCK");
  });

  it("nessun cancello applicabile → consentito, e lo dice", () => {
    const r = aggregateGates([]);
    expect(r.decision).toBe("ALLOW");
    expect(r.explanation).toContain("Nessun cancello");
  });
});

describe("finalFactor", () => {
  it("un blocco porta a zero, non a una riduzione", () => {
    expect(finalFactor(1.35, "BLOCK")).toBe(0);
  });
  it("una riserva non tocca il fattore", () => {
    expect(finalFactor(1.35, "ALLOW_WITH_WARNING")).toBe(1.35);
    expect(finalFactor(1.35, "ALLOW")).toBe(1.35);
  });
});
