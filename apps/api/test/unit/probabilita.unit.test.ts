/**
 * F3c — le probabilità dalla storia: prove della parte pura (probabilita.ts).
 * I valori attesi sono calcolati a mano o con formule chiuse, scritte accanto.
 */
import { describe, expect, it } from "vitest";
import { ScenarioAssumptionSchema } from "@heuresys/shared";
import {
  betaCdf,
  betaQuantile,
  comeIpotesi,
  DICHIARAZIONE_STORIA_GENERATA,
  durataBootstrap,
  frequenzaJeffreys,
  intervalloPredittivoUscite,
  lnGamma,
  provaSuPeriodoTenutoDaParte,
  quantileEmpirico,
  suPiuPeriodi,
  tassoTrimestraleUscita,
} from "../../src/modules/insights/probabilita.js";

describe("funzioni speciali", () => {
  it("lnGamma coincide con i fattoriali e con Γ(1/2) = √π", () => {
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(lnGamma(10)).toBeCloseTo(Math.log(362880), 9);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it("betaCdf: Beta(1,1) è uniforme, Beta(2,1) è x², Beta(1,3) è 1-(1-x)³", () => {
    expect(betaCdf(0.3, 1, 1)).toBeCloseTo(0.3, 12);
    expect(betaCdf(0.6, 2, 1)).toBeCloseTo(0.36, 12);
    expect(betaCdf(0.2, 1, 3)).toBeCloseTo(1 - 0.8 ** 3, 12);
  });

  it("betaQuantile inverte betaCdf", () => {
    expect(betaQuantile(0.36, 2, 1)).toBeCloseTo(0.6, 9);
    for (const [p, a, b] of [[0.05, 3.5, 40.5], [0.95, 0.5, 600.5], [0.5, 7, 3]] as const) {
      expect(betaCdf(betaQuantile(p, a, b), a, b)).toBeCloseTo(p, 9);
    }
  });
});

describe("frequenza di Jeffreys", () => {
  it("con k = 0 la stima non è zero e la banda parte da zero", () => {
    const s = frequenzaJeffreys(0, 100);
    // media a posteriori 0,5 / 101
    expect(s.valore).toBeCloseTo(0.5 / 101, 12);
    expect(s.low).toBeLessThan(1e-4);
    expect(s.high).toBeGreaterThan(s.valore);
    expect(s.casi).toBe(100);
  });

  it("è simmetrica: k su n e n-k su n si specchiano", () => {
    const a = frequenzaJeffreys(3, 20);
    const b = frequenzaJeffreys(17, 20);
    expect(a.valore + b.valore).toBeCloseTo(1, 12);
    expect(a.low + b.high).toBeCloseTo(1, 9);
  });

  it("la banda si stringe con più casi a parità di frequenza", () => {
    const poca = frequenzaJeffreys(2, 40);
    const tanta = frequenzaJeffreys(20, 400);
    expect(tanta.high - tanta.low).toBeLessThan(poca.high - poca.low);
  });

  it("rifiuta frequenze impossibili", () => {
    expect(() => frequenzaJeffreys(5, 3)).toThrow(RangeError);
    expect(() => frequenzaJeffreys(1, 3, 1)).toThrow(RangeError);
  });

  it("su più periodi: 1-(1-q)^t su valore ed estremi", () => {
    const s = { valore: 0.1, low: 0.05, high: 0.2, livello: 0.9, casi: 10 };
    const t = suPiuPeriodi(s, 4);
    expect(t.valore).toBeCloseTo(1 - 0.9 ** 4, 12);
    expect(t.low).toBeCloseTo(1 - 0.95 ** 4, 12);
    expect(t.high).toBeCloseTo(1 - 0.8 ** 4, 12);
  });
});

describe("tempi", () => {
  it("quantile empirico di tipo 7", () => {
    expect(quantileEmpirico([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileEmpirico([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantileEmpirico([7], 0.9)).toBe(7);
  });

  it("bootstrap: riproducibile, la banda contiene la mediana, null con meno di due casi", () => {
    const giorni = [30, 35, 41, 44, 52, 60, 61, 75, 90, 120];
    const a = durataBootstrap(giorni);
    const b = durataBootstrap(giorni);
    expect(a).toEqual(b);
    expect(a?.valore).toBe(56);
    expect(a!.low).toBeLessThanOrEqual(56);
    expect(a!.high).toBeGreaterThanOrEqual(56);
    expect(a!.high).toBeLessThanOrEqual(120);
    expect(durataBootstrap([40])).toBeNull();
  });
});

describe("uscite e prova sul periodo tenuto da parte", () => {
  const trimestri = [
    { inizio: "2024-01-01", esposti: 150, uscite: 2 },
    { inizio: "2024-04-01", esposti: 152, uscite: 1 },
    { inizio: "2024-07-01", esposti: 155, uscite: 3 },
    { inizio: "2024-10-01", esposti: 156, uscite: 2 },
    { inizio: "2025-01-01", esposti: 158, uscite: 2 },
    { inizio: "2025-04-01", esposti: 160, uscite: 1 },
  ];

  it("il tasso usa le persone-trimestre", () => {
    const s = tassoTrimestraleUscita(trimestri);
    expect(s.casi).toBe(931);
    expect(s.valore).toBeCloseTo(11.5 / 932, 12);
  });

  it("l'intervallo predittivo contiene l'atteso e ha estremi interi", () => {
    const p = intervalloPredittivoUscite(8, 613, 318);
    expect(p.atteso).toBeCloseTo((318 * 8.5) / 614, 9);
    expect(Number.isInteger(p.low) && Number.isInteger(p.high)).toBe(true);
    expect(p.low).toBeLessThanOrEqual(p.atteso);
    expect(p.high).toBeGreaterThanOrEqual(p.atteso);
  });

  it("stima prima del taglio, prova dopo: 3 uscite vere su 318 dentro la banda", () => {
    const r = provaSuPeriodoTenutoDaParte(trimestri, "2025-01-01");
    expect(r.trimestriStima).toBe(4);
    expect(r.trimestriProva).toBe(2);
    expect(r.usciteVere).toBe(3);
    expect(r.dentro).toBe(true);
  });

  it("se le uscite dopo il taglio esplodono, la prova lo dice", () => {
    const r = provaSuPeriodoTenutoDaParte(
      [...trimestri.slice(0, 4), { inizio: "2025-01-01", esposti: 158, uscite: 40 }],
      "2025-01-01",
    );
    expect(r.dentro).toBe(false);
  });

  it("un taglio che non lascia due parti è rifiutato", () => {
    expect(() => provaSuPeriodoTenutoDaParte(trimestri, "2030-01-01")).toThrow(RangeError);
  });
});

describe("dalla stima all'ipotesi dello scenario", () => {
  it("l'ipotesi passa lo schema del motore e dichiara la storia generata", () => {
    const ip = comeIpotesi(suPiuPeriodi(frequenzaJeffreys(9, 900), 4), {
      statement: "Probabilità che una persona esca entro dodici mesi.",
      unit: "%",
      scala: 100,
      metodo: "Beta di Jeffreys sulle persone-trimestre",
      fonte: { ref: "/insights", label: "Storia delle uscite di RTL Bank" },
      storiaGenerata: true,
    });
    const { dettaglio, ...riga } = ip;
    const parsed = ScenarioAssumptionSchema.safeParse({
      ...riga,
      id: "00000000-0000-4000-8000-000000000001",
      optionId: null,
      sources: riga.sources.map((s, i) => ({ ...s, id: `00000000-0000-4000-8000-00000000001${i}` })),
    });
    expect(parsed.success).toBe(true);
    expect(ip.statement).toContain(DICHIARAZIONE_STORIA_GENERATA);
    expect(dettaglio.storiaGenerata).toBe(true);
    expect(ip.low).toBeLessThanOrEqual(ip.value);
    expect(ip.value).toBeLessThanOrEqual(ip.high);
  });

  it("senza storia generata la dichiarazione non compare", () => {
    const ip = comeIpotesi(frequenzaJeffreys(1, 10), {
      statement: "x.",
      unit: "%",
      scala: 100,
      metodo: "m",
      fonte: { ref: "/insights", label: "l" },
      storiaGenerata: false,
    });
    expect(ip.statement).toBe("x.");
    expect(ip.dettaglio.dichiarazione).toBeNull();
  });
});
