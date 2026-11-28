import { describe, it, expect } from "vitest";
import {
  calcolaNelTempo,
  GIORNI_PER_MESE,
  trimestraleDaAnnuo,
  type IngressoNelTempo,
  type PosizioneNelTempo,
} from "../../src/modules/scenari/calcolatori/nel-tempo.js";
import type { Successore, TitolareOmbra } from "../../src/modules/scenari/calcolatori/successione.js";

/**
 * F3b-3 del piano Heuresys AI-driven: la famiglia NEL TEMPO (S-T3). Ogni atteso è calcolato a mano
 * sul disegno accanto al caso; le uscite si fissano con `tassoPerPersona` (quasi 1 = esce nel primo
 * trimestre, a metà, cioè al mese 1,5; 0 = non esce mai).
 */
const QUASI_UNO = 1 - 1e-12;
const pos = (id: string, codice: string, criticita: string, unitaId: string | null = "UA"): PosizioneNelTempo => ({
  id: `ombra-${id}`, sourceId: id, codice, titolo: `Posizione ${codice}`, criticita, unitaId,
});
const tit = (posizione: string, userId: string): TitolareOmbra => ({ id: `a-${posizione}`, posizioneId: `ombra-${posizione}`, userId, tipo: "PRIMARY" });
const suc = (posizione: string, userId: string, prontezza: Successore["prontezza"]): Successore => ({ posizioneSourceId: posizione, userId, prontezza, confermato: false });

/**
 * Il caso guida, unità UA con tre posizioni:
 *   P1 (A, CRITICAL) tenuta da U1, che esce al mese 1,5; successore S1 pronto in 6 mesi.
 *   P2 (B, MEDIUM)   tenuta da S1, che non esce;          successore S2 pronto subito (S2 non ha posizione).
 *   P3 (C, MEDIUM)   tenuta da X, che non esce.
 */
const base = (over: Partial<IngressoNelTempo> = {}): IngressoNelTempo => ({
  posizioni: [pos("P1", "A", "CRITICAL"), pos("P2", "B", "MEDIUM"), pos("P3", "C", "MEDIUM")],
  titolari: [tit("P1", "U1"), tit("P2", "S1"), tit("P3", "X")],
  successori: [suc("P1", "S1", "READY_6_MONTHS"), suc("P2", "S2", "READY_NOW")],
  tasso: { tipo: "IMPOSTO", trimestrale: 0 },
  tassoPerPersona: new Map([["U1", QUASI_UNO], ["S1", 0], ["X", 0]]),
  giorniSelezione: [],
  orizzontiMesi: [3, 6, 12],
  estrazioni: 5,
  seme: 7,
  ...over,
});

const a = (e: ReturnType<typeof calcolaNelTempo>, mesi: number) => e.orizzonti.find((o) => o.mesi === mesi)!;

