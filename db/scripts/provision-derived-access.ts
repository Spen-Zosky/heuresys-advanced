/**
 * db/scripts/provision-derived-access.ts
 * Z-262 — dà un accesso reale a OGNI utente attivo, con credenziali DERIVATE
 * dalla chiave madre (.secrets/dev-access-master.key).
 *
 * Perché esiste: 13 utenti su 162 avevano un accesso. Gli altri 149 non avevano
 * né identità né password, quindi non era possibile né impersonarli nel browser
 * né far girare i test sull'intera popolazione — e una popolazione di 7 personas
 * fisse nasconde difetti (misurato: il test di Z-259 era verde solo perché
 * girava su una persona che, per combinazione, non aveva i dati che perdevano).
 *
 * Perché non l'invito via email: `rtl-bank.org` NON ESISTE come dominio
 * (nslookup → Non-existent domain), quindi 158 indirizzi su 162 non sono
 * recapitabili. L'invito non è una strada, non un'alternativa più lenta.
 *
 * NON tocca i domini di persone reali (REAL_PERSON_EMAILS): le loro password
 * le scelgono loro. Decisione di Enzo, S1032.
 *
 * Idempotente: ri-eseguibile: crea ciò che manca, riallinea ciò che c'è.
 *   pnpm db:provision-access --dry-run     # non scrive nulla, dice cosa farebbe
 *   pnpm db:provision-access               # esegue
 */
import { Client } from "pg";
import argon2 from "argon2";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readMaster,
  derivePassword,
  deriveTotpSecret,
  isRealPerson,
  REAL_PERSON_EMAILS,
} from "../../apps/api/scripts/derive-access.mjs";
import { encryptSecret } from "../../apps/api/src/modules/auth/secret-crypto.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });

/** Stessi parametri del server (ADR-0005). Non "simili": gli stessi. */
const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const FIXTURE_LABEL = "derived-access";
const DRY = process.argv.includes("--dry-run");
/** Riscrive la password anche di chi ne ha gia' una. Serve per i 13 utenti
 *  preesistenti, la cui credenziale veniva da TEST_ADMIN_PASSWORD: senza questo
 *  i test che derivano la password fallirebbero proprio sulle vecchie personas. */
const REALIGN = process.argv.includes("--realign");
/**
 * `--solo a@x,b@y` — agisce **solo** su quegli indirizzi (Enzo, 2026-08-31).
 *
 * Nasce da un caso vero: in produzione le 158 personas entrano gia' (misurato con
 * `verify-derived-login`), e a non entrare erano le **tre utenze di collaudo**. Senza questa
 * opzione l'unico modo di ripararle era `--realign`, che riscrive la password di TUTTI per
 * costruzione — cioe' un intervento da 162 righe per un guasto da 3. Un rimedio piu' largo
 * del guasto e' un guasto a sua volta.
 *
 * Si combina con `--realign`: `--solo` sceglie CHI, `--realign` dice di riscrivere anche a
 * chi una credenziale ce l'ha gia' (che e' esattamente il caso delle tre).
 */
