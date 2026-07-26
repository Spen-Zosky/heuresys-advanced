/**
 * apps/api/test/mfa-fixture-parity.test.ts
 * Z-262 — guardia contro la ricaduta.
 *
 * Prima questo test verificava che le due copie dei segreti TOTP (API e web)
 * riportassero gli stessi valori. Il problema non era la divergenza fra le due
 * copie: era che entrambe **contenevano valori**, su un repository pubblico, e
 * a quei valori corrispondevano fattori MFA attivi in produzione.
 *
 * Adesso il segreto si deriva dalla chiave madre, quindi la proprietà da
 * sorvegliare è un'altra: che nei due file NON ricompaia mai un segreto
 * scritto. È questo test a fallire se qualcuno lo reintroduce — motivo per cui
 * non guarda le variabili in memoria ma il TESTO dei file su disco: un valore
 * committato è visibile lì anche se il codice non lo usa più.
 *
 * Nessun DB, nessun HTTP.
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

  it("api e web derivano dallo STESSO modulo (non due copie da allineare)", () => {
    // Non si importa il file web: sta fuori dal rootDir di apps/api e romperebbe
    // la compilazione. Si verifica la proprietà a monte, che è più forte della
    // parità dei valori: se entrambi importano lo stesso modulo, divergere è
    // impossibile — mentre due mappe di valori uguali oggi possono separarsi
    // domani, ed è esattamente ciò che questo test sorvegliava prima.
    const MODULE = "derive-access.mjs";
    expect(readFileSync(API_COPY, "utf8"), "il file API non deriva dal modulo condiviso").toContain(MODULE);
    expect(readFileSync(WEB_COPY, "utf8"), "il file web non deriva dal modulo condiviso").toContain(MODULE);
  });
});
