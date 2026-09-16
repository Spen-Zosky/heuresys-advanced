/**
 * apps/api/test/unit/role-codes-drift.unit.test.ts — mandato K, F4.0.
 *
 * Perche' esiste. `role-lists-drift.unit.test.ts` (#99 F3) guarda un'altra cosa: nessuna
 * lista di ruoli locale nei MODULI dell'API che ricomponga i mandati. Non guarda affatto
 * `packages/shared/src/schemas/role-codes.ts` (`ROLE_CODES`, la fonte unica) contro i due
 * posti del web che lo COPIANO a mano: `role-precedence.ts` e `roles-editor.tsx`. I-F
 * (2026-09-15) ha provato aggiungendo un ruolo finto SOLO a `role-codes.ts`: il test di
 * deriva esistente restava 3/3 verde, prima e dopo. Questo file e' la riparazione.
 *
 * `ROLE_CODES` si importa dal pacchetto condiviso: e' gia' tipata e non serve estrarla dal
 * sorgente. `role-precedence.ts` e `roles-editor.tsx` NON sono in `@heuresys/shared` — sono
 * codice `apps/web`, e importarli da qui accoppierebbe un test unit dell'API a Next.js. Si
 * leggono come TESTO e si estrae l'array con una regex, esattamente come fa gia'
 * `role-lists-drift.unit.test.ts` per le liste dei moduli.
 *
 * Due confronti diversi, non uno solo, perche' i due file hanno un progetto diverso:
 *
 * - `roles-editor.tsx` e' l'elenco che un TENANT_ADMIN vede nel menu a tendina per
 *   assegnare un ruolo: un codice mancante li' non e' un dettaglio estetico, e' un ruolo
 *   che nessuno puo' concedere dall'interfaccia. Percio' il confronto e' un'UGUAGLIANZA
 *   STRETTA nei due sensi: ogni codice di `ROLE_CODES` deve comparire li', e viceversa.
 * - `role-precedence.ts` dichiara esplicitamente, nel proprio commento, che un ruolo
 *   NON elencato non e' un errore («finisce in coda in ordine alfabetico, cosi' un ruolo
 *   nuovo si vede comunque invece di sparire»): l'assenza e' un comportamento voluto, non
 *   una deriva. Pretendere la copertura piena contraddirebbe il file che si sta provando.
 *   Cio' che RESTA un errore e' l'altro verso: un codice in `ROLE_PRECEDENCE` che non
 *   esiste (piu') in `ROLE_CODES` — un typo, o un ruolo ritirato mai tolto dalla lista di
 *   precedenza (V5: ritirare non e' cancellare da `role-codes.ts`, ma la precedenza di un
 *   codice sparito e' comunque un residuo da guardare). Il confronto e' un SOTTOINSIEME.
 *
 * Livello unit: legge file, non tocca il database. Il confronto con `sys.sys_auth_roles`
 * (il ruolo esiste davvero, non solo nel codice) e' `role-codes-db-drift.integration.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLE_CODES } from "@heuresys/shared";

// apps/api/test/unit -> ../../../.. = radice del repo
const REPO = join(import.meta.dirname, "..", "..", "..", "..");
const ROLE_PRECEDENCE_FILE = join(REPO, "apps", "web", "src", "lib", "role-precedence.ts");
const ROLES_EDITOR_FILE = join(
  REPO,
  "apps",
  "web",
  "src",
  "app",
  "(authenticated)",
  "users",
  "[userId]",
  "_components",
  "roles-editor.tsx",
);

/**
 * Estrae i codici letterali (`"XXX"`) del PRIMO array dichiarato con `nomeCostante = [ ... ]`
 * (o `... = [ ... ] as const`) nel testo. Ritorna `null` se la dichiarazione non c'e' piu':
 * un file riscritto in un modo che il rilevatore non riconosce non deve dare un falso
 * verde silenzioso.
 */
