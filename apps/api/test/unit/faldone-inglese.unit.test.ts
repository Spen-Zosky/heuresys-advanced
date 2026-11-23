/**
 * apps/api/test/unit/faldone-inglese.unit.test.ts — classe K01 del controllo forense del 23/11/2026.
 *
 * In una pagina inglese il Faldone mostrava in italiano i capitoli, i titoli delle sezioni e i motivi
 * dell'{omissis}: il servizio li scriveva solo in italiano. Questa prova fallisce se un titolo di
 * `classi.ts`, un capitolo, un ruolo di relazione o un motivo di `service.ts` resta senza la sua
 * forma inglese in `inglese.ts`, e controlla che senza lingua il servizio parli italiano come prima.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CAPITOLI, RUOLI_DI_RELAZIONE, TABELLE_CLASSIFICATE, classificazioneDi,
} from "../../src/modules/faldone/classi.js";
import {
  CAPITOLI_EN, MOTIVI_EN, RUOLI_EN, TITOLI_EN, idCapitolo, testiFaldone,
} from "../../src/modules/faldone/inglese.js";

const SERVIZIO = readFileSync(fileURLToPath(new URL("../../src/modules/faldone/service.ts", import.meta.url)), "utf8");

/** I motivi scritti nelle regole di visibilità: ogni stringa con uno spazio fra `regolaPer` ed `espressione`. */
function motiviDelServizio(): string[] {
  const inizio = SERVIZIO.indexOf("function regolaPer(");
  const fine = SERVIZIO.indexOf("function espressione(");
  expect(inizio, "regolaPer non trovata in service.ts").toBeGreaterThan(0);
  expect(fine).toBeGreaterThan(inizio);
  const tratto = SERVIZIO.slice(inizio, fine);
  return [...tratto.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).filter((x) => x.includes(" "));
}

describe("faldone in inglese: ogni testo del servizio ha la sua forma inglese", () => {
  it("ogni titolo di sezione di classi.ts è tradotto", () => {
    const titoli = [...new Set(TABELLE_CLASSIFICATE.map((t) => classificazioneDi(t)!.titolo))];
    expect(titoli.length).toBeGreaterThan(150);
    expect(titoli.filter((x) => !(x in TITOLI_EN))).toEqual([]);
  });

  it("nessuna traduzione di titolo avanza (un titolo tolto da classi.ts esce anche da qui)", () => {
    const titoli = new Set(TABELLE_CLASSIFICATE.map((t) => classificazioneDi(t)!.titolo));
    expect(Object.keys(TITOLI_EN).filter((x) => !titoli.has(x))).toEqual([]);
  });

  it("ogni capitolo e ogni ruolo di relazione sono tradotti", () => {
    expect(CAPITOLI.filter((c) => !CAPITOLI_EN[c])).toEqual([]);
    expect(RUOLI_DI_RELAZIONE.filter((r) => !(r in RUOLI_EN))).toEqual([]);
  });

  it("ogni motivo dell'{omissis} scritto in service.ts è tradotto", () => {
    const motivi = motiviDelServizio();
    expect(motivi.length).toBeGreaterThan(10);
    expect(motivi.filter((m) => !(m in MOTIVI_EN))).toEqual([]);
  });

  it("in inglese: capitolo, titolo, ruolo e motivo composto escono in inglese", () => {
    const en = testiFaldone("en");
    expect(en.capitolo("Anagrafica")).toBe("Personal details");
    expect(en.titolo("Dati anagrafici e demografici")).toBe("Personal and demographic data");
    expect(en.ruolo("come valutatore")).toBe("as reviewer");
    expect(en.motivo("sfera privata: non rientra nel tuo profilo; persone terze: chi altro compare nella riga lo legge solo il mandato HR"))
      .toBe("private sphere: not within your profile; third parties: only the HR mandate reads who else appears in the row");
    // Una tabella non classificata ha il nome tecnico per titolo: resta com'è.
    expect(en.titolo("sys.sys_nuova")).toBe("sys.sys_nuova");
  });

  it("senza lingua, o in italiano, i testi restano quelli di prima", () => {
    for (const tt of [testiFaldone(), testiFaldone("it")]) {
      expect(tt.capitolo("Anagrafica")).toBe("Anagrafica");
      expect(tt.titolo("Buste paga")).toBe("Buste paga");
      expect(tt.motivo("lo legge solo la persona stessa")).toBe("lo legge solo la persona stessa");
    }
  });

  it("l'identificativo del capitolo è quello che la pagina usava già (`?scheda=`), uguale in ogni lingua", () => {
    expect(idCapitolo("Rapporto di lavoro")).toBe("rapporto-di-lavoro");
    expect(idCapitolo("Archivi e registri tecnici")).toBe("archivi-e-registri-tecnici");
    expect(new Set(CAPITOLI.map(idCapitolo)).size).toBe(CAPITOLI.length);
  });
});
