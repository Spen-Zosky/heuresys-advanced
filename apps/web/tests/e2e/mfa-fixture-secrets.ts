/**
 * apps/web/tests/e2e/mfa-fixture-secrets.ts
 * Segreti TOTP lato web (Playwright).
 *
 * Z-262 (2026-07-26) — QUESTO FILE NON CONTIENE PIÙ VALORI. Prima ne conteneva
 * sette in chiaro, gemelli di quelli lato API, e il repository è pubblico: erano
 * scaricabili da chiunque senza autenticazione, e a quei segreti corrispondevano
 * fattori MFA attivi in produzione.
 *
 * Ora il segreto si deriva dalla chiave madre (.secrets/dev-access-master.key,
 * gitignored). Playwright non può importare attraverso il confine di workspace
 * con un import di pacchetto, ma può farlo con un percorso relativo esplicito
 * verso un modulo .mjs: così la derivazione resta UNA SOLA implementazione,
 * invece di una copia da tenere allineata a mano.
 */
import { readMaster, deriveTotpSecret } from "../../../api/scripts/derive-access.mjs";

/** Etichetta dei fattori creati dal provisioning derivato (Z-262). */
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

/** La password di QUALUNQUE utente impersonabile, ricalcolata al momento. */
export { derivePassword } from "../../../api/scripts/derive-access.mjs";

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