const SOLO = (() => {
  const a = process.argv.find((x) => x.startsWith("--solo="));
  const set = new Set(
    (a ? a.slice("--solo=".length) : "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  return set.size > 0 ? set : null;
})();

interface Row {
  user_id: string;
  user_email: string;
}

async function main(): Promise<void> {
  const master = readMaster();

  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();

  const stats = { visti: 0, esclusi: 0, identita: 0, credenziali: 0, fattori: 0, invariati: 0 };

  try {
    const { rows } = await db.query<Row>(
      `SELECT user_id, user_email FROM sys.sys_users
        WHERE user_status = 'ACTIVE' ORDER BY user_email`,
    );

    for (const u of rows) {
      // `--solo` filtra PRIMA di ogni altra cosa: chi non e' nell'elenco non viene nemmeno
      // contato fra i visti, cosi' il riepilogo finale parla solo di cio' che si e' toccato.
      if (SOLO && !SOLO.has(u.user_email.toLowerCase())) continue;
      stats.visti++;
      if (isRealPerson(u.user_email)) {
        stats.esclusi++;
        continue;
      }

      const password = derivePassword(master, u.user_email);
      const totpSecret = deriveTotpSecret(master, u.user_email);
      let touched = false;

      // 1. identità di accesso (LOCAL)
      const ident = await db.query<{ auth_identity_id: string }>(
        `SELECT auth_identity_id FROM sys.sys_auth_identities
          WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`,
        [u.user_id],
      );
      let identityId = ident.rows[0]?.auth_identity_id;
      if (!identityId) {
        stats.identita++;
        touched = true;
        if (!DRY) {
          const ins = await db.query<{ auth_identity_id: string }>(
            `INSERT INTO sys.sys_auth_identities
               (auth_identity_user_id, auth_identity_provider, auth_identity_provider_subject,
                auth_identity_email_verified, auth_identity_is_active)
             VALUES ($1, 'LOCAL', $2, true, true)
             RETURNING auth_identity_id`,
            [u.user_id, u.user_email.toLowerCase()],
          );
          identityId = ins.rows[0]!.auth_identity_id;
        }
      }

      // 2. credenziale: l'impronta della password derivata.
      //    In dry-run l'identità non è stata creata, quindi identityId è vuoto:
      //    senza questo ramo il conteggio direbbe 0 credenziali e poi ne
      //    creerebbe 147. Un giro a vuoto che sottostima è peggio che inutile.
      if (!identityId && DRY) {
        stats.credenziali++;
        touched = true;
      } else if (identityId) {
        const cred = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM sys.sys_auth_credentials
            WHERE auth_credential_identity_id = $1 AND auth_credential_is_current`,
          [identityId],
        );
        if (cred.rows[0]!.n === "0" || REALIGN) {
          stats.credenziali++;
          touched = true;
          if (!DRY) {
            const hash = await argon2.hash(password, ARGON2_PARAMS);
            // La credenziale corrente e' UNA: le precedenti restano come storia.
            await db.query(
              `UPDATE sys.sys_auth_credentials SET auth_credential_is_current = false, rotated_at = now()
                WHERE auth_credential_identity_id = $1 AND auth_credential_is_current`,
              [identityId],
            );
            await db.query(
              `INSERT INTO sys.sys_auth_credentials
                 (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash,
                  auth_credential_is_current, auth_credential_must_rotate)
               VALUES ($1, 'ARGON2ID', $2, true, false)`,
              [identityId, hash],
            );
          }
        }
      }

      // 3. fattore TOTP verificato, con il segreto CIFRATO (la cifratura è
      //    attiva in produzione: i fattori del 2026-07-22 sono enc:v1…)
      const fac = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors
          WHERE auth_mfa_factor_user_id = $1 AND auth_mfa_factor_kind = 'TOTP'
            AND auth_mfa_factor_metadata->>'label' = $2`,
        [u.user_id, FIXTURE_LABEL],
      );
      if (fac.rows[0]!.n === "0") {
        stats.fattori++;
        touched = true;
        if (!DRY) {
          await db.query(
            `INSERT INTO sys.sys_auth_mfa_factors
               (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret,
                auth_mfa_factor_metadata, auth_mfa_factor_verified)
             VALUES ($1, 'TOTP', $2, jsonb_build_object('label', $3::text), true)`,
            [u.user_id, encryptSecret(totpSecret), FIXTURE_LABEL],
          );
        }
      }

      if (!touched) stats.invariati++;
    }
  } finally {
    await db.end();
  }

  const mode = DRY ? "DRY-RUN (nessuna scrittura)" : "ESEGUITO";
  console.log(`
${mode}
  utenti ACTIVE esaminati ....... ${stats.visti}
  esclusi (persone reali) ....... ${stats.esclusi}   [${REAL_PERSON_EMAILS.join(", ")}]
  identita' create .............. ${stats.identita}
  credenziali create ............ ${stats.credenziali}
  fattori TOTP creati ........... ${stats.fattori}
  gia' a posto (invariati) ...... ${stats.invariati}
`);
}

main().catch((e: unknown) => {
  console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
