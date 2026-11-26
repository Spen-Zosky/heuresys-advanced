import { describe, expect, it } from "vitest";
import { riduciElenco, TETTO_ELENCO } from "../src/elenco-grande.js";

// La forma del rischio di uscita: tante persone, ciascuna con la spiegazione voce per voce.
const riga = (i: number) => ({
  userId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  displayName: `Persona, ${i}`,
  score: i,
  band: i % 20 === 0 ? "MEDIUM" : "LOW",
  features: Array.from({ length: 6 }, (_, j) => ({ feature: `f${j}`, raw: 0.123456789, weight: 0.1666, normalized: 50, contribution: 8.33 })),
});
const elenco = (n: number) => ({ scope: { kind: "TEAM" }, items: Array.from({ length: n }, (_, i) => riga(i)), total: n });
type Esito = { items: Array<Record<string, unknown>>; total: number; nota?: string };

describe("un elenco troppo grande", () => {
  it("sotto il tetto non cambia niente", () => {
    const d = elenco(3);
    expect(riduciElenco(d, { band: "MEDIUM", limit: 1 })).toBe(d);
  });

  it("80 persone entrano tutte, senza il dettaglio", () => {
    const d = elenco(80);
    expect(JSON.stringify(d).length).toBeGreaterThan(TETTO_ELENCO);
    const r = riduciElenco(d) as Esito;
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(TETTO_ELENCO + 500);
    expect(r.items).toHaveLength(80);
    expect(r.items[0]).not.toHaveProperty("features");
    expect(r.nota).toContain("features");
  });

  it("il filtro su un campo delle righe si applica, e il totale è quello filtrato", () => {
    const r = riduciElenco(elenco(80), { band: "MEDIUM" }) as Esito;
    expect(r.items.map((x) => x["score"])).toEqual([0, 20, 40, 60]);
    expect(r.total).toBe(4);
  });

  it("un filtro che non è un campo delle righe non filtra", () => {
    expect((riduciElenco(elenco(80), { q: "Persona" }) as Esito).items).toHaveLength(80);
  });

  it("le pagine si seguono fino in fondo senza perdere righe", () => {
    const visti: unknown[] = [];
    for (let offset = 0; ; ) {
      const r = riduciElenco(elenco(900), { offset }) as Esito;
      visti.push(...r.items.map((x) => x["score"]));
      const m = /offset=(\d+)/.exec(r.nota ?? "");
      if (!m) break;
      offset = Number(m[1]);
    }
    expect(visti).toHaveLength(900);
    expect(new Set(visti).size).toBe(900);
  });

  it("se le pagine le fa già l'API, il gateway non salta righe", () => {
    const parziale = { ...elenco(80), total: 500 };
    const r = riduciElenco(parziale, { offset: 160, limit: 80 }) as Esito;
    expect(r.items[0]?.["score"]).toBe(0);
    expect(r.total).toBe(500);
    expect(r.nota).toContain("offset=240");
  });

  it("i campi mascherati restano dichiarati", () => {
    const d = { items: Array.from({ length: 900 }, (_, i) => ({ ...riga(i), masked: ["score"] })), total: 900 };
    expect((riduciElenco(d) as Esito).items[0]).toHaveProperty("masked");
  });
});
