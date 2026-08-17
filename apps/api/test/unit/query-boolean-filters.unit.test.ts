/**
 * apps/api/test/unit/query-boolean-filters.unit.test.ts
 * #209 — i filtri booleani di querystring devono saper dire di NO.
 *
 * Il difetto che questo file presidia. `z.coerce.boolean()` applica `Boolean(v)`,
 * e da una querystring `v` è sempre una STRINGA: ogni stringa non vuota è truthy,
 * quindi `?flag=false` valeva `true` e il filtro rispondeva «tutti» a qualunque
 * domanda. Un filtro che non sa dire di no non è un filtro: è un'assenza di filtro
 * che si presenta come una scelta. Trovato dalla prova live di `#196`, che chiedeva
 * quanti indicatori sono dell'azienda e si sentiva rispondere 199 su 199 mentre il
 * database ne dava 0.
 *
 * Perché il caso è QUI e non venti volte nei test di modulo. Il register chiede
 * «per ciascuna, tre domande e tre risposte diverse». A livello di endpoint quel
 * caso costa venti fixture e per metà sarebbe **cieco**: molte tabelle non hanno
 * righe di entrambi i valori, e un confronto fra due insiemi identici passa senza
 * misurare nulla. Il posto dove la proprietà è sempre osservabile è il **contratto**
 * — è lì che il difetto viveva, ed è lì che la si prova su tutti e venti.
 *
 * L'elenco degli schemi NON è ricopiato: si scopre leggendo la cartella. Uno schema
 * nuovo che ricadesse nel difetto entra da sé in questo test, invece di aspettare
 * che qualcuno si ricordi di aggiungerlo.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { queryBoolean } from "@heuresys/shared";

const SCHEMI = join(process.cwd(), "..", "..", "packages", "shared", "src", "schemas");

/** I file di schema, letti dal disco: nessun elenco scritto a mano. */
function fileDiSchema(): string[] {
  return readdirSync(SCHEMI).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
}

/** I campi che dichiarano un booleano da querystring, con il file che li ospita. */
function filtriDichiarati(): Array<{ file: string; campo: string }> {
  const out: Array<{ file: string; campo: string }> = [];
  for (const f of fileDiSchema()) {
    const testo = readFileSync(join(SCHEMI, f), "utf8");
    for (const m of testo.matchAll(/^\s*(\w+):\s*queryBoolean\(\)/gm)) {
      out.push({ file: f, campo: m[1]! });
    }
  }
  return out;
}

describe("#209 — i filtri booleani di querystring", () => {
  it("nessuno schema usa più `z.coerce.boolean()` (era il difetto)", () => {
    const colpevoli: string[] = [];
    for (const f of fileDiSchema()) {
      readFileSync(join(SCHEMI, f), "utf8")
        .split("\n")
        .forEach((riga, i) => {
          const codice = !/^\s*(\*|\/\/|\/\*)/.test(riga);
          if (codice && riga.includes("z.coerce.boolean()")) colpevoli.push(`${f}:${i + 1}`);
        });
    }
    expect(`schemi ancora col difetto: ${colpevoli.join(", ") || "nessuno"}`).toBe(
      "schemi ancora col difetto: nessuno",
    );
  });

  it("l'universo non è vuoto — o il caso qui sotto non proverebbe niente", () => {
    // Zero filtri dichiarati renderebbe verde per vacuità il caso a tre risposte:
    // «tutti i filtri si comportano bene» è banalmente vero se non ce n'è nessuno.
    const filtri = filtriDichiarati();
    expect(filtri.length).toBeGreaterThanOrEqual(20);
  });

  it("OGNI filtro dichiarato dà TRE risposte diverse alle tre domande", () => {
    // È il criterio del register, applicato dove è sempre osservabile: assente →
    // `undefined` (nessun filtro), `"true"` → true, `"false"` → false. Prima della
    // correzione la terza rispondeva `true`, cioè come la seconda: due domande
    // diverse, una risposta sola.
    const schema = queryBoolean().optional();
    const guasti: string[] = [];

    for (const { file, campo } of filtriDichiarati()) {
      const assente = schema.parse(undefined);
      const vero = schema.parse("true");
      const falso = schema.parse("false");
      if (assente !== undefined || vero !== true || falso !== false) {
        guasti.push(`${file}·${campo}: assente=${assente} true=${vero} false=${falso}`);
      }
    }
    expect(`filtri che non distinguono le tre domande: ${guasti.join(" | ") || "nessuno"}`).toBe(
      "filtri che non distinguono le tre domande: nessuno",
    );
  });

  it("le forme che una querystring produce davvero, e nessuna in più", () => {
    const s = queryBoolean();
    for (const v of ["true", "TRUE", " true ", "1", "yes", "on"]) {
      expect(`${JSON.stringify(v)} → ${s.parse(v)}`).toBe(`${JSON.stringify(v)} → true`);
    }
    for (const v of ["false", "FALSE", " false ", "0", "no", "off"]) {
      expect(`${JSON.stringify(v)} → ${s.parse(v)}`).toBe(`${JSON.stringify(v)} → false`);
    }
  });

  it("una stringa che non è un booleano viene RIFIUTATA, non addomesticata", () => {
    // È la differenza che conta rispetto a `z.coerce`: quello rispondeva `true` a
    // qualunque cosa, anche a `?isActive=forse`. Meglio un 400 esplicito di un
    // filtro che fa in silenzio il contrario di ciò che gli è stato chiesto.
    for (const v of ["forse", "2", "vero", "null"]) {
      expect(() => queryBoolean().parse(v), `«${v}» doveva essere rifiutato`).toThrow();
    }
  });

  it("un booleano vero (da un corpo JSON) attraversa intatto", () => {
    // Gli stessi schemi servono anche i body, dove `false` arriva già booleano: la
    // conversione non deve toccarlo, o si romperebbe il caso opposto.
    expect(queryBoolean().parse(true)).toBe(true);
    expect(queryBoolean().parse(false)).toBe(false);
  });
});
