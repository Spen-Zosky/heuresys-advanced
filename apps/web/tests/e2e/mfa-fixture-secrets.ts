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
 * ⚠ Quindi `totpSecretFor` **fallisce, e dice cosa fare**, invece di restituire un valore
 * che non apre più niente. Non è una rinuncia: è la scelta fra un errore che si legge e un
 * 401 al passo due che accuserebbe il login invece della fixture. E oggi non toglie nulla —
 * misurato: la suite Playwright gira contro il server reale, dove l'enforcement MFA è
 * **spento**, quindi il login si chiude al primo passo e questa funzione non viene chiamata.
 * Il giorno in cui l'enforcement si accende, la strada è già costruita e non è questa: le
 * utenze di collaudo di `#169` F2 sono **esenti** dal secondo fattore per progetto.
 */
import { readMaster, derivePassword } from "../../../api/scripts/derive-access.mjs";

/** Etichetta dei fattori creati dal provisioning derivato (Z-262). */
export const E2E_FIXTURE_LABEL = "derived-access";

let masterCache: Buffer | null = null;
function master(): Buffer {
  masterCache ??= readMaster();
  return masterCache;
}

/**
 * ⛔ Il segreto TOTP non è più ottenibile da qui — vedi la nota in testa.
 *
 * Fallisce **forte**: un valore sbagliato produrrebbe un 401 al passo due, cioè un rosso che
 * accusa il login mentre il guasto è la fixture. Questo messaggio dice invece qual è la
 * strada, il giorno in cui qualcuno la incontrerà.
 */
export function totpSecretFor(email: string): string {
  throw new Error(
    `Il segreto TOTP di ${email} non si deriva piu' (#169 F3c): in produzione e' casuale, ` +
      `e questa suite non ha modo di leggerlo dal database. ` +
      `Sei qui perche' l'enforcement MFA e' stato acceso: la suite deve passare dalle ` +
      `utenze di collaudo (#169 F2), che sono esenti dal secondo fattore per progetto.`,
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
