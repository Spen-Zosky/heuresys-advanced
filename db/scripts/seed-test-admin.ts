/**
 * db/scripts/seed-test-admin.ts
 * E2E / integration persona AUTH seeder — idempotent, deterministic.
 *
 * Post RTL-rebuild (2026-05-30): the test personas are now REAL users wired into
 * the real RTL_BANK org by the rebuild seeds (db/seeds/rtl-rebuild/*) — they already
 * have positions, RBAC roles and assignments. This script's SOLE job is to make those
 * real users LOGIN-CAPABLE with the shared test password by ensuring a LOCAL auth
 * identity + a current ARGON2ID credential. It does NOT create users, grant roles, or
 * build positions (those come from the rebuild seeds).
 *
 *   ┌───────────────┬─────────────────────────────────┬──────────────────────────────┐
 *   │ persona       │ real user                       │ role / scope                  │
 *   ├───────────────┼─────────────────────────────────┼──────────────────────────────┤
 *   │ platformAdmin │ enzo.spenuso@heuresys.com              │ PLATFORM_ADMIN (native)       │
 *   │ tenantAdmin   │ federica.marchetti@rtl-bank.org │ TENANT_ADMIN  (RTL_BANK)      │
 *   │ manager       │ paolo.caputo@rtl-bank.org       │ MANAGER (manages tommaso)     │
 *   │ employee      │ tommaso.fiore@rtl-bank.org      │ USER (paolo's subordinate)    │
 *   │ outsider      │ antonio.parisi@rtl-bank.org     │ USER (claudia's team, not     │
 *   │               │                                 │   in paolo's team)            │
 *   └───────────────┴─────────────────────────────────┴──────────────────────────────┘
 *
 * The manager→employee reports-to edge and the outsider's separate team are REAL org
 * relationships (verified from sys_positions.reports_to + assignments), so the AUTH §6
 * scope matrix tests assert against authentic hierarchy, not a synthetic TEST_ scaffold.
 *
 * Idempotent: identity/credential are checked before insert; re-run reports EXISTS.
 * Set TEST_ADMIN_RESET_PASSWORD=1 to rotate the credential to the DERIVED password (Z-262).
 * Per l'intera popolazione (159 utenti, non solo le 7 personas): pnpm db:provision-access
 *
 * Run: pnpm db:seed-test-admin
 */

import { Client } from "pg";
import argon2 from "argon2";
import { E2E_FIXTURE_LABEL } from "../../apps/api/test/helpers/mfa-fixture-secrets.js";
// Z-262: una sola implementazione della derivazione, importata — mai una copia.
// #169 F3c: e una sola della GENERAZIONE, per la stessa ragione.
import {
  readMaster,
  derivePassword,
  segretoTotpCasuale,
} from "../../apps/api/scripts/derive-access.mjs";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
// ⭐ S1093 — il segreto si scrive CIFRATO, come lo scriverebbe il repository. Scriverlo in
// chiaro «funziona» (decryptSecret e' self-identifying e lo rileggerebbe as-is) ma accende la
// sentinella `v_mfa_secrets_in_cleartext`, che pretende zero: l'ha vista rossa la prova
// generale prima che la CI potesse vederla. Un seed non e' esente dagli invarianti solo
// perche' e' uno script.
import { encryptSecret, decryptSecret } from "../../apps/api/src/modules/auth/secret-crypto.js";
import { createHash } from "node:crypto";

