/**
 * apps/api/scripts/deposita-totp-e2e.mts — il deposito TOTP per la suite Playwright,
 * letto dal database invece che generato da un seed.
 *
 *   pnpm db:deposita-totp-e2e          (dalla radice)
 *
 * PERCHE' ESISTE (S1095, 2026-09-12). Da B18 (2026-09-09) l'obbligo del secondo fattore e'
 * ACCESO anche in produzione, e i segreti delle persone sono CASUALI (#169 F3c): la suite
 * web fa login con persone vere, e al passo due deve conoscere il loro segreto. In CI lo
 * scrive il seed di collaudo (`seed-test-admin.ts`, dietro la guardia NODE_ENV=test + nome del
 * database); su questa macchina il database e' la PRODUZIONE via tunnel e quel seed —
 * giustamente — si rifiuta. Restava una sola via, quella che la suite API usa gia': i test di
 * integrazione LEGGONO il segreto dal database, dove e' cifrato, con credenziali piene
 * (`test/helpers/mfa-fixture-secrets.ts`). Questo script fa la stessa lettura e la deposita
 * dove `apps/web/tests/e2e/mfa-fixture-secrets.ts` la cerca — `apps/web` non ha un client
 * PostgreSQL, e aggiungerlo per una suite di browser sarebbe una dipendenza in cambio di niente.
 *
 * COSA NON E'. Non deriva niente dalla chiave madre (l'invariante di F3c resta intatta: chi ha
 * quella chiave non ottiene questi valori); non scrive nel database (sola lettura); non e' un
 * canale di distribuzione — il file e' gitignored (`apps/web/.gitignore`: `tests/.auth/`),
 * per-macchina, con permessi 0600, e non viaggia con `align-clones`. Chi puo' eseguire questo
 * script ha gia' `MFA_ENCRYPTION_KEY` e l'accesso al database: non ottiene niente che non
 * avesse.
 *
 * Stampa l'IMPRONTA di ogni segreto (otto caratteri di digest), mai il valore: e' cio' che
 * permette di confrontare «cosa ho depositato» con «cosa la fixture ha usato».
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pool, closePool } from "../src/db/client.js";
import { decryptSecret } from "../src/modules/auth/secret-crypto.js";

const ETICHETTA = "derived-access";
const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, "..", "..", "..");
const PERCORSO = resolve(REPO, "apps", "web", "tests", ".auth", "totp-secrets.json");

// Le sei persone della suite (apps/web/tests/e2e/fixtures.ts, PERSONAS). Elenco esplicito,
// non «tutti i fattori»: il deposito porta il minimo che la suite usa.
const PERSONE = [
  "enzo.spenuso@heuresys.com",
  "federica.marchetti@rtl-bank.org",
  "paolo.caputo@rtl-bank.org",
  "tommaso.fiore@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
  "andrea.martino@rtl-bank.org",
];

const impronta = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

async function main(): Promise<number> {
  const r = await pool.query<{ email: string; secret: string }>(
    `SELECT u.user_email AS email, f.auth_mfa_factor_secret AS secret
       FROM sys.sys_auth_mfa_factors f
       JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
      WHERE f.auth_mfa_factor_kind = 'TOTP'
        AND f.auth_mfa_factor_verified
        AND f.auth_mfa_factor_metadata->>'label' = $1
        AND u.user_email = ANY($2::text[])`,
    [ETICHETTA, PERSONE],
  );
  const segreti: Record<string, string> = {};
  for (const riga of r.rows) segreti[riga.email] = decryptSecret(riga.secret);

  const mancanti = PERSONE.filter((e) => !segreti[e]);
  if (mancanti.length > 0) {
    // Non si deposita a meta': una fixture senza una persona cade al passo due con un 401
    // che accusa il login mentre il guasto e' qui.
    console.error(`  ROSSO: senza fattore TOTP verificato: ${mancanti.join(", ")}`);
    return 1;
  }
  for (const [email, s] of Object.entries(segreti)) {
    console.log(`    impronta ${email.padEnd(34)} ${impronta(s)}`);
  }
  mkdirSync(dirname(PERCORSO), { recursive: true });
  writeFileSync(
    PERCORSO,
    `${JSON.stringify(
      {
        avvertenza:
          "Segreti TOTP letti dal database per la suite Playwright di QUESTA macchina. " +
          "Gitignored, mai propagati. Scritti da apps/api/scripts/deposita-totp-e2e.mts.",
        database: process.env.POSTGRES_DB ?? null,
        segreti,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`  ${Object.keys(segreti).length} segreti depositati in apps/web/tests/.auth/totp-secrets.json`);
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error(e); process.exitCode = 2; })
  .finally(() => void closePool());
