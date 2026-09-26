/**
 * #251 F1 — le soglie sono un CRITERIO applicato a una MISURA, non due numeri.
 *
 * Le prove qui sono di due specie diverse, e la distinzione conta:
 *  · il CRITERIO si prova con le misure DATATE dell'ADR (38 posizioni nell'unità più grande,
 *    p90 delle catene 21,4 — RTL Bank al 2026-09-14, ri-misurate identiche il 2026-09-26):
 *    sono evidenza di un momento, non un'affermazione sul presente, ed è l'unico posto del
 *    repository dove 25 e 40 compaiono come attesa;
 *  · le soglie DI OGGI si provano contro il file generato, ri-derivando l'attesa dalle sue
 *    misure — mai ricopiando un numero, che domani sarebbe una prova che misura il passato.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  arrotondaPerEccesso,
  caricaSoglie,
  derivaSoglie,
  livelloDi,
  PERCORSO_MISURE,
} from "../src/soglie-persone.js";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("#251 F1 — il criterio di ADR-0040 §3", () => {
  it("sulle misure DATATE di RTL Bank produce esattamente i valori iniziali 25 / 40", () => {
    const s = derivaSoglie({
      tenantPiuGrande: "RTL_BANK",
      massimoPosizioniPerUnita: 38, // misura (1), 2026-09-14 e 2026-09-26
      p90PersonePerCatena: 21.4, // misura (3), idem
      misuratoIl: "2026-09-14",
    });
    expect(s.alta).toBe(40);
    expect(s.bassa).toBe(25);
  });

  it("l'unità più grande NON fa fermare l'agente, e la conferma scatta appena sopra", () => {
    const s = derivaSoglie({ tenantPiuGrande: "T", massimoPosizioniPerUnita: 38, p90PersonePerCatena: 21.4 });
    // «coprono qualunque unità»: leggere l'unità più grande resta sotto la soglia alta.
    expect(livelloDi(38, s)).toBe("dichiarato");
    expect(livelloDi(41, s)).toBe("confermato");
  });

  it("i tre livelli ai bordi, non solo in mezzo", () => {
    const s = derivaSoglie({ tenantPiuGrande: "T", massimoPosizioniPerUnita: 38, p90PersonePerCatena: 21.4 });
    expect(livelloDi(0, s)).toBe("silenzioso");
    expect(livelloDi(25, s)).toBe("silenzioso"); // «fino a 25»: 25 incluso
    expect(livelloDi(26, s)).toBe("dichiarato");
    expect(livelloDi(40, s)).toBe("dichiarato"); // «da 26 a 40»: 40 incluso
    expect(livelloDi(41, s)).toBe("confermato");
  });

  it("segue la misura: un tenant più grande alza le soglie, senza toccare il codice", () => {
    const grande = derivaSoglie({ tenantPiuGrande: "BIG", massimoPosizioniPerUnita: 340, p90PersonePerCatena: 180 });
    expect(grande.alta).toBe(340);
    expect(grande.bassa).toBe(180);
    // La prova che i numeri NON sono costanti: 25/40 qui sarebbero sbagliati, e lo si vede.
    expect(grande.bassa).toBeGreaterThan(40);
  });

  it("due misure incrociate non invertono le soglie (il livello intermedio non sparisce)", () => {
    // Catene larghe, unità minuscole: senza il vincolo, bassa=180 > alta=5.
    const s = derivaSoglie({ tenantPiuGrande: "X", massimoPosizioniPerUnita: 3, p90PersonePerCatena: 180 });
    expect(s.bassa).toBeLessThanOrEqual(s.alta);
  });

  it("l'arrotondamento non produce mai zero (una soglia zero fermerebbe tutto)", () => {
    expect(arrotondaPerEccesso(0)).toBe(5);
    expect(arrotondaPerEccesso(-3)).toBe(5);
    expect(arrotondaPerEccesso(Number.NaN)).toBe(5);
  });
});

describe("#251 F1 — le soglie di OGGI, ri-derivate dal file generato", () => {
  it("il file generato esiste e le soglie coincidono col criterio applicato alle SUE misure", () => {
    const p = join(RADICE, PERCORSO_MISURE);
    expect(existsSync(p), `manca ${PERCORSO_MISURE}: rigeneralo con build_soglie_agente.py`).toBe(true);
    const misure = JSON.parse(readFileSync(p, "utf8")) as {
      massimoPosizioniPerUnita: number;
      p90PersonePerCatena: number;
      tenantPiuGrande: string;
    };
    const attese = derivaSoglie(misure); // l'attesa si DERIVA dalla fonte, non si ricopia
    const lette = caricaSoglie();
    expect(lette).toBeDefined();
    expect(lette!.alta).toBe(attese.alta);
    expect(lette!.bassa).toBe(attese.bassa);
    expect(lette!.provenienza.tenant).toBe(misure.tenantPiuGrande);
  });

  it("file assente → undefined, e il livello è `non-misurato`: l'ignoto non è un verde", () => {
    expect(caricaSoglie("docs/kb/zqxwvu-non-esiste-251.json")).toBeUndefined();
    expect(livelloDi(1_000, undefined)).toBe("non-misurato");
    expect(livelloDi(0, undefined)).toBe("non-misurato");
  });

  it("file presente ma senza le misure → undefined, non un valore inventato", () => {
    // `package.json` esiste, è JSON valido e NON porta le due misure: il caso vero di un file
    // rinominato o rigenerato male. Deve uscire `undefined`, non una soglia dedotta a caso.
    expect(caricaSoglie("package.json")).toBeUndefined();
  });
});
