/**
 * apps/web/tests/e2e/mfa-fixture-secrets.ts
 * Segreti TOTP lato web (Playwright).
 *
 * Z-262 (2026-07-26) — QUESTO FILE NON CONTIENE PIÙ VALORI. Prima ne conteneva
 * sette in chiaro, gemelli di quelli lato API, e il repository è pubblico: erano
 * scaricabili da chiunque senza autenticazione, e a quei segreti corrispondevano
 * fattori MFA attivi in produzione.
 *
 * La **password** si deriva dalla chiave madre (.secrets/dev-access-master.key, gitignored).
 * Playwright non può importare attraverso il confine di workspace con un import di
 * pacchetto, ma può farlo con un percorso relativo esplicito verso un modulo .mjs: così la
 * derivazione resta UNA SOLA implementazione, invece di una copia da tenere allineata.
 *
 * ⭐ #169 F3c (2026-09-08) — IL SEGRETO TOTP NON SI DERIVA PIÙ, E QUI NON SI PUÒ LEGGERE.
 *
 * I segreti in produzione sono ora **casuali**: chi possiede la chiave madre non li
 * ricostruisce, ed era questo il difetto della voce — la stessa chiave generava password e
 * secondo fattore, quindi per chi la possedeva l'MFA era lo stesso fattore contato due volte.
 * Il lato API li legge dal database, dove sono cifrati. **Qui non è possibile**: `apps/web`
 * non ha un client PostgreSQL, e aggiungerlo per una suite di browser sarebbe una dipendenza
 * nuova in cambio di nulla.
 *
 * ⚠ **Quella nota conteneva un errore, e va letta come cronaca.** Diceva: «oggi non toglie
 * nulla — misurato: la suite gira contro il server reale, dove l'enforcement MFA è spento,
 * quindi questa funzione non viene chiamata». La misura era giusta e la frase più larga
 * della misura (**DIF-4**): vera in produzione, **falsa in CI**, dove
 * `MFA_ENFORCEMENT_ENABLED` vale `true` per default e il job non lo spegne — la CI accende
 * quel ramo **di proposito** (S983 WS-E). Costo misurato: sei setup di autenticazione rossi
 * e l'intera suite a cascata, run `34186462524`.
 *
 * ⭐ S1093 — come sta adesso. Il segreto **resta casuale e non derivabile** (l'invariante di
 * F3c è intatta), ma non è più *ignoto*: il seed di collaudo lo genera e lo deposita in
 * `tests/.auth/totp-secrets.json` — gitignored, per-macchina, rigenerato a ogni corsa, e
 * scritto **solo** con `NODE_ENV=test`. `totpSecretFor` legge da lì, e fallisce forte se il
 * deposito manca.
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import { readMaster, derivePassword } from "../../../api/scripts/derive-access.mjs";

/** Etichetta dei fattori creati dal provisioning derivato (Z-262). */
export const E2E_FIXTURE_LABEL = "derived-access";

let masterCache: Buffer | null = null;
function master(): Buffer {
  masterCache ??= readMaster();
  return masterCache;
}

/** Il deposito che il seed di collaudo scrive (gitignored, per-macchina, rigenerato a ogni corsa).
 *  Relativo alla cwd di Playwright (`apps/web`), come `storageStateFor` in fixtures.ts — una sola
 *  convenzione di percorso per la stessa cartella, non due. */
const PERCORSO_SEGRETI = path.join("tests", ".auth", "totp-secrets.json");

let depositoCache: Record<string, string> | null = null;
function deposito(): Record<string, string> {
  if (depositoCache) return depositoCache;
  try {
    const grezzo = JSON.parse(readFileSync(PERCORSO_SEGRETI, "utf8")) as {
      segreti?: Record<string, string>;
    };
    depositoCache = grezzo.segreti ?? {};
  } catch {
    depositoCache = {};
  }
  return depositoCache;
}

/**
 * Il segreto TOTP della persona, **letto dal deposito del collaudo** — mai derivato.
 *
 * ⭐ S1093 — perché questa funzione è tornata a restituire un valore. Dal 2026-09-08 (#169 F3c)
 * lanciava sempre, sul presupposto che il ramo MFA non si percorresse mai: *«la suite gira contro
 * il server reale, dove l'enforcement è spento»*. Vero in produzione — misurato, il login di una
 * persona vera si chiude al primo passo — e **falso in CI**, dove `MFA_ENFORCEMENT_ENABLED` vale
 * `true` per default (`apps/api/src/config/env.ts`) e il job non lo spegne: la CI accende quel ramo
 * **di proposito**, per esercitarlo (S983 WS-E). Risultato misurato: sei setup di autenticazione
 * rossi, due tentativi ciascuno, e con essi l'intera suite.
 *
 * L'invariante di F3c resta intatta: il segreto **non si deriva dalla chiave madre**, è casuale, e
 * chi possiede quella chiave non lo ricostruisce. Ma casuale non vuol dire ignoto a chi lo genera:
 * il seed di collaudo lo scrive in `tests/.auth/totp-secrets.json`, gitignored, rigenerato a ogni
 * corsa, mai propagato, e prodotto **solo** con `NODE_ENV=test`.
 *
 * Se il deposito manca, si **fallisce forte** invece di indovinare: un valore sbagliato darebbe un
 * 401 al passo due, cioè un rosso che accusa il login mentre il guasto è la fixture.
 */
export function totpSecretFor(email: string): string {
  const segreto = deposito()[email];
  if (segreto) return segreto;
  throw new Error(
    `Nessun segreto TOTP di collaudo per ${email}. La suite e' arrivata al secondo fattore, ` +
      `quindi l'enforcement MFA e' acceso su questo ambiente (in produzione e' spento). ` +
      `Il segreto e' casuale (#169 F3c) e non si deriva: lo deposita il seed. ` +
      `Rimedio: NODE_ENV=test pnpm db:seed-test-admin — scrive tests/.auth/totp-secrets.json.`,
  );
}

/**
 * La password di QUALUNQUE utente impersonabile, ricalcolata al momento.
 *
 * Z-262 ha spostato le credenziali su una password PER UTENTE, ma lato Playwright
 * era rimasta una costante unica (`TEST_ADMIN_PASSWORD`): il login E2E falliva per
 * ogni persona e i sei setup di autenticazione andavano in timeout, con la suite
 * intera a cascata. La derivazione è la stessa del lato API — una sola
 * implementazione, non una copia da tenere allineata.
 */
export function passwordFor(email: string): string {
  return derivePassword(master(), email);
}

/**
 * @deprecated Z-262 — i segreti non sono più una tabella di valori. Resta per i
 * chiamanti non ancora migrati; nel codice nuovo usa `totpSecretFor(email)`.
 */
export const FIXTURE_TOTP_SECRETS: Record<string, string> = new Proxy(
  {},
  {
    get: (_t, prop: string) => (typeof prop === "string" ? totpSecretFor(prop) : undefined),
    has: () => true,
  },
) as Record<string, string>;