describe("calcolatore nel tempo", () => {
  it("nessuna copertura: P1 scoperta dal mese 1,5 a ogni orizzonte", () => {
    const e = calcolaNelTempo(base(), "NESSUNA");
    expect(a(e, 3).uscite.mediana).toBe(1);
    expect(a(e, 3).posizioniScoperte.mediana).toBe(1);
    expect(a(e, 3).posizioniCriticheScoperte.mediana).toBe(1);
    expect(a(e, 3).mesiDiScopertura.mediana).toBe(1.5);
    expect(a(e, 12).posizioniScoperte.mediana).toBe(1);
    expect(a(e, 12).mesiDiScopertura.mediana).toBe(10.5); // 12 − 1,5
    expect(a(e, 12).personeSpostate.mediana).toBe(0);
    expect(a(e, 12).probabilitaCriticaScoperta).toBe(1);
  });

  it("copertura interna: S1 copre P1 al mese 7,5, S2 copre P2 nello stesso istante", () => {
    const e = calcolaNelTempo(base(), "INTERNA");
    expect(a(e, 6).posizioniScoperte.mediana).toBe(1); // 1,5 ≤ 6 < 7,5
    expect(a(e, 6).mesiDiScopertura.mediana).toBe(4.5);
    expect(a(e, 6).personeSpostate.mediana).toBe(0);
    expect(a(e, 12).posizioniScoperte.mediana).toBe(0);
    expect(a(e, 12).mesiDiScopertura.mediana).toBe(6); // da 1,5 a 7,5; P2 non resta mai vuota
    expect(a(e, 12).personeSpostate.mediana).toBe(2);
    expect(a(e, 12).probabilitaCriticaScoperta).toBe(0);
    expect(a(e, 12).uscite.mediana).toBe(1);
  });

  it("copertura esterna: senza successori P1 si copre da fuori dopo la selezione di tre mesi", () => {
    const e = calcolaNelTempo(base({ successori: [], giorniSelezione: [3 * GIORNI_PER_MESE] }), "INTERNA_ED_ESTERNA");
    expect(a(e, 3).posizioniScoperte.mediana).toBe(1);
    expect(a(e, 6).posizioniScoperte.mediana).toBe(0); // assunta al mese 4,5
    expect(a(e, 6).mesiDiScopertura.mediana).toBeCloseTo(3, 6);
    expect(a(e, 6).assunzioniEsterne.mediana).toBe(1);
    expect(a(e, 3).assunzioniEsterne.mediana).toBe(0);
  });

  it("senza durate di selezione la copertura esterna non copre niente", () => {
    const e = calcolaNelTempo(base({ successori: [] }), "INTERNA_ED_ESTERNA");
    expect(a(e, 12).posizioniScoperte.mediana).toBe(1);
    expect(a(e, 12).assunzioniEsterne.mediana).toBe(0);
  });

  it("l'unità cede quando ha scoperto almeno un quarto delle sue posizioni", () => {
    const nessuna = calcolaNelTempo(base(), "NESSUNA");
    expect(nessuna.unitaCheCedono[12]).toEqual([{ unitaId: "UA", posizioni: 3, probabilita: 1 }]); // 1/3 ≥ 1/4
    const interna = calcolaNelTempo(base(), "INTERNA");
    expect(interna.unitaCheCedono[6]).toEqual([{ unitaId: "UA", posizioni: 3, probabilita: 1 }]);
    expect(interna.unitaCheCedono[12]).toEqual([]);
  });

  it("tutti escono nel primo trimestre: con copertura esterna i nuovi escono a loro volta", () => {
    // tasso quasi 1 per tutti: tre uscite al mese 1,5, tre assunzioni al mese 1,5 + 2 = 3,5,
    // i tre nuovi escono al mese 4,5 e sono sostituiti al mese 6,5: a 6 mesi sei uscite, tre posizioni vuote.
    const x = base({ successori: [], tasso: { tipo: "IMPOSTO", trimestrale: QUASI_UNO }, tassoPerPersona: new Map(), giorniSelezione: [2 * GIORNI_PER_MESE] });
    const e = calcolaNelTempo(x, "INTERNA_ED_ESTERNA");
    expect(a(e, 6).uscite.mediana).toBe(6);
    expect(a(e, 6).assunzioniEsterne.mediana).toBe(3);
    expect(a(e, 6).posizioniScoperte.mediana).toBe(3);
    expect(a(e, 6).mesiDiScopertura.mediana).toBeCloseTo(3 * 2 + 3 * 1.5, 6); // [1,5-3,5) e [4,5-6)
  });

  it("stesso seme, stesso esito; le opzioni vedono le stesse uscite", () => {
    const x = base({ tasso: { tipo: "STIMA", a: 2.5, b: 40 }, tassoPerPersona: undefined, estrazioni: 300, orizzontiMesi: [12, 36] });
    const uno = calcolaNelTempo(x, "INTERNA");
    expect(calcolaNelTempo(x, "INTERNA")).toEqual(uno);
    const nessuna = calcolaNelTempo(x, "NESSUNA");
    // le uscite delle persone della fotografia sono le stesse; con la copertura interna escono al più anche i successori spostati
    expect(a(uno, 36).uscite.mediana).toBeGreaterThanOrEqual(a(nessuna, 36).uscite.mediana);
    expect(a(uno, 36).posizioniScoperte.mediana).toBeLessThanOrEqual(a(nessuna, 36).posizioniScoperte.mediana);
  });

  it("con la stima il tasso si estrae dalla Beta: la media delle estrazioni sta vicino ad a/(a+b)", () => {
    const x = base({ tasso: { tipo: "STIMA", a: 16.5, b: 1997.5 }, tassoPerPersona: undefined, estrazioni: 2000 });
    const e = calcolaNelTempo(x, "NESSUNA");
    expect(e.tassoTrimestraleMedio).toBeCloseTo(16.5 / 2014, 3);
  });

  it("dal tasso annuo al trimestrale: 1 − (1 − 0,1)^(1/4)", () => {
    expect(trimestraleDaAnnuo(0.1)).toBeCloseTo(0.025996, 6);
    expect(1 - Math.pow(1 - trimestraleDaAnnuo(0.1), 4)).toBeCloseTo(0.1, 12);
  });

  it("rifiuta orizzonti che non sono multipli di tre e tassi fuori campo", () => {
    expect(() => calcolaNelTempo(base({ orizzontiMesi: [5] }), "NESSUNA")).toThrow();
    expect(() => calcolaNelTempo(base({ tasso: { tipo: "IMPOSTO", trimestrale: 1 } }), "NESSUNA")).toThrow();
    expect(() => calcolaNelTempo(base({ estrazioni: 0 }), "NESSUNA")).toThrow();
  });
});
