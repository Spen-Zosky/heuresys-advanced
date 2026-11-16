/**
 * Il quadro degli insight parla la lingua di chi guarda: ogni lente, per ogni valore plausibile,
 * scrive la frase in inglese diversa da quella italiana e senza parole italiane rimaste
 * (giro qa-web del 15/11: «Una richiesta di approvazione assegnata a te…» in una pagina inglese).
 * Prova pura: non tocca il database.
 */
import { describe, expect, it } from "vitest";
import { LENTI, testoPer } from "../src/modules/quadro/lenti.js";

const CAMPIONI: Array<[number, number | null]> = [
  [0, null], [0, 0], [1, null], [1, 5], [2, 0], [3, 10], [12, 40], [25, 100],
];
// parole che in un testo inglese corretto non compaiono
const ITALIANO = /\b(sono|hanno|della|delle|degli|nei|nel|una|uno|dei|che|per|con|più|giorni|persone|richiest[ae]|posizion[ei]|tuoi|tua|tue)\b/i;

function frasi(l: (typeof LENTI)[number], lingua: "it" | "en", v: number, p: number | null): string[] {
  const r = l.leggi(v, p, testoPer(lingua));
  if (!r) return [];
  return [r.titolo, r.dettaglio, r.azione?.etichetta ?? ""].filter(Boolean);
}

describe("quadro: lingua delle frasi", () => {
  it("ogni lente ha l'inglese, diverso dall'italiano e senza parole italiane", () => {
    let verificate = 0;
    for (const l of LENTI) {
      for (const [v, p] of CAMPIONI) {
        const it = frasi(l, "it", v, p);
        const en = frasi(l, "en", v, p);
        expect(en.length, `${l.chiave} ${v}/${p}: stesso numero di frasi`).toBe(it.length);
        it.forEach((f, i) => {
          expect(en[i], `${l.chiave} ${v}/${p}: «${f}» non tradotta`).not.toBe(f);
          expect(ITALIANO.test(en[i] ?? ""), `${l.chiave} ${v}/${p}: parola italiana in «${en[i]}»`).toBe(false);
          verificate += 1;
        });
      }
    }
    expect(verificate).toBeGreaterThan(100);
  });

  it("i numeri seguono la lingua", () => {
    expect(testoPer("it").n(12345)).toBe("12.345");
    expect(testoPer("en").n(12345)).toBe("12,345");
  });
});

describe("quadro: il singolare con uno (giudizio qa-web 16/11, A2)", () => {
  const lente = LENTI.find((l) => l.chiave === "posizioni-scoperte")!;

  it("«1 posizione su 4 è senza titolare», non «1 posizioni … sono»", () => {
    expect(lente.leggi(1, 4, testoPer("it"))!.titolo).toMatch(/^1 posizione su 4 è senza titolare/);
    expect(lente.leggi(1, 4, testoPer("en"))!.titolo).toMatch(/^1 of 4 position has no holder/);
  });

  it("con più di una resta il plurale", () => {
    expect(lente.leggi(3, 4, testoPer("it"))!.titolo).toMatch(/^3 posizioni su 4 sono senza titolare/);
    expect(lente.leggi(3, 4, testoPer("en"))!.titolo).toMatch(/^3 of 4 positions have no holder/);
  });
});
