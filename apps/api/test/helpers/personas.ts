/**
 * apps/api/test/helpers/personas.ts
 * Password delle identità usate dai test.
 *
 * Z-262 (2026-07-26) — non c'è più UNA password condivisa da variabile
 * d'ambiente: ogni utente ha la propria, DERIVATA dalla chiave madre
 * (.secrets/dev-access-master.key) con la stessa funzione che usa
 * `pnpm dev:whoami`. Il cambiamento è volutamente chirurgico: i file di test
 * chiamano `login(app, email)` e ricevono la password come valore predefinito,
 * quindi i 161 file che passano da qui non cambiano di una riga.
 *
 * Perché: la suite girava su 7 personas fisse, e una popolazione fissa nasconde
 * difetti. Misurato nella stessa sessione — il test di Z-259 risultava verde
 * solo perché girava su `tommaso.fiore`, che per combinazione aveva 0 righe del
 * tipo che perdeva; la fuga esisteva su `luca.conti`, 305 righe su 305. Ora
 * sono impersonabili tutti i 159 utenti che non sono persone fisiche.
 *
 * Resta valido il principio di F-001 (audit 2026-07-03): nessuna password è una
 * costante committata, e la suite fallisce CHIUSA se la fonte manca. Cambia
 * solo la fonte: non più una variabile d'ambiente condivisa, ma una chiave
 * gitignored da cui ogni password si ricalcola.
 */
import { readMaster, derivePassword, isRealPerson } from "../../scripts/derive-access.mjs";

let masterCache: Buffer | null = null;
function master(): Buffer {
  masterCache ??= readMaster();
  return masterCache;
}

/** La password di QUALUNQUE utente impersonabile, ricalcolata al momento. */
export function passwordFor(email: string): string {
  if (isRealPerson(email)) {
    throw new Error(
      `${email} e' una persona fisica: la sua password la sceglie lei e non e' derivabile. ` +
        `I test non devono impersonarla — usa un altro utente.`,
    );
  }
  return derivePassword(master(), email);
}

/**
 * SEGNAPOSTO, non una password.
 *
 * Z-262 — 162 file di test passano questa costante a `login(app, email, PWD)`.
 * Non esiste piu' una password unica: ognuno ha la propria, derivata dalla sua
 * email. Invece di modificare 162 file, questa costante diventa un segnaposto
 * che `loginRaw` riconosce e risolve nella password DELL'UTENTE che sta
 * autenticando.
 *
 * Il valore e' volutamente impossibile da confondere con una password vera: se
 * finisse per errore in un confronto o in una scrittura, si vedrebbe subito
 * invece di fallire in silenzio con un 401 misterioso.
 *
 * Nel codice nuovo usa direttamente `passwordFor(email)`.
 */
export const TEST_PERSONA_PASSWORD = "__Z262_DERIVA_DALL_EMAIL__";
