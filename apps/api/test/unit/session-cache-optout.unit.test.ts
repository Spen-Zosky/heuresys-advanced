/**
 * apps/api/test/unit/session-cache-optout.unit.test.ts — Z-251 F2, il cancello della guardia n.3.
 *
 * La cache di sessioni (`helpers/session-cache.ts`) è sicura finché i file che esercitano
 * il FLUSSO di autenticazione ne stanno fuori. Oggi sono sei e lo dichiarano. Ma una
 * dichiarazione che dipende dal ricordarsene è una dichiarazione che prima o poi manca:
 * un file nuovo sulla rotazione del refresh, scritto fra sei mesi, riuserebbe in silenzio
 * una sessione altrui e proverebbe qualcosa di diverso da ciò che dice di provare — verde,
 * per giunta.
 *
 * Questo cancello lo rende impossibile: chi tocca il refresh (endpoint, cookie o rotazione)
 * DEVE dichiarare `senzaCacheDiSessione()`, o questo test è rosso e nomina il file.
 *
 * Non gira contro il database: legge i sorgenti dei test. Sta fra gli unit apposta —
 * deve poter fallire anche su una macchina senza tunnel.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CARTELLA_TEST = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * DUE criteri, e nessuno dei due è stato scritto a tavolino: una corsa integrale della suite
 * ha prodotto sei file rossi, e la misura ha mostrato che appartenevano a due famiglie.
 *
 *  (a) **Chi ragiona sulla sessione stessa** — refresh, rotazione, elenco e revoca delle
 *      famiglie. `me-sessions` asseriva «la famiglia corrente sopravvive alla revoca delle
 *      altre», e con una sessione presa da un altro file la «corrente» non era quella che
 *      il test aveva appena creato.
 *
 *  (b) **Chi MUTA i ruoli dell'attore** (`sys_user_auth_roles`) e poi fa login aspettandosi
 *      il nuovo assetto. L'access token è un JWT: porta i ruoli **al momento dell'emissione**,
 *      quindi una sessione precedente alla mutazione risponde con l'assetto vecchio. È il
 *      caso di `capability-composition-scope`, che concede e revoca ruoli per costruire i
 *      propri scenari.
 *
 * Sono 14 file su 255 (5,5%), misurati: il risparmio della cache resta quasi intatto.
 */
const SEGNI_DI_FLUSSO_AUTH = [
  // (a) la sessione come oggetto del test
  /\/v1\/auth\/refresh/,
  /COOKIES\.REFRESH/,
  /hrx_refresh/,
  /REFRESH_COOKIE_PATH/,
  /me\/security\/sessions/,
  /auth\/sessions/,
  // (b) la mutazione dei ruoli, che il token fotografa all'emissione
  /(INSERT INTO|DELETE FROM|UPDATE)\s+sys\.sys_user_auth_roles/,
];

const DICHIARAZIONE = /senzaCacheDiSessione\s*\(\s*\)/;

function fileDiTest(): string[] {
  return readdirSync(CARTELLA_TEST)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => join(CARTELLA_TEST, f));
}

describe("Z-251 F2 — chi esercita l'autenticazione sta fuori dalla cache di sessioni", () => {
  it("ogni file che tocca il refresh dichiara senzaCacheDiSessione()", () => {
    const inadempienti: string[] = [];
    for (const percorso of fileDiTest()) {
      const testo = readFileSync(percorso, "utf8");
      const toccaIlRefresh = SEGNI_DI_FLUSSO_AUTH.some((r) => r.test(testo));
      if (toccaIlRefresh && !DICHIARAZIONE.test(testo)) {
        inadempienti.push(percorso.split(/[\\/]/).pop() ?? percorso);
      }
    }
    expect(
      inadempienti,
      `Questi file esercitano il flusso di autenticazione ma non dichiarano ` +
        `senzaCacheDiSessione(): userebbero una sessione condivisa da un altro file e ` +
        `proverebbero qualcosa di diverso da ciò che dicono. Aggiungi la chiamata in testa ` +
        `al file (import da "./helpers/session-cache.js").\n  ${inadempienti.join("\n  ")}`,
    ).toEqual([]);
  });

  it("il cancello guarda davvero qualcosa — i 14 noti sono riconosciuti", () => {
    // Se i criteri smettessero di riconoscere i file interessati, il caso sopra sarebbe
    // verde per cecità invece che per conformità. Questo lo impedisce: il censimento deve
    // trovarne almeno 14 (misurati il 2026-08-19), e tutti devono avere la dichiarazione.
    const conFlusso = fileDiTest().filter((p) =>
      SEGNI_DI_FLUSSO_AUTH.some((r) => r.test(readFileSync(p, "utf8"))),
    );
    expect(conFlusso.length).toBeGreaterThanOrEqual(14);
    for (const p of conFlusso) {
      expect(DICHIARAZIONE.test(readFileSync(p, "utf8")), `manca in ${p}`).toBe(true);
    }
  });

  it("nessun file dichiara l'opt-out senza importarlo (sarebbe un ReferenceError a runtime)", () => {
    const rotti = fileDiTest().filter((p) => {
      const t = readFileSync(p, "utf8");
      return DICHIARAZIONE.test(t) && !/from\s+"\.\/helpers\/session-cache\.js"/.test(t);
    });
    expect(rotti).toEqual([]);
  });
});