/** Otto caratteri di digest: identificano un segreto senza rivelarlo. Mai il valore, mai in un log. */
function impronta(segreto: string): string {
  return createHash("sha256").update(segreto).digest("hex").slice(0, 8);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

/** The six E2E/integration personas, by real email. Order = display order.
 *  marco.rinaldi (TEAM_LEADER, r1b) joined the fixture set in S983 WS-E —
 *  the mandatory-MFA total coverage gates every login-capable persona. */
const PERSONA_EMAILS: readonly string[] = [
  "enzo.spenuso@heuresys.com",
  "federica.marchetti@rtl-bank.org",
  "paolo.caputo@rtl-bank.org",
  "tommaso.fiore@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
  "marco.rinaldi@rtl-bank.org",
  // #51 E1 (S1026): the designated whistleblowing custodian (Head of Legal &
  // Compliance, role granted by mig 000205) needs a login to reach the console.
  "andrea.martino@rtl-bank.org",
];

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

interface EnsureResult {
  userId: string;
  identityCreated: boolean;
  credentialCreated: boolean;
  totpFactorCreated: boolean;
}

/**
 * S983 WS-E (mandatory-MFA total coverage): ensure the persona carries the
 * VERIFIED e2e-fixture TOTP factor. The metadata label is BOTH the idempotency
 * key (no unique on (user,kind)) and the discriminator that shields the fixture
 * from the suites' scoped DELETEs.
 *
 * ⚠ La riga «base32 stored as-is — the platform stores TOTP secrets
 * base32-plaintext» che stava qui è **scaduta** e va tolta, non tramandata:
 * misurato il 2026-09-08, ogni segreto TOTP in produzione è lungo 93 caratteri,
 * cioè `enc:v1:` + iv + tag + ciphertext in base64 — sono **cifrati AES-256-GCM**
 * (QW-SEC6, `secret-crypto.ts`), quindi **questa funzione li scrive cifrati**, con
 * la stessa `encryptSecret` del repository — una sola implementazione, non una copia.
 *
 * ⚠ Scriverli in chiaro *funzionerebbe*, ed è la prima cosa che ho fatto: `decryptSecret`
 * è self-identifying e un valore senza il prefisso `enc:v1:` torna as-is. Ma «funziona»
 * non è «è corretto»: accende la sentinella `v_mfa_secrets_in_cleartext`, che pretende
 * zero. L'ha vista rossa la prova generale (`ci-rehearsal.sh`, 7 righe) prima che potesse
 * vederla la CI. Un seed non è esente dagli invarianti perché è uno script.
 *
 * ⚠⚠ E QUI AVEVO SCRITTO UNA COSA FALSA, il 2026-09-08, poche ore prima di questa riga:
 * «i fattori con questa label restano esclusi dalla ri-cifratura pigra». **Non è vero.**
 * `mfa-service.ts` esclude i fattori la cui label vale `FIXTURE_FACTOR_LABEL`, che è
 * `"e2e-fixture"` — la label usata dai **sette test di integrazione API**. Quella scritta
 * qui è `E2E_FIXTURE_LABEL = "derived-access"`, che è un'altra cosa: **due famiglie di
 * fixture con due etichette**, e l'esclusione ne copre una sola.
 *
 * Quindi i fattori creati da questo seed **non** sono esclusi: dopo un login riuscito la
 * ri-cifratura pigra li tocca. Oggi è innocuo, perché li scriviamo già cifrati e quel ramo
 * scatta solo su un segreto in chiaro. Ma la frase era falsa quando l'ho scritta, ed è
 * esattamente la classe di difetto che questo progetto insegue: un'affermazione plausibile
 * messa in un commento senza misurarla. La misura è una riga:
 * `python docs/kb/tools/chi_sorveglia.py e2e-fixture`.
 *
 * ⭐ #169 F3c + S1093 — il segreto è **casuale**: chi possiede la chiave madre non
 * lo ricostruisce, ed era quello il difetto della voce. Ma casuale non vuol dire
 * *ignoto a chi lo genera*: in un ambiente di **collaudo** la suite deve poter
 * rispondere al secondo fattore, o smette di provare il ramo MFA che la CI accende
 * apposta. Quindi con `imponi` la funzione **restituisce** il segreto in chiaro al
 * chiamante, che lo depositerà dove Playwright lo legge — mai in produzione.
 */
async function ensureTotpFactor(
  client: Client,
  userId: string,
  imponi: boolean,
): Promise<{ creato: boolean; segreto: string | null }> {
  const secret = segretoTotpCasuale();
  const res = await client.query(
    `INSERT INTO sys.sys_auth_mfa_factors
       (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret,
        auth_mfa_factor_metadata, auth_mfa_factor_verified)
     SELECT $1, 'TOTP', $2, jsonb_build_object('label', $3::text), true
      WHERE NOT EXISTS (
        SELECT 1 FROM sys.sys_auth_mfa_factors f
         WHERE f.auth_mfa_factor_user_id = $1
           AND f.auth_mfa_factor_kind = 'TOTP'
           AND f.auth_mfa_factor_metadata->>'label' = $3
      )`,
    [userId, encryptSecret(secret), E2E_FIXTURE_LABEL],
  );
  const creato = (res.rowCount ?? 0) > 0;
  if (creato) return { creato, segreto: secret };
  if (!imponi) return { creato, segreto: null };

  // Il fattore c'era già e il suo segreto è ignoto — casuale quando fu scritto, e oggi
  // cifrato at-rest. In collaudo lo si **rigenera**, perché un secondo fattore a cui
  // nessuno sa rispondere non prova niente: manda in timeout l'autenticazione e con essa
  // l'intera suite (misurato: 6 setup rossi × 2 tentativi, run 34186462524).
  // La guardia che tiene questo ramo fuori dalla produzione è sul chiamante, ed è
  // negativa per difetto.
  await client.query(
    `UPDATE sys.sys_auth_mfa_factors
        SET auth_mfa_factor_secret = $2, auth_mfa_factor_verified = true
      WHERE auth_mfa_factor_user_id = $1
        AND auth_mfa_factor_kind = 'TOTP'
        AND auth_mfa_factor_metadata->>'label' = $3`,
    [userId, encryptSecret(secret), E2E_FIXTURE_LABEL],
  );
  return { creato, segreto: secret };
}

/**
 * ⭐ S1093 — LA GUARDIA. È il punto più delicato di questo script: se sbaglia, **rigenera i
 * secondi fattori veri delle persone in produzione** e li deposita su disco.
 *
 * Serve che siano vere **entrambe** le condizioni, perché una sola non basta:
 *  1. `NODE_ENV === "test"` — l'ambiente lo dichiara. Da sola è **insufficiente**: su questa
 *     macchina il `.env` punta alla produzione via tunnel, quindi un `NODE_ENV=test` distratto
 *     scriverebbe lì. È il caso limite che ha fatto riscrivere questa guardia.
 *  2. il **database** si dichiara di collaudo dal proprio nome (`heuresys_ci`, o un qualunque
 *     `*_ci` / `*_test`). La produzione è `heuresys_advanced` e non corrisponde mai.
 *
 * È negativa per difetto in ogni ramo cieco: `NODE_ENV` assente non è `"test"`; `POSTGRES_DB`
 * assente non corrisponde ad alcun criterio. Nessun ramo «se non so, esporto».
 *
 * Se un giorno la CI rinomina il proprio database, questa guardia la fa tornare **rossa** con
 * un messaggio esplicito invece di aprirsi: è il verso giusto in cui sbagliare.
 */
function eDiCollaudo(): boolean {
  if (process.env.NODE_ENV !== "test") return false;
  const db = process.env.POSTGRES_DB;
  if (!db) return false;
  const collaudo = db === "heuresys_ci" || /_(ci|test)$/.test(db);
  if (!collaudo) {
    // Dirlo forte: chi ha scritto NODE_ENV=test si aspetta l'export, e un rifiuto silenzioso
    // lo manderebbe a cercare il guasto dentro Playwright invece che nella propria riga di
    // comando. Il rifiuto è corretto; ciò che non deve essere è muto.
    console.warn(
      `  ⚠ NODE_ENV=test ma il database e' '${db}': NON e' un database di collaudo, ` +
        `quindi i segreti TOTP non vengono ne' rigenerati ne' depositati (guardia S1093).`,
    );
  }
  return collaudo;
}

/** Dove Playwright va a leggere i segreti del solo ambiente di collaudo.
 *  `apps/web/tests/.auth/` è già gitignored (`apps/web/.gitignore:1`) perché ospita
 *  gli storageState, che contengono cookie di sessione veri: è la casa giusta. */
const PERCORSO_SEGRETI = resolve(repoRoot, "apps", "web", "tests", ".auth", "totp-secrets.json");

/**
 * Deposita i segreti TOTP dell'ambiente di collaudo dove la fixture Playwright li legge.
 *
 * Chiamata SOLO dietro la guardia `NODE_ENV === "test"`. Non è un canale di distribuzione:
 * il file è per-macchina, si riscrive a ogni seed, non entra nel repository e non viaggia
 * con `align-clones.sh`. In CI nasce e muore dentro il job.
 */
function depositaSegretiDiCollaudo(segreti: Record<string, string>): void {
  const quanti = Object.keys(segreti).length;
  if (quanti === 0) {
    console.log("  totp-collaudo: nessun segreto da depositare");
    return;
  }
  // ⭐ S1093 — L'IMPRONTA, e perché costa una riga e vale un giro di CI intero.
  // Il primo tentativo di correzione ha lasciato la CI rossa con un errore DIVERSO: la
  // fixture forniva un codice e il server rispondeva «Codice MFA non valido o scaduto». Da
  // fuori non si distingue fra «il deposito non è quello che il server legge» e «il server
  // non riesce a leggere il proprio segreto»: sono due guasti opposti con lo stesso sintomo.
  // Stampare qui l'impronta di ciò che si è scritto, e nella fixture quella di ciò che si è
  // usato, rende quel confronto una MISURA invece di un'ipotesi. Otto caratteri di digest:
  // identificano senza rivelare — un segreto non si stampa mai, nemmeno in un log di CI.
  for (const [email, s] of Object.entries(segreti)) {
    console.log(`    impronta ${email.padEnd(34)} ${impronta(s)}`);
  }
  mkdirSync(dirname(PERCORSO_SEGRETI), { recursive: true });
  writeFileSync(
    PERCORSO_SEGRETI,
    `${JSON.stringify(
      {
        avvertenza:
          "Segreti TOTP del solo ambiente di COLLAUDO. Rigenerati a ogni seed, gitignored, " +
          "mai propagati. Scritti solo con NODE_ENV=test (db/scripts/seed-test-admin.ts).",
        database: process.env.POSTGRES_DB ?? null,
        segreti,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`  totp-collaudo: ${quanti} segreti depositati in apps/web/tests/.auth/`);
}

/**
 * Ensure a real persona user has a LOCAL identity + a current ARGON2ID credential for
 * `password`. The user MUST already exist (created by the rebuild seeds). Never inserts
 * users / roles / positions.
 */
async function ensureAuth(
  client: Client,
  email: string,
  password: string,
  wantsReset: boolean,
): Promise<EnsureResult> {
  const userRes = await client.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
    [email],
  );
  if (userRes.rows.length === 0) {
    throw new Error(
      `persona user not found: ${email} — run the RTL rebuild seeds (db/seeds/rtl-rebuild) first.`,
    );
  }
  const userId = userRes.rows[0]!.user_id;

  const idtExisting = await client.query<{ auth_identity_id: string }>(
    `SELECT auth_identity_id FROM sys.sys_auth_identities
      WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`,
    [userId],
  );
  let identityId: string;
  let identityCreated = false;
  if (idtExisting.rows.length > 0) {
    identityId = idtExisting.rows[0]!.auth_identity_id;
  } else {
    const ins = await client.query<{ auth_identity_id: string }>(
      `INSERT INTO sys.sys_auth_identities
          (auth_identity_user_id, auth_identity_provider,
           auth_identity_email_verified, auth_identity_is_active)
        VALUES ($1, 'LOCAL', true, true)
        RETURNING auth_identity_id`,
      [userId],
    );
    identityId = ins.rows[0]!.auth_identity_id;
    identityCreated = true;
  }

  const credExisting = await client.query<{ auth_credential_id: string }>(
    `SELECT auth_credential_id FROM sys.sys_auth_credentials
      WHERE auth_credential_identity_id = $1 AND auth_credential_is_current = true`,
    [identityId],
  );
  let credentialCreated = false;
  if (credExisting.rows.length === 0 || wantsReset) {
    if (credExisting.rows.length > 0) {
      await client.query(
        `UPDATE sys.sys_auth_credentials
            SET auth_credential_is_current = false, rotated_at = now()
          WHERE auth_credential_id = $1`,
        [credExisting.rows[0]!.auth_credential_id],
      );
    }
    const hash = await argon2.hash(password, ARGON2_PARAMS);
    await client.query(
      `INSERT INTO sys.sys_auth_credentials
          (auth_credential_identity_id, auth_credential_algorithm,
           auth_credential_hash, auth_credential_is_current,
           auth_credential_must_rotate)
        VALUES ($1, 'ARGON2ID', $2, true, false)`,
      [identityId, hash],
    );
    credentialCreated = true;
  }

  return { userId, identityCreated, credentialCreated, totpFactorCreated: false };
}

/**
 * ⭐ S1093 F4 — LO STATO DICHIARATO, e perché è il rimedio all'aleatorietà.
 *
 * Enzo, 2026-09-08: *«È scritto con logiche del tipo "inserisci solo se non c'è già": con lo
 * stesso comando, se la riga c'è si comporta in un modo, se non c'è in un altro.
 * L'instabilità è dentro lo strumento, progettata lì dentro, non nell'esecuzione.»*
 *
 * La diagnosi è giusta. Un seed che **negozia** con ciò che trova, girando su un database che
 * è una copia della produzione — e che quindi parte da uno stato diverso ogni volta — produce
 * esiti diversi dallo stesso comando. E chi lo lancia non ha modo di accorgersene, perché
 * l'uscita dice `CREATED` o `EXISTS`, cioè **cosa ha fatto**, non **dove è arrivato**.
 *
 * Questa funzione ribalta la domanda: non «cosa ho fatto», ma **«lo stato è quello dichiarato?»**.
 * È una post-condizione, e come tutte le post-condizioni di questo progetto guarda anche ciò
 * che NON doveva cambiare. Se lo stato non è quello atteso **il seed fallisce**, invece di
 * riuscire a metà e lasciare che se ne accorga la suite mezz'ora dopo.
 *
 * LO STATO DICHIARATO, per ogni persona dell'elenco:
 *   ① esiste un'identità LOCAL con una credenziale corrente;
 *   ② esiste **esattamente un** fattore TOTP con l'etichetta di questa famiglia, VERIFICATO;
 *   ③ il suo segreto è cifrato a riposo (`enc:v1:`), o la sentinella dei segreti in chiaro
 *      si accende — ed è la stessa che ha colto questo script il 2026-09-08;
 *   ④ **in collaudo soltanto**: quel segreto è quello depositato per Playwright. È il corno
 *      che rende il seed DETERMINISTICO dove serve — a parità di ambiente, lo stesso comando
 *      lascia lo stesso stato, quale che fosse il punto di partenza.
 */
async function dichiaraStatoRaggiunto(
  client: Client,
  ambienteDiCollaudo: boolean,
  segreti: Record<string, string>,
): Promise<void> {
  const guasti: string[] = [];

  for (const email of PERSONA_EMAILS) {
    const { rows } = await client.query<{
      fattori: string;
      verificati: string;
      cifrati: string;
      segreto: string | null;
    }>(
      `SELECT count(*)::text                                            AS fattori,
              count(*) FILTER (WHERE f.auth_mfa_factor_verified)::text  AS verificati,
              count(*) FILTER (WHERE f.auth_mfa_factor_secret LIKE 'enc:v1:%')::text AS cifrati,
              max(f.auth_mfa_factor_secret)                             AS segreto
         FROM sys.sys_auth_mfa_factors f
         JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
        WHERE u.user_email = $1
          AND f.auth_mfa_factor_kind = 'TOTP'
          AND f.auth_mfa_factor_metadata->>'label' = $2`,
      [email, E2E_FIXTURE_LABEL],
    );
    const r = rows[0];
    if (!r || r.fattori !== "1") {
      guasti.push(`${email}: fattori TOTP '${E2E_FIXTURE_LABEL}' = ${r?.fattori ?? "?"}, atteso 1`);
      continue;
    }
    if (r.verificati !== "1") guasti.push(`${email}: il fattore non e' VERIFICATO`);
    if (r.cifrati !== "1") {
      guasti.push(
        `${email}: il segreto NON e' cifrato a riposo — accende v_mfa_secrets_in_cleartext`,
      );
    }
    // ④ il corno del collaudo: cio' che la suite usera' deve essere cio' che il database ha.
    if (ambienteDiCollaudo && r.segreto) {
      const atteso = segreti[email];
      if (!atteso) {
        guasti.push(`${email}: nessun segreto depositato, ma l'ambiente e' di collaudo`);
      } else if (decryptSecret(r.segreto) !== atteso) {
        guasti.push(
          `${email}: il segreto nel database NON e' quello depositato per la suite ` +
            `(impronte ${impronta(decryptSecret(r.segreto))} contro ${impronta(atteso)})`,
        );
      }
    }
  }

  if (guasti.length) {
    console.error("");
    console.error("⛔ STATO NON RAGGIUNTO — il seed non ha portato il database dove dichiara:");
    for (const g of guasti) console.error(`   ✗ ${g}`);
    throw new Error(
      `seed-test-admin: ${guasti.length} scostamenti dallo stato dichiarato. ` +
        `Un seed che riesce a meta' e' peggio di un seed che fallisce: il difetto si scopre ` +
        `mezz'ora dopo, addosso a chi lo usa.`,
    );
  }

  console.log(
    `  stato dichiarato: VERIFICATO su ${PERSONA_EMAILS.length} persone — 1 fattore TOTP ` +
      `verificato e cifrato ciascuna` +
      (ambienteDiCollaudo ? ", e il segreto e' quello depositato per la suite" : ""),
  );
}


async function main() {
  // Z-262 (2026-07-26): la password di una persona NON è più una costante condivisa,
  // è DERIVATA per-utente dalla chiave madre (.secrets/dev-access-master.key) — la
  // stessa derivazione che usano il provisioner (db/scripts/provision-derived-access.ts),
  // i test API e Playwright.
  //
  // Questo seeder era rimasto indietro e scriveva ancora $TEST_ADMIN_PASSWORD grezza:
  // con TEST_ADMIN_RESET_PASSWORD=1 sovrascriveva le credenziali derivate e faceva
  // fallire il login di TUTTE le personas (misurato 2026-07-31 con
  // `node apps/api/scripts/verify-derived-login.mjs <email>` → FALLITO; riparato con
  // `pnpm db:provision-access --realign`). Due scrittori della stessa credenziale che
  // non concordano sono il difetto: ora la derivazione è UNA SOLA, importata.
  const master = readMaster();
  const wantsReset = process.env.TEST_ADMIN_RESET_PASSWORD === "1";

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  console.log(
    `Connected to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  );

  try {
    await client.query("BEGIN");

    // ⭐ S1093 — LA GUARDIA, ed è il punto più delicato di questo script.
    const ambienteDiCollaudo = eDiCollaudo();
    const segretiDiCollaudo: Record<string, string> = {};

    const report: Array<{ email: string } & EnsureResult> = [];
    for (const email of PERSONA_EMAILS) {
      const r = await ensureAuth(client, email, derivePassword(master, email), wantsReset);
      const totp = await ensureTotpFactor(client, r.userId, ambienteDiCollaudo);
      r.totpFactorCreated = totp.creato;
      if (ambienteDiCollaudo && totp.segreto) segretiDiCollaudo[email] = totp.segreto;
      report.push({ email, ...r });
    }

    await client.query("COMMIT");

    // Deposito DOPO il COMMIT: un file che annuncia segreti che una ROLLBACK ha appena
    // disfatto sarebbe peggio di nessun file — la suite li userebbe e accuserebbe il login.
    if (ambienteDiCollaudo) depositaSegretiDiCollaudo(segretiDiCollaudo);

    console.log("─".repeat(76));
    console.log("E2E/integration persona auth seeded (real RTL_BANK users):");
    for (const r of report) {
      const flags = [
        r.identityCreated ? "identity=CREATED" : "identity=EXISTS",
        r.credentialCreated ? "credential=CREATED" : "credential=EXISTS",
        r.totpFactorCreated ? "totp-fixture=CREATED" : "totp-fixture=EXISTS",
      ];
      console.log(`  ${r.email.padEnd(34)} ${flags.join(" ")}`);
    }
    console.log("  password : DERIVATA per-utente dalla chiave madre (Z-262) — mai registrata");
    console.log("─".repeat(76));

    await dichiaraStatoRaggiunto(client, ambienteDiCollaudo, segretiDiCollaudo);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-test-admin FAILED:", err);
  process.exit(1);
});
