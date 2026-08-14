/**
 * apps/api/test/unit/role-lists-drift.unit.test.ts — #99 F3.
 *
 * ADR-0036: **nessuna lista di ruoli locale decide una vista.** I mandati stanno in
 * `lib/scope/resolver.ts` e i moduli li COMPONGONO; chi se li riscrive in casa crea una
 * seconda verità che diverge in silenzio — è già successo con `positions` e `teams`, che
 * elencavano a mano gli stessi ruoli senza sapere l'uno dell'altro.
 *
 * Questo cancello legge il sorgente e fallisce quando compare una lista nuova. Non è un
 * divieto assoluto: è un divieto con eccezioni DICHIARATE, ognuna con la sua ragione. Se
 * la tua lista non è una decisione di accesso, aggiungila all'elenco qui sotto e scrivi
 * perché — il costo è una riga, ed è esattamente il punto in cui qualcuno si ferma a
 * chiedersi se non stia per costruire la quinta.
 *
 * Livello unit: legge file, non tocca il database.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..", "..", "src");

/**
 * Le eccezioni, una per una, con la ragione. Chi ne aggiunge una si assume la spiegazione.
 */
const AMMESSE: ReadonlyArray<{ file: string; perche: string }> = [
  {
    file: join("lib", "scope", "resolver.ts"),
    perche: "è la fonte: qui i mandati si DICHIARANO, altrove si compongono",
  },
  {
    file: join("modules", "dashboard", "service.ts"),
    perche:
      "decide un'ETICHETTA («il ruolo più alto» da mostrare), non un accesso: " +
      "ordinare i ruoli per rilevanza visiva non apre e non chiude nulla",
  },
  {
    file: join("modules", "semantic-matching", "service.ts"),
    perche:
      "insieme NON derivabile dai mandati: `USER`/`TEAM_MEMBER`/`READ_ONLY` è un " +
      "complemento, e ricomporlo come «chi non ha mandato» sposterebbe " +
      "`WHISTLEBLOWING_CUSTODIAN` e `BLUEPRINT_MANAGER` a self-only — un cambio di " +
      "comportamento travestito da pulizia. Va ridiscusso, non riscritto di soppiatto",
  },
];

/** Una dichiarazione di lista di ruoli: `RoleCode[]` o `ReadonlySet<RoleCode>` con letterali. */
const DICHIARAZIONE = /(?:ReadonlySet<RoleCode>|:\s*RoleCode\[\])\s*=\s*(?:new\s+Set<RoleCode>\s*\(\s*)?\[([^\]]*)\]/g;

function file_ts(dir: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) out.push(...file_ts(p));
    else if (voce.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("#99 F3 — nessuna lista di ruoli locale decide una vista", () => {
  it("ogni lista di ruoli nel sorgente è la fonte canonica o un'eccezione dichiarata", () => {
    const ammesse = new Set(AMMESSE.map((a) => a.file));
    const trovate: string[] = [];

    for (const percorso of file_ts(SRC)) {
      const relativo = percorso.slice(SRC.length + 1);
      if (ammesse.has(relativo)) continue;
      const testo = readFileSync(percorso, "utf8");
      for (const m of testo.matchAll(DICHIARAZIONE)) {
        // solo le liste di LETTERALI: `[...ALTRA_COSTANTE]` è una composizione, ed è ciò
        // che vogliamo che i moduli facciano
        if (/"[A-Z_]+"/.test(m[1] ?? "")) trovate.push(`${relativo} → [${(m[1] ?? "").trim()}]`);
      }
    }

    expect(trovate).toEqual([]);
  });

  it("la prova può fallire: il rilevatore riconosce una lista quando la vede", () => {
    // Se il regex smettesse di riconoscere le dichiarazioni, il test sopra sarebbe verde
    // per cecità. Qui gli si mostra una lista e si pretende che la veda.
    const finto = 'const FINTA: ReadonlySet<RoleCode> = new Set<RoleCode>(["MANAGER", "CEO"]);';
    expect([...finto.matchAll(DICHIARAZIONE)].length).toBe(1);

    const composizione = 'const OK: ReadonlySet<RoleCode> = new Set<RoleCode>([...HR_MANDATED_ROLES]);';
    const hit = [...composizione.matchAll(DICHIARAZIONE)];
    expect(hit.length).toBe(1);
    expect(/"[A-Z_]+"/.test(hit[0]![1] ?? "")).toBe(false); // riconosciuta, ma non segnalata
  });

  it("le eccezioni sono motivate una per una", () => {
    for (const a of AMMESSE) expect(a.perche.length).toBeGreaterThan(30);
  });
});
