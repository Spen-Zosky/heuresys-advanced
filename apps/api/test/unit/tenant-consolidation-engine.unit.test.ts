/**
 * apps/api/test/unit/tenant-consolidation-engine.unit.test.ts — AC-7.
 *
 * Il motore dei giri con un giudice finto, che risponde con una tabella fissa di equivalenze:
 * convergenza, arresto a zero adozioni, fusibile, lacune e personalizzazioni, rifacimento dopo
 * un rifiuto. Nessun database, nessun modello.
 */
import { describe, it, expect } from "vitest";
import {
  consolidaGruppo,
  giroZero,
  nuovoStato,
  rifiuta,
  somiglianza,
  type Giudice,
  type Voce,
} from "../../src/modules/tenant-consolidation/engine.js";

/** Un giudice che conosce solo le equivalenze che gli si danno, e risponde se la coppia è fra i candidati. */
function giudiceDa(equivalenze: Record<string, string[]>, fiducia = 95): { g: Giudice; chiamate: number[] } {
  const chiamate: number[] = [];
  const g: Giudice = async (lotto) => {
    chiamate.push(lotto.round);
    return lotto.questions.map((d) => {
      const attese = equivalenze[d.tenantItem.key] ?? [];
      const presenti = attese.filter((k) => d.candidates.some((c) => c.key === k));
      return { tenantKey: d.tenantItem.key, prototypeKeys: presenti, confidence: presenti.length ? fiducia : 80, reason: "prova" };
    });
  };
  return { g, chiamate };
}

const prototipo: Voce[] = [
  { key: "P-ASS", name: "Gestione delle assunzioni" },
  { key: "P-PAG", name: "Elaborazione delle paghe" },
  { key: "P-FOR", name: "Formazione del personale" },
];
const tenant: Voce[] = [
  { key: "t-rec", name: "Recruiting" },
  { key: "t-pay", name: "Payroll" },
  { key: "t-cc", name: "Customer care" },
];

describe("somiglianza", () => {
  it("è 1 per testi uguali e 0 per testi senza trigrammi in comune", () => {
    expect(somiglianza("Paghe", "paghe")).toBe(1);
    expect(somiglianza("abc", "xyz")).toBe(0);
  });
});

describe("giro zero", () => {
  it("abbina per indirizzo ESCO solo dove la chiave è unica da entrambe le parti", () => {
    const s = nuovoStato(
      "SKILLS",
      [{ key: "S1", name: "Analisi dei dati", escoUri: "esco:a" }, { key: "S2", name: "Doppia", escoUri: "esco:d" }, { key: "S3", name: "Doppia bis", escoUri: "esco:d" }],
      [{ key: "t1", name: "Data analysis", escoUri: "esco:a" }, { key: "t2", name: "X", escoUri: "esco:d" }],
    );
    expect(giroZero(s)).toBe(1);
    expect(s.proposals[0]).toMatchObject({ method: "CHIAVE", prototypeKeys: ["S1"], tenantKeys: ["t1"], adoptedInWorkingCopy: true });
    // R-13: il prototipo prende il nome del tenant, e conserva l'originale.
    expect(s.prototype[0]).toMatchObject({ name: "Data analysis", originalName: "Analisi dei dati", translatedInRound: 0 });
  });

  it("usa il vocabolario comune solo se approvato", () => {
    const p = [{ key: "U1", name: "Direzione Crediti", type: "DIREZIONE", level: "1" }];
    const t = [{ key: "u1", name: "Credit Department", type: "DEPARTMENT", level: "1" }];
    expect(giroZero(nuovoStato("ORGANIZATION", p, t))).toBe(0);
    expect(giroZero(nuovoStato("ORGANIZATION", p, t), { vocabulary: new Map([["DEPARTMENT", "DIREZIONE"]]) })).toBe(1);
  });
});

