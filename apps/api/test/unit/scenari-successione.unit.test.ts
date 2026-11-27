import { describe, it, expect } from "vitest";
import {
  calcolaSuccessione,
  PROFONDITA_CASCATA,
  type IngressoSuccessione,
  type PosizioneOmbra,
  type Successore,
  type TitolareOmbra,
} from "../../src/modules/scenari/calcolatori/successione.js";

/**
 * F3b-1 del piano Heuresys AI-driven: il calcolatore della successione (effetto diretto e cascata).
 * Ogni risultato atteso qui sotto è calcolato a mano sul disegno scritto accanto al caso.
 */

const pos = (id: string, codice: string, criticita: string | null = "MEDIUM"): PosizioneOmbra => ({
  id: `ombra-${id}`,
  sourceId: id,
  codice,
  titolo: `Posizione ${codice}`,
  criticita,
});
const tit = (posizione: string, userId: string, tipo = "PRIMARY"): TitolareOmbra => ({
  id: `ass-${posizione}-${userId}`,
  posizioneId: `ombra-${posizione}`,
  userId,
  tipo,
});
const suc = (posizione: string, userId: string, prontezza: Successore["prontezza"], confermato = false): Successore => ({
  posizioneSourceId: posizione,
  userId,
  prontezza,
  confermato,
});

/**
 * La catena del caso guida:
 *   P1 (codice A, CRITICAL) tenuta da U1, che esce; successore S1 pronto subito.
 *   P2 (codice B, MEDIUM)   tenuta da S1;          successore S3 pronto in un anno.
 *   P3 (codice C, HIGH)     tenuta da S3;          nessun successore.
 */
const catena: IngressoSuccessione = {
  posizioni: [pos("P1", "A", "CRITICAL"), pos("P2", "B", "MEDIUM"), pos("P3", "C", "HIGH")],
  titolari: [tit("P1", "U1"), tit("P2", "S1"), tit("P3", "S3")],
  successori: [suc("P1", "S1", "READY_NOW"), suc("P2", "S3", "READY_1_YEAR")],
  uscite: ["U1"],
};

