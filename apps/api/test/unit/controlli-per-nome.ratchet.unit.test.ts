/**
 * S-5 (mandato K, F2) — il CRICCHETTO sui controlli per nome.
 *
 * Un «controllo per nome» e' un `if (isPlatformAdmin(actor))`, un `actor.roles.includes("HRMS_MANAGER")`,
 * una stringa di codice ruolo dentro un servizio: decide un perimetro o una capacita' PER NOME invece che
 * per mandato (ADR-0027: gli insiemi di mandato vivono in `lib/scope/`, e li' soltanto). I-C li ha contati
 * il 2026-09-15: 327 in 102 file fuori da `lib/scope/` e `config/`. R-1 li sostituisce uno per uno.
 *
 * Il cricchetto: per ogni file, il conteggio di oggi deve essere UGUALE alla baseline. Se SALE, e' rosso
 * (qualcuno ha aggiunto un controllo per nome: si toglie, o si spiega in `lib/scope/`). Se SCENDE, e' rosso
 * lo stesso, con un messaggio diverso: si aggiorna la baseline NELLO STESSO COMMIT (e' cosi' che la
 * baseline non mente mai). Un file nuovo con almeno un controllo e' rosso. La baseline puo' solo scendere.
 *
 * Le tre regex sono le stesse di `.programmi/K-ruoli-direzione/tools/controlli_per_nome.py`, che ha scritto
 * la baseline: il test e' il guardiano, lo script e' la misura del mandato. Se una cambia, cambia anche l'altra.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(QUI, "..", "..", "src");
const BASELINE = join(QUI, "controlli-per-nome.baseline.json");

const RUOLI = [
  "PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER", "USER",
  "READ_ONLY", "CEO", "TEAM_LEADER", "TEAM_MEMBER", "ORG_DIRECTOR", "WHISTLEBLOWING_CUSTODIAN", "BRANCH_MANAGER",
];
const RE_PRED = /\b(isPlatformAdmin|isTenantAdmin|isHrmsManager|isPlatform)\(/g;
const RE_RUOLO = new RegExp(`['"](${RUOLI.join("|")})['"]`, "g");
const RE_INCL = /\.roles\.includes\(/g;

type Conteggio = { predicati: number; stringhe_ruolo: number; roles_includes: number; totale: number };

function fileTs(dir: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) out.push(...fileTs(p));
    else if (voce.endsWith(".ts")) out.push(p);
  }
  return out;
}

export function conta(testo: string): Conteggio {
  const predicati = (testo.match(RE_PRED) ?? []).length;
  const stringhe_ruolo = (testo.match(RE_RUOLO) ?? []).length;
  const roles_includes = (testo.match(RE_INCL) ?? []).length;
  return { predicati, stringhe_ruolo, roles_includes, totale: predicati + stringhe_ruolo + roles_includes };
}

/** {file relativo a src, con "/"} -> conteggio, per i soli file con almeno un controllo. */
export function misuraOggi(): Record<string, Conteggio> {
  const out: Record<string, Conteggio> = {};
  for (const p of fileTs(SRC)) {
    const rel = relative(SRC, p).split("\\").join("/");
    if (rel.startsWith("lib/scope/") || rel.startsWith("config/")) continue;
    const c = conta(readFileSync(p, "utf8"));
    if (c.totale) out[rel] = c;
  }
  return out;
}

describe("S-5 — cricchetto: i controlli per nome fuori da lib/scope/ possono solo scendere", () => {
  it("ogni file e' esattamente alla sua baseline (sopra = controllo nuovo; sotto = aggiorna la baseline nello stesso commit)", () => {
    const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, Conteggio>;
    const oggi = misuraOggi();
    const saliti: string[] = [];
    const scesi: string[] = [];
    for (const [f, c] of Object.entries(oggi)) {
      const b = base[f];
      if (!b) saliti.push(`${f}: nuovo file con ${c.totale} controlli per nome (baseline: assente)`);
      else if (c.totale > b.totale) saliti.push(`${f}: ${c.totale} > baseline ${b.totale}`);
      else if (c.totale < b.totale) scesi.push(`${f}: ${c.totale} < baseline ${b.totale}`);
    }
    for (const f of Object.keys(base)) if (!oggi[f]) scesi.push(`${f}: 0 < baseline ${base[f]!.totale} (file senza piu' controlli, o rimosso)`);
    expect(saliti, "CONTROLLI PER NOME IN PIU' rispetto alla baseline: si sostituiscono con i predicati di mandato (R-1), non si aggiungono").toEqual([]);
    expect(scesi, "sono SCESI (bene): aggiorna controlli-per-nome.baseline.json nello stesso commit, cosi' la baseline non mente").toEqual([]);
  });

  it("la prova puo' fallire: il contatore riconosce i tre tipi di controllo quando li vede", () => {
    const c = conta('if (isPlatformAdmin(a) || a.roles.includes("HRMS_MANAGER")) x = \'TENANT_ADMIN\';');
    expect(c).toEqual({ predicati: 1, stringhe_ruolo: 2, roles_includes: 1, totale: 4 });
    expect(conta("const y = mandato(actor); // nessun nome").totale).toBe(0);
  });
});