describe("giri semantici", () => {
  it("adotta le equivalenze sicure, si ferma al giro che non adotta niente, chiude con lacune e personalizzazioni", async () => {
    const { g, chiamate } = giudiceDa({ "t-rec": ["P-ASS"], "t-pay": ["P-PAG"] });
    const s = await consolidaGruppo(nuovoStato("PROCESSES", prototipo, tenant), g);
    expect(chiamate).toEqual([1, 2]); // il giro 2 non adotta niente: si ferma lì
    expect(s.fuseTripped).toBe(false);
    const per = (o: string) => s.proposals.filter((p) => p.outcome === o);
    expect(per("CORRISPONDENZA").map((p) => p.tenantKeys[0]).sort()).toEqual(["t-pay", "t-rec"]);
    expect(per("LACUNA").map((p) => p.prototypeKeys[0])).toEqual(["P-FOR"]);
    expect(per("PERSONALIZZAZIONE").map((p) => p.tenantKeys[0])).toEqual(["t-cc"]);
    expect(s.prototype.find((v) => v.key === "P-ASS")).toMatchObject({ name: "Recruiting", originalName: "Gestione delle assunzioni" });
  });

  it("una proposta sotto la soglia sicura resta da confermare e non si traduce", async () => {
    const { g } = giudiceDa({ "t-rec": ["P-ASS"] }, 70);
    const s = await consolidaGruppo(nuovoStato("PROCESSES", prototipo, tenant), g);
    const p = s.proposals.find((x) => x.tenantKeys[0] === "t-rec" && x.outcome === "CORRISPONDENZA");
    expect(p).toMatchObject({ adoptedInWorkingCopy: false, confidence: 70 });
    expect(s.prototype.find((v) => v.key === "P-ASS")!.name).toBe("Gestione delle assunzioni");
  });

  it("il fusibile ferma un giudice che continua ad adottare oltre il tetto, e lo dichiara", async () => {
    const molti = Array.from({ length: 6 }, (_, i) => ({ key: `P${i}`, name: `Voce ${i}` }));
    const tmolti = Array.from({ length: 6 }, (_, i) => ({ key: `t${i}`, name: `Item ${i}` }));
    // ogni giro il giudice ne riconosce una sola: servirebbero 6 giri, il fusibile è a 3
    let n = 0;
    const g: Giudice = async (l) => {
      n++;
      const d = l.questions[0]!;
      return [{ tenantKey: d.tenantItem.key, prototypeKeys: [d.candidates[0]!.key], confidence: 99, reason: "prova" }];
    };
    const s = await consolidaGruppo(nuovoStato("SKILLS", molti, tmolti), g, { maxRounds: 3 });
    expect(n).toBe(3);
    expect(s.fuseTripped).toBe(true);
  });

  it("ignora chiavi che il giudice non poteva usare", async () => {
    const g: Giudice = async (l) => l.questions.map((d) => ({ tenantKey: d.tenantItem.key, prototypeKeys: ["P-INVENTATA"], confidence: 99, reason: "prova" }));
    const s = await consolidaGruppo(nuovoStato("PROCESSES", prototipo, tenant), g);
    expect(s.proposals.filter((p) => p.outcome === "CORRISPONDENZA")).toHaveLength(0);
  });
});

describe("rifiuto", () => {
  it("toglie la traduzione, non ripropone la coppia rifiutata e rifà i giri", async () => {
    const { g } = giudiceDa({ "t-rec": ["P-ASS"], "t-pay": ["P-PAG"] });
    const s = await consolidaGruppo(nuovoStato("PROCESSES", prototipo, tenant), g);
    const rec = s.proposals.find((p) => p.tenantKeys[0] === "t-rec" && p.outcome === "CORRISPONDENZA")!;
    rifiuta(s, rec.id);
    expect(s.prototype.find((v) => v.key === "P-ASS")!.name).toBe("Gestione delle assunzioni");
    await consolidaGruppo(s, g);
    const corr = s.proposals.filter((p) => p.outcome === "CORRISPONDENZA").map((p) => p.tenantKeys[0]);
    expect(corr).toEqual(["t-pay"]);
    expect(s.proposals.filter((p) => p.outcome === "LACUNA").map((p) => p.prototypeKeys[0]).sort()).toEqual(["P-ASS", "P-FOR"]);
    expect(s.proposals.filter((p) => p.outcome === "PERSONALIZZAZIONE").map((p) => p.tenantKeys[0]).sort()).toEqual(["t-cc", "t-rec"]);
  });
});