function estraiArray(testo: string, nomeCostante: string): string[] | null {
  const marcatore = testo.indexOf(nomeCostante);
  if (marcatore === -1) return null;
  // Il "[" cercato e' quello dell'ARRAY LETTERALE dopo l'"=", non quello di un'eventuale
  // annotazione di tipo `RoleCode[]` / `string[]` dentro `nomeCostante`: se si cercasse il
  // primo "[" dopo il marcatore si troverebbe quello vuoto del tipo, e il corpo estratto
  // sarebbe "" — un falso verde silenzioso (provato: era il bug di prima versione).
  const uguale = testo.indexOf("=", marcatore + nomeCostante.length);
  if (uguale === -1) return null;
  const aperta = testo.indexOf("[", uguale);
  const chiusa = testo.indexOf("]", aperta);
  if (aperta === -1 || chiusa === -1) return null;
  const corpo = testo.slice(aperta + 1, chiusa);
  return [...corpo.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!);
}

describe("mandato K F4.0 — role-codes.ts non diverge da role-precedence.ts e roles-editor.tsx", () => {
  it("roles-editor.tsx elenca ESATTAMENTE gli stessi codici di ROLE_CODES", () => {
    const testo = readFileSync(ROLES_EDITOR_FILE, "utf8");
    const locali = estraiArray(testo, "const ROLE_CODES: readonly RoleCode[]");
    expect(locali, "dichiarazione ROLE_CODES non trovata in roles-editor.tsx: file riscritto?").not.toBeNull();

    const attesi = new Set(ROLE_CODES);
    const trovati = new Set(locali!);
    const mancantiNelWeb = [...attesi].filter((c) => !trovati.has(c));
    const spuriNelWeb = [...trovati].filter((c) => !attesi.has(c as (typeof ROLE_CODES)[number]));

    expect(
      mancantiNelWeb,
      "ruoli in ROLE_CODES assenti dal menu a tendina di roles-editor.tsx: nessuno puo' assegnarli dall'interfaccia",
    ).toEqual([]);
    expect(spuriNelWeb, "codici in roles-editor.tsx che non esistono (piu') in ROLE_CODES").toEqual([]);
  });

  it("role-precedence.ts non contiene codici estranei a ROLE_CODES (i mancanti sono ammessi per progetto)", () => {
    const testo = readFileSync(ROLE_PRECEDENCE_FILE, "utf8");
    const precedenza = estraiArray(testo, "export const ROLE_PRECEDENCE: readonly string[]");
    expect(precedenza, "dichiarazione ROLE_PRECEDENCE non trovata: file riscritto?").not.toBeNull();

    const attesi = new Set(ROLE_CODES);
    const spuri = precedenza!.filter((c) => !attesi.has(c as (typeof ROLE_CODES)[number]));

    expect(spuri, "codici in ROLE_PRECEDENCE che non esistono (piu') in ROLE_CODES: typo o residuo di ritiro").toEqual(
      [],
    );
  });

  it("la prova puo' fallire: il rilevatore trova un codice finto aggiunto a meta'", () => {
    // Simula esattamente il sabotaggio di I-F passo 19: un ruolo compare in ROLE_CODES
    // (qui simulato con un elenco finto) ma non nel testo del file web.
    const roleCodesFinti = ["PLATFORM_ADMIN", "USER", "RUOLO_FINTO_A_META"];
    const testoWebFinto = 'const ROLE_CODES: readonly RoleCode[] = [\n  "PLATFORM_ADMIN",\n  "USER",\n];';
    const trovatiNelWeb = new Set(estraiArray(testoWebFinto, "const ROLE_CODES: readonly RoleCode[]"));
    const mancanti = roleCodesFinti.filter((c) => !trovatiNelWeb.has(c));
    expect(mancanti).toEqual(["RUOLO_FINTO_A_META"]);

    // E il verso opposto: un codice nel file web che role-codes.ts non ha (piu').
    const testoWebConSpurio =
      'const ROLE_CODES: readonly RoleCode[] = [\n  "PLATFORM_ADMIN",\n  "RUOLO_RITIRATO_MAI_TOLTO",\n];';
    const trovatiConSpurio = new Set(estraiArray(testoWebConSpurio, "const ROLE_CODES: readonly RoleCode[]"));
    const spuri = [...trovatiConSpurio].filter((c) => !new Set(["PLATFORM_ADMIN"]).has(c));
    expect(spuri).toEqual(["RUOLO_RITIRATO_MAI_TOLTO"]);
  });
});
