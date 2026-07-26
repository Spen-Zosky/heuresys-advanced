/**
 * apps/api/test/helpers/mfa-fixture-secrets.ts
 * Segreti TOTP delle identità usate dai test.
 *
 * Z-262 (2026-07-26) — QUESTO FILE NON CONTIENE PIÙ VALORI. Prima ne conteneva
 * sette, scritti in chiaro, e il repository è pubblico: erano scaricabili da
 * chiunque senza autenticazione (`raw.githubusercontent.com` → 200). A quei
 * segreti corrispondevano sette fattori MFA attivi in produzione — fra cui
 * PLATFORM_ADMIN, TENANT_ADMIN/CEO e il custode del canale whistleblowing —
 * quindi per quegli account il secondo fattore non proteggeva più nulla.
 *
 * Ora il segreto si DERIVA dalla chiave madre (.secrets/dev-access-master.key,
 * gitignored) con la stessa funzione usata dal provisioning e da `dev:whoami`.
 * Due conseguenze volute:
 *   - non c'è nulla da pubblicare: chi legge il repository non ottiene niente;
 *   - funziona per QUALUNQUE utente, non per sette — che è ciò che permette ai
 *     test di girare sull'intera popolazione invece che su personas fisse.
 *
 * Il controllo di parità (mfa-fixture-parity.test.ts) verifica ora che nessuna
 * delle due copie (qui e apps/web/tests/e2e) contenga valori letterali: è il
 * test che fallisce se qualcuno reintroduce un segreto nel repository.
 */
import { readMaster, deriveTotpSecret } from "../../scripts/derive-access.mjs";

/** Etichetta dei fattori creati dal provisioning derivato (Z-262). Sostituisce
 *  `e2e-fixture`, l'etichetta dei fattori con i segreti pubblicati. */
export const E2E_FIXTURE_LABEL = "derived-access";

let masterCache: Buffer | null = null;
function master(): Buffer {
  masterCache ??= readMaster();
  return masterCache;
}

/** Il segreto TOTP di QUALUNQUE utente impersonabile, ricalcolato al momento. */
export function totpSecretFor(email: string): string {
  return deriveTotpSecret(master(), email);
}

/**
 * Le persone storicamente usate dai test. Non è più un elenco privilegiato —
 * qualunque utente è impersonabile — ma resta come insieme di riferimento per i
 * test che vogliono profili noti (un amministratore, un manager con riporti, un
 * dipendente, un estraneo alla linea gerarchica).
 */
export const FIXTURE_PERSONA_EMAILS = [
  "admin@heuresys.com",
  "federica.marchetti@rtl-bank.org",
  "paolo.caputo@rtl-bank.org",
  "tommaso.fiore@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
  "marco.rinaldi@rtl-bank.org",
  "andrea.martino@rtl-bank.org",
];

/**
 * @deprecated Z-262 — i segreti non sono più una tabella di valori. Resta per i
 * chiamanti non ancora migrati e si popola per derivazione; nel codice nuovo usa
 * `totpSecretFor(email)`, che funziona per ogni utente e non solo per questi.
 */
export const FIXTURE_TOTP_SECRETS: Record<string, string> = new Proxy(
  {},
  {
    get: (_t, prop: string) => (typeof prop === "string" ? totpSecretFor(prop) : undefined),
    has: () => true,
    ownKeys: () => [...FIXTURE_PERSONA_EMAILS],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  },
) as Record<string, string>;
