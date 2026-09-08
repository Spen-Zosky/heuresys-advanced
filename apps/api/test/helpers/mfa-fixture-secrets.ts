/**
 * apps/api/test/helpers/mfa-fixture-secrets.ts
 * Segreti TOTP delle identità usate dai test.
 *
 * Z-262 (2026-07-26) — QUESTO FILE NON CONTIENE VALORI. Prima ne conteneva sette, scritti in
 * chiaro, e il repository è pubblico: erano scaricabili da chiunque senza autenticazione, e a
 * quei segreti corrispondevano sette fattori MFA attivi in produzione — fra cui
 * PLATFORM_ADMIN, TENANT_ADMIN/CEO e il custode del canale whistleblowing.
 *
 * ⭐ #169 F3c (2026-09-08) — IL SEGRETO NON SI DERIVA PIÙ: SI LEGGE.
 *
 * Fino a oggi il segreto si ricavava dalla chiave madre con la stessa funzione del
 * provisioning. Risolveva il problema della pubblicazione, ma ne lasciava aperto un altro,
 * ed è la voce `#169`: la **stessa** chiave generava la password *e* il secondo fattore, due
 * HMAC distinti dal solo prefisso. Chi possedeva la chiave possedeva entrambi — quindi per
 * quel soggetto l'MFA non era un secondo fattore, era lo stesso fattore contato due volte.
 *
 * Da qui i segreti in produzione sono **casuali**, e questo file li prende dove sono: nel
 * database, cifrati, e li decifra con la chiave di cifratura che il server usa già. Tre
 * conseguenze volute:
 *   · non c'è più **nulla da calcolare**: chi ha la chiave madre non costruisce alcun codice;
 *   · continua a funzionare per **qualunque** utente, che è ciò che permette ai test di
 *     girare sull'intera popolazione invece che su sette personas fisse;
 *   · e la lettura è **legittima**: un test di integrazione ha già il database con
 *     credenziali piene — non gli si sta concedendo nulla che non avesse.
 *
 * ⚠ **PERCHÉ SERVE ANCORA**, dato che in produzione l'enforcement MFA è spento: perché
 * `buildTestApp` lo **accende di proposito** (`mfaEnforcement: true`, app.ts §S989), quindi
 * ogni login di questa suite percorre davvero la sfida a due passi. È il dettaglio che
 * distingue questa suite dalla Playwright, che gira contro il server reale e non la incontra
 * mai.
 *
 * ⚠ Il caricamento è **esplicito** (`caricaSegretiTotp()`, chiamata una volta dal setup di
 * vitest) e non un `await` di modulo. La prima stesura usava proprio quello, per tenere
 * `totpSecretFor` **sincrona** come la usano `login.ts` e il Proxy — e in vitest funzionava.
 * **Ma `tsx` compila in CJS**, dove il top-level await non esiste: `seed-test-admin.ts`, che
 * arriva qui per la catena degli import, è morto con *«Top-level await is currently not
 * supported with the "cjs" output format»*. Un modulo che si carica da sé è comodo finché
 * non lo importa qualcuno che non può aspettarlo.
 *
 * La firma resta sincrona, che era il punto: una firma asincrona si sarebbe propagata a ogni
 * chiamante per un guadagno nullo.
 *
 * Il controllo di parità (mfa-fixture-parity.test.ts) verifica che nessuna delle due copie
 * contenga valori letterali: è il test che fallisce se qualcuno reintroduce un segreto.
 */
import { pool } from "../../src/db/client.js";
import { decryptSecret } from "../../src/modules/auth/secret-crypto.js";

/** Etichetta dei fattori creati dal provisioning derivato (Z-262). */
export const E2E_FIXTURE_LABEL = "derived-access";

/**
 * I segreti in chiaro, per indirizzo, letti una volta all'import.
 *
 * ⚠ Si legge **solo** ciò che porta l'etichetta di questa suite: un fattore che una persona
 * ha arruolato per conto proprio non è materia dei test, e leggerlo sarebbe entrare in una
 * credenziale vera senza averne ragione.
 */
const SEGRETI = new Map<string, string>();

/**
 * Popola la cache. La chiama **una volta** il setup di vitest, prima di ogni test.
 *
 * Idempotente: una seconda chiamata non rilegge. Chi importa questo modulo senza chiamarla
 * — `seed-test-admin.ts`, per esempio — non paga nulla e non tocca il database.
 */
export async function caricaSegretiTotp(): Promise<number> {
  if (SEGRETI.size > 0) return SEGRETI.size;
  const r = await pool.query<{ email: string; secret: string }>(
    `SELECT u.user_email AS email, f.auth_mfa_factor_secret AS secret
       FROM sys.sys_auth_mfa_factors f
       JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
      WHERE f.auth_mfa_factor_kind = 'TOTP'
        AND f.auth_mfa_factor_metadata->>'label' = $1`,
    [E2E_FIXTURE_LABEL],
  );
  for (const riga of r.rows) {
    // Un segreto non cifrato non è un caso da gestire in silenzio: `decryptSecret`
    // restituisce il valore così com'è quando non porta il prefisso, e va bene —
    // la sentinella `v_mfa_secrets_in_cleartext` è il posto in cui quel fatto si vede.
    SEGRETI.set(riga.email.toLowerCase(), decryptSecret(riga.secret));
  }
  return SEGRETI.size;
}

/**
 * Il segreto TOTP di qualunque utente impersonabile.
 *
 * ⚠ Se manca **fallisce forte e dice cosa fare**: un `undefined` che scivola dentro un
 * `mfaCode` produrrebbe un 401 al passo due, cioè un rosso che accusa il login invece della
 * fixture assente. È la differenza fra una prova che indica il guasto e una che lo nasconde.
 */
export function totpSecretFor(email: string): string {
  const s = SEGRETI.get(email.toLowerCase());
  if (s === undefined) {
    // I due casi si distinguono, perché il rimedio è diverso: cache non caricata (chi
    // esegue non è passato dal setup) contro fattore assente per quella persona.
    const causa =
      SEGRETI.size === 0
        ? "la cache non e' stata caricata: chiama caricaSegretiTotp() (lo fa il setup di vitest)"
        : `la persona non ha un fattore '${E2E_FIXTURE_LABEL}' — 'pnpm db:provision-access' lo crea`;
    throw new Error(
      `Nessun segreto TOTP per ${email}. Non si deriva piu' (#169 F3c): si legge dal ` +
        `database, e ${causa}.`,
    );
  }
  return s;
}

/**
 * Le persone storicamente usate dai test. Non è un elenco privilegiato — qualunque utente è
 * impersonabile — ma resta come insieme di riferimento per i test che vogliono profili noti
 * (un amministratore, un manager con riporti, un dipendente, un estraneo alla linea).
 */
export const FIXTURE_PERSONA_EMAILS = [
  "enzo.spenuso@heuresys.com",
  "federica.marchetti@rtl-bank.org",
  "paolo.caputo@rtl-bank.org",
  "tommaso.fiore@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
  "marco.rinaldi@rtl-bank.org",
  "andrea.martino@rtl-bank.org",
];

/**
 * @deprecated Z-262 — i segreti non sono più una tabella di valori. Resta per i chiamanti non
 * ancora migrati; nel codice nuovo usa `totpSecretFor(email)`, che funziona per ogni utente.
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
