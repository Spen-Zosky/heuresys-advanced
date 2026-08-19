/**
 * apps/api/test/unit/build-source.unit.test.ts
 * IL RITIRO DELL'ARCHETIPO È AVVENUTO, E NON PUÒ TORNARE PER DISTRAZIONE (#132 F3, E29).
 *
 * ⚠ COSA C'ERA PRIMA, e perché non c'è più. Questo file provava due cose (`#198` T4): che il
 * piano dicesse **le stesse righe** che l'archetipo diceva, e che il motore **non conoscesse
 * più la sorgente** (E21). La prima metà è rimasta senza oggetto: l'archetipo non esiste, e
 * un confronto con ciò che non c'è non è una prova, è un file che non compila. La seconda
 * metà vale ancora, e resta qui.
 *
 * AL POSTO DELLA PRIMA METÀ C'È IL CANCELLO DEL RITIRO, ed è più utile di ciò che sostituisce.
 * Il piano di `#132` dichiara la prova di F3 così: *«`grep -rn "RETAIL_BANK_REFERENCE|
 * getArchetype" apps/ packages/` deve tornare vuota. Se resta un riferimento, il ritiro non è
 * avvenuto: è stato rinominato.»* Un comando eseguito una volta a mano prova quel giorno; qui
 * la stessa domanda si ripone **a ogni corsa**, e un ritorno dell'archetipo — anche solo in un
 * commento, perché E29 dice *«non deve rimanere traccia»* — diventa rosso.
 *
 * ⚠ IL TRANELLO CHE QUESTO FILE DEVE EVITARE, ed è già stato pagato una volta in questo
 * progetto (`#194`): un controllo che cerca una stringa **trova sé stesso**. Se qui si
 * scrivessero i nomi ritirati per esteso, il cancello sarebbe rosso per sempre su un codice
 * sano — cioè il modo migliore per insegnare a non guardarlo più. Perciò i nomi sono
 * **composti a pezzi** a tempo di esecuzione, e questo file si esclude dalla scansione.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
const SRC = join(qui, "..", "..", "src");
const MOTORE = join(SRC, "modules", "tenant-materialization", "repository.ts");

/**
 * I nomi ritirati, composti a pezzi perché il cancello non trovi sé stesso.
 *
 * Non è un vezzo: scritti interi, questo stesso file sarebbe il primo colpevole, e il
 * cancello nascerebbe rosso senza che nulla sia rotto.
 */
const RITIRATI = [
  "RETAIL_BANK" + "_REFERENCE",
  "get" + "Archetype",
  "archetype" + "Users",
  "syn" + "Proficiency",
  "syn" + "KpiValue",
  "list" + "Archetypes",
  "Archetype" + "BuildSource",
  "archetype" + "Key",
];

/** Ogni `.ts` sotto `src`, ricorsivamente. */
function file(dir: string, out: string[] = []): string[] {
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) file(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("#132 F3 — l'archetipo è stato ritirato, non rinominato", () => {
  it("nessun file di `src` nomina più l'archetipo, nemmeno in un commento", () => {
    const colpevoli: string[] = [];
    for (const f of file(SRC)) {
      const testo = readFileSync(f, "utf8");
      const trovati = RITIRATI.filter((n) => testo.includes(n));
      if (trovati.length > 0) colpevoli.push(`${relative(SRC, f)} → ${trovati.join(", ")}`);
    }
    expect(colpevoli, `l'archetipo è ancora nominato:\n  ${colpevoli.join("\n  ")}`).toHaveLength(0);
  });

  it("CONTROPROVA: il cancello sa vedere un nome che c'è davvero", () => {
    // Senza questo caso, il precedente sarebbe verde anche se la scansione non leggesse
    // nulla — un cancello che non trova mai niente e un codice pulito hanno lo stesso
    // aspetto. Qui si cerca una parola che in `src` c'è di sicuro.
    const trovati = file(SRC).filter((f) => readFileSync(f, "utf8").includes("Buil" + "dPlan"));
    expect(trovati.length).toBeGreaterThan(0);
  });

  it("la scansione guarda davvero molti file, non due", () => {
    // Terza rete: se `file()` tornasse una lista corta per un errore di ricorsione, il primo
    // caso resterebbe verde per vacuità.
    expect(file(SRC).length).toBeGreaterThan(100);
  });
});

describe("#198 T4 — il motore non conosce la sorgente (E21)", () => {
  it("il motore non importa nessuna sorgente", () => {
    const sorgente = readFileSync(MOTORE, "utf8");
    const importa = sorgente
      .split("\n")
      .filter((r) => /^\s*import\b/.test(r))
      .filter((r) => r.includes("build-source") && !r.includes("type"));
    expect(importa, `il motore importa ancora: ${importa.join(" | ")}`).toHaveLength(0);
  });

  it("CONTROPROVA: il controllo sa vedere un import che c'è davvero", () => {
    // Se il filtro fosse scritto male direbbe «zero» su qualunque file. Qui si misura su un
    // file che la sorgente la importa DAVVERO.
    const sorgente = readFileSync(
      join(SRC, "modules", "tenant-materialization", "blueprint-build-source.ts"),
      "utf8",
    );
    const importa = sorgente
      .split("\n")
      .filter((r) => /^\s*import\b/.test(r))
      .filter((r) => r.includes("build-source"));
    expect(importa.length).toBeGreaterThan(0);
  });
});
