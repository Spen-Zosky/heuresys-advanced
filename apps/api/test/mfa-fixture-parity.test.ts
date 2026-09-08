/**
 * apps/api/test/mfa-fixture-parity.test.ts
 * Z-262 — guardia contro la ricaduta.
 *
 * Prima questo test verificava che le due copie dei segreti TOTP (API e web)
 * riportassero gli stessi valori. Il problema non era la divergenza fra le due
 * copie: era che entrambe **contenevano valori**, su un repository pubblico, e
 * a quei valori corrispondevano fattori MFA attivi in produzione.
 *
 * La proprietà da sorvegliare è quindi che nei due file NON ricompaia mai un segreto
 * scritto. È questo test a fallire se qualcuno lo reintroduce — motivo per cui non guarda le
 * variabili in memoria ma il TESTO dei file su disco: un valore committato è visibile lì
 * anche se il codice non lo usa più.
 *
 * ⭐ #169 F3c (2026-09-08) — e adesso ne sorveglia una seconda, che chiude la voce: che
 * nessuna delle due copie **derivi più il segreto dalla chiave madre**. I segreti in
 * produzione sono casuali; il lato API li legge dal database, il lato web non li ottiene
 * affatto e lo dice.
 *
 * ⚠ `totpSecretFor` legge ora dal database all'import (lato API): questo file non fa DB né
 * HTTP di suo, ma il modulo che importa sì.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { totpSecretFor, FIXTURE_PERSONA_EMAILS } from "./helpers/mfa-fixture-secrets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_COPY = resolve(__dirname, "helpers", "mfa-fixture-secrets.ts");
const WEB_COPY = resolve(__dirname, "..", "..", "web", "tests", "e2e", "mfa-fixture-secrets.ts");

/** Una stringa base32 lunga associata a un'email = un segreto scritto a mano. */
function findLiteralSecrets(src: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+@[^"]+)":\s*"([A-Z2-7]{16,})"/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(`${m[1]} → ${m[2]!.slice(0, 6)}…`);
  return out;
}

describe("Z-262 — i segreti TOTP non vivono nel repository", () => {
  it("il file API non contiene nessun segreto scritto", () => {
    expect(
      findLiteralSecrets(readFileSync(API_COPY, "utf8")),
      "segreto TOTP committato: il repo e' pubblico, deve derivare dalla chiave madre",
    ).toEqual([]);
  });

  it("il file web non contiene nessun segreto scritto", () => {
    expect(
      findLiteralSecrets(readFileSync(WEB_COPY, "utf8")),
      "segreto TOTP committato nella copia web",
    ).toEqual([]);
  });

  it("la derivazione produce segreti validi e DIVERSI per utenti diversi", () => {
    const seen = new Map<string, string>();
    for (const email of FIXTURE_PERSONA_EMAILS) {
      const s = totpSecretFor(email);
      expect(s, email).toMatch(/^[A-Z2-7]{32}$/); // 160 bit, alfabeto RFC 4648
      const clash = seen.get(s);
      expect(clash, `${email} e ${clash} condividono lo stesso segreto`).toBeUndefined();
      seen.set(s, email);
    }
    expect(seen.size).toBe(FIXTURE_PERSONA_EMAILS.length);
  });

  it("la derivazione e' STABILE: due chiamate danno lo stesso segreto", () => {
    // Se non lo fosse, i test passerebbero e il login fallirebbe a caso.
    const email = FIXTURE_PERSONA_EMAILS[0]!;
    expect(totpSecretFor(email)).toBe(totpSecretFor(email));
  });

  /**
   * ⭐ #169 F3c — L'INVARIANTE È CAMBIATO, ED È PIÙ FORTE DI PRIMA.
   *
   * Fino a oggi questo caso pretendeva che le due copie **derivassero dallo stesso modulo**:
   * se entrambe importano la stessa funzione, divergere è impossibile. Era la proprietà
   * giusta finché il segreto *si derivava*.
   *
   * Ora il segreto è **casuale**, e la proprietà da sorvegliare è quella che chiude `#169`:
   * che **nessuna delle due lo ricavi più dalla chiave madre**. Verificarlo sul testo dei
   * file, e non sui valori in memoria, è ciò che rende questa guardia capace di fallire —
   * una riga che reintroduce `deriveTotpSecret` si vede lì anche prima di essere eseguita.
   *
   * ⚠ `derivePassword` resta e deve restare: la **password** è ancora derivata, ed è la via
   * con cui la suite entra. Il difetto di `#169` non era «le credenziali sono derivate», era
   * «le DUE credenziali nascono dalla STESSA chiave».
   */
  it("⭐ nessuna delle due copie deriva piu' il SEGRETO dalla chiave madre", () => {
    const VIETATO = "deriveTotpSecret";
    expect(
      readFileSync(API_COPY, "utf8").includes(VIETATO),
      "il file API deriva ancora il segreto TOTP: #169 F3c e' stata disfatta",
    ).toBe(false);
    expect(
      readFileSync(WEB_COPY, "utf8").includes(VIETATO),
      "il file web deriva ancora il segreto TOTP: #169 F3c e' stata disfatta",
    ).toBe(false);
  });

  it("la PASSWORD resta derivata dal modulo condiviso — non era lei il difetto", () => {
    // Il contro-caso del test qui sopra. Senza, «non c'e' piu' deriveTotpSecret» sarebbe
    // verde anche se qualcuno avesse svuotato entrambi i file.
    expect(
      readFileSync(WEB_COPY, "utf8"),
      "il file web non deriva piu' nemmeno la password: la suite non entrerebbe",
    ).toContain("derivePassword");
  });
});