describe("calcolatore della successione", () => {
  it("nessuna azione: la posizione liberata resta scoperta", () => {
    const e = calcolaSuccessione(catena, 0);
    expect(e.vacantiIniziali).toBe(1);
    expect(e.coperte).toBe(0);
    expect(e.scoperte).toEqual(["ombra-P1"]);
    expect(e.scoperteCritiche).toBe(1);
    expect(e.spostati).toEqual([]);
    expect(e.lunghezzaCatena).toBe(0);
    expect(e.mesiAllaCopertura).toBeNull();
    expect(e.troncata).toBe(false);
  });

  it("effetto diretto (S-T1): S1 copre P1, la sua P2 resta scoperta", () => {
    const e = calcolaSuccessione(catena, 1);
    expect(e.vacantiIniziali).toBe(1);
    expect(e.coperte).toBe(1);
    expect(e.passi).toEqual([
      { profondita: 1, posizioneId: "ombra-P1", lasciataDa: "U1", successoreUserId: "S1", mesi: 0 },
    ]);
    expect(e.scoperte).toEqual(["ombra-P2"]);
    expect(e.scoperteCritiche).toBe(0);
    expect(e.spostati).toEqual(["S1"]);
    expect(e.lunghezzaCatena).toBe(1);
    expect(e.mesiAllaCopertura).toBe(0);
    expect(e.troncata).toBe(false);
  });

  it("cascata (S-T2): S1 copre P1, S3 copre P2, P3 resta scoperta alla fine della catena", () => {
    const e = calcolaSuccessione(catena, PROFONDITA_CASCATA);
    expect(e.passi).toEqual([
      { profondita: 1, posizioneId: "ombra-P1", lasciataDa: "U1", successoreUserId: "S1", mesi: 0 },
      { profondita: 2, posizioneId: "ombra-P2", lasciataDa: "S1", successoreUserId: "S3", mesi: 12 },
      { profondita: 3, posizioneId: "ombra-P3", lasciataDa: "S3", successoreUserId: null, mesi: null },
    ]);
    expect(e.coperte).toBe(2);
    expect(e.scoperte).toEqual(["ombra-P3"]);
    expect(e.scoperteCritiche).toBe(1);
    expect(e.spostati).toEqual(["S1", "S3"]);
    expect(e.lunghezzaCatena).toBe(2);
    expect(e.mesiAllaCopertura).toBe(12);
    expect(e.troncata).toBe(false);
  });

  it("sceglie la prontezza più vicina, poi il confermato, poi l'identificativo", () => {
    const base = { posizioni: [pos("P1", "A")], titolari: [tit("P1", "U1")], uscite: ["U1"] };
    // R1 tra sei mesi e confermato, R2 subito: vince R2 (prontezza)
    expect(calcolaSuccessione({ ...base, successori: [suc("P1", "R1", "READY_6_MONTHS", true), suc("P1", "R2", "READY_NOW")] }, 1).spostati).toEqual(["R2"]);
    // stessa prontezza: vince il confermato R9 anche se il suo identificativo viene dopo
    expect(calcolaSuccessione({ ...base, successori: [suc("P1", "R1", "READY_1_YEAR"), suc("P1", "R9", "READY_1_YEAR", true)] }, 1).spostati).toEqual(["R9"]);
    // tutto pari: vince l'identificativo più piccolo, in qualunque ordine arrivino le righe
    expect(calcolaSuccessione({ ...base, successori: [suc("P1", "R7", "READY_2_YEARS"), suc("P1", "R3", "READY_2_YEARS")] }, 1).spostati).toEqual(["R3"]);
  });

  it("non candida chi non è pronto, chi esce anche lui, chi si è già spostato, chi è già titolare", () => {
    const e = calcolaSuccessione(
      {
        posizioni: [pos("P1", "A"), pos("P2", "B")],
        titolari: [tit("P1", "U1"), tit("P2", "S1"), tit("P1", "C4", "SECONDARY")],
        successori: [
          suc("P1", "N1", "NOT_READY"),
          suc("P1", "N2", null),
          suc("P1", "U2", "READY_NOW"), // esce anche lui
          suc("P1", "S1", "READY_2_YEARS"),
          suc("P2", "U1", "READY_NOW"), // esce
          suc("P2", "S1", "READY_NOW"), // si è già spostato su P1
        ],
        uscite: ["U1", "U2"],
      },
      PROFONDITA_CASCATA,
    );
    // U2 non ha posizioni: libera solo P1. P1 la copre S1 (l'unico idoneo), P2 resta senza idonei.
    expect(e.vacantiIniziali).toBe(1);
    expect(e.passi.map((p) => [p.posizioneId, p.successoreUserId])).toEqual([
      ["ombra-P1", "S1"],
      ["ombra-P2", null],
    ]);
    expect(e.scoperte).toEqual(["ombra-P2"]);
    expect(e.mesiAllaCopertura).toBe(24);
  });

  it("una posizione con un altro titolare PRIMARY non si libera", () => {
    const e = calcolaSuccessione(
      { posizioni: [pos("P1", "A")], titolari: [tit("P1", "U1"), tit("P1", "U2")], successori: [suc("P1", "S1", "READY_NOW")], uscite: ["U1"] },
      PROFONDITA_CASCATA,
    );
    expect(e.vacantiIniziali).toBe(0);
    expect(e.passi).toEqual([]);
    expect(e.scoperte).toEqual([]);
  });

  it("due uscite sulla stessa posizione la liberano una volta sola", () => {
    const e = calcolaSuccessione(
      { posizioni: [pos("P1", "A")], titolari: [tit("P1", "U1"), tit("P1", "U2")], successori: [], uscite: ["U2", "U1"] },
      1,
    );
    expect(e.vacantiIniziali).toBe(1);
    expect(e.scoperte).toEqual(["ombra-P1"]);
  });

  it("una cascata più lunga del limite si dichiara troncata", () => {
    // P0 ← K1 ← K2 ← … ← K12: ogni Ki tiene Pi ed è successore pronto di P(i-1).
    const n = 12;
    const posizioni = Array.from({ length: n + 1 }, (_, i) => pos(`P${i}`, `X${String(i).padStart(2, "0")}`));
    const titolari = [tit("P0", "U0"), ...Array.from({ length: n }, (_, i) => tit(`P${i + 1}`, `K${i + 1}`))];
    const successori = Array.from({ length: n }, (_, i) => suc(`P${i}`, `K${i + 1}`, "READY_NOW"));
    const e = calcolaSuccessione({ posizioni, titolari, successori, uscite: ["U0"] }, PROFONDITA_CASCATA);
    expect(e.coperte).toBe(PROFONDITA_CASCATA);
    expect(e.lunghezzaCatena).toBe(PROFONDITA_CASCATA);
    expect(e.scoperte).toEqual(["ombra-P10"]);
    expect(e.troncata).toBe(true);
    // lo stesso limite su una catena che finisce prima non tronca
    expect(calcolaSuccessione(catena, PROFONDITA_CASCATA).troncata).toBe(false);
  });

  it("lo stesso ingresso in un altro ordine dà lo stesso esito", () => {
    const rovescio: IngressoSuccessione = {
      posizioni: [...catena.posizioni].reverse(),
      titolari: [...catena.titolari].reverse(),
      successori: [...catena.successori].reverse(),
      uscite: [...catena.uscite].reverse(),
    };
    expect(calcolaSuccessione(rovescio, PROFONDITA_CASCATA)).toEqual(calcolaSuccessione(catena, PROFONDITA_CASCATA));
  });

  it("rifiuta una profondità non valida", () => {
    expect(() => calcolaSuccessione(catena, -1)).toThrow();
    expect(() => calcolaSuccessione(catena, 1.5)).toThrow();
  });
});
