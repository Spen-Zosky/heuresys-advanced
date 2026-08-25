/**
 * db/scripts/provision-collaudo-access.ts
 * #169 F2 — crea le TRE utenze di collaudo (direttiva Enzo 2026-08-25, S1080):
 * identità `SERVICE` su dominio `.invalid`, mandati VERI (mai ruoli-ombra,
 * ADR-0036), credenziali derivate da una chiave PROPRIA (.secrets/collaudo-
 * access.key — mai la chiave madre delle persone), esenzione dal secondo
 * fattore col meccanismo esistente (mig 000116/000118: solo SERVICE, con
 * audit). NESSUN fattore TOTP: l'autonomia dell'accesso sta nell'esenzione,
 * non in un segreto in più da custodire.
 *
 * Le quattro cose di ogni scrittura (db-migrations.md):
 *  (a) misura prima  — conteggi STANDARD/SERVICE letti in apertura
 *  (b) guardia       — un'email già presente con user_type ≠ SERVICE ferma tutto;
 *                      l'idoneità SERVICE-only dell'esenzione la ri-verifica il
 *                      trigger della 000118 al momento dell'INSERT
 *  (c) post-condizione su ciò che NON deve cambiare — il conteggio degli
 *      STANDARD resta identico; la sentinella v_user_census_deviation resta 0
 *  (d) rollback      — `--undo`: elenco esplicito delle tre email, cancellazioni
 *                      ordinate (credenziali → identità → ruoli → esenzioni via
 *                      CASCADE → utenti). Mai un carattere jolly.
 *
 * Idempotente: due corse di fila = 0 scritture.
 *   pnpm db:provision-collaudo --dry-run
 *   pnpm db:provision-collaudo
 *   pnpm db:provision-collaudo --undo
 */
import { Client } from "pg";
import argon2 from "argon2";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readCollaudoKey,
  deriveCollaudoPassword,
  COLLAUDO_IDENTITIES,
} from "../../apps/api/scripts/collaudo-access.mjs";

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

const DRY = process.argv.includes("--dry-run");
const UNDO = process.argv.includes("--undo");
const EXEMPTION_REASON =
  "collaudo-access (#169 F2, direttiva Enzo 2026-08-25): utenza di collaudo SERVICE, " +
  "verifiche funzionali e frontend senza il rito di login delle persone reali";

function fail(msg: string): never {
  throw new Error(msg);
}

async function main(): Promise<void> {
  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();
  const emails = COLLAUDO_IDENTITIES.map((c) => c.email);

  try {
    if (UNDO) {
      // Rollback dichiarato: elenco esplicito, ordine dal dipendente al padrone.
      await db.query("BEGIN");
      const u = await db.query(
        `SELECT user_id, user_email FROM sys.sys_users
          WHERE user_email = ANY($1) AND user_type = 'SERVICE'`,
        [emails],
      );
      const ids = u.rows.map((r) => r.user_id);
      const cred = await db.query(
        `DELETE FROM sys.sys_auth_credentials WHERE auth_credential_identity_id IN
           (SELECT auth_identity_id FROM sys.sys_auth_identities WHERE auth_identity_user_id = ANY($1))`,
        [ids],
      );
      const iden = await db.query(
        `DELETE FROM sys.sys_auth_identities WHERE auth_identity_user_id = ANY($1)`, [ids]);
      const role = await db.query(
        `DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = ANY($1)`, [ids]);
      const users = await db.query(
        `DELETE FROM sys.sys_users WHERE user_id = ANY($1)`, [ids]);
      await db.query("COMMIT");
      console.log(`UNDO: credenziali ${cred.rowCount} · identita' ${iden.rowCount} · ruoli ${role.rowCount} · utenti ${users.rowCount} (esenzioni via CASCADE)`);
      return;
    }

    const key = readCollaudoKey();

    // (a) misura prima
    const before = await db.query<{ std: string; srv: string }>(
      `SELECT count(*) FILTER (WHERE user_type = 'STANDARD')::text AS std,
              count(*) FILTER (WHERE user_type = 'SERVICE')::text  AS srv
         FROM sys.sys_users`,
    );
    const stdBefore = before.rows[0]!.std;
    console.log(`misura prima: STANDARD=${stdBefore} SERVICE=${before.rows[0]!.srv}`);

    const stats = { utenti: 0, ruoli: 0, identita: 0, credenziali: 0, iscrizioni: 0, esenzioni: 0, invariati: 0 };

    await db.query("BEGIN");
    for (const c of COLLAUDO_IDENTITIES) {
      let touched = false;

      const ten = await db.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1`, [c.tenantCode]);
      const tenantId = ten.rows[0]?.tenant_id ?? fail(`tenant ${c.tenantCode} assente`);
      const rol = await db.query<{ auth_role_id: string }>(
        `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = $1`, [c.roleCode]);
      const roleId = rol.rows[0]?.auth_role_id ?? fail(`ruolo ${c.roleCode} assente`);

      // (b) guardia: mai sovrascrivere un'utenza che non e' di collaudo
      const ex = await db.query<{ user_id: string; user_type: string }>(
        `SELECT user_id, user_type FROM sys.sys_users WHERE lower(user_email) = $1`,
        [c.email]);
      if (ex.rows[0] && ex.rows[0].user_type !== "SERVICE") {
        fail(`${c.email} esiste con user_type=${ex.rows[0].user_type}: non la tocco`);
      }
      let userId = ex.rows[0]?.user_id;
      if (!userId) {
        stats.utenti++; touched = true;
        if (!DRY) {
          const ins = await db.query<{ user_id: string }>(
            `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_type, user_status)
             VALUES ($1, $2, $3, 'SERVICE', 'ACTIVE') RETURNING user_id`,
            [tenantId, c.email, c.displayName]);
          userId = ins.rows[0]!.user_id;
        }
      }
      if (!userId) { stats.ruoli++; stats.identita++; stats.credenziali++; stats.esenzioni++; continue; } // dry-run su utente nuovo

      const hasRole = await db.query(
        `SELECT 1 FROM sys.sys_user_auth_roles
          WHERE user_auth_role_user_id = $1 AND user_auth_role_role_id = $2
            AND user_auth_role_revoked_at IS NULL`, [userId, roleId]);
      if (hasRole.rowCount === 0) {
        stats.ruoli++; touched = true;
        if (!DRY) await db.query(
          `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
           VALUES ($1, $2, $3)`, [userId, roleId, tenantId]);
      }

      const ident = await db.query<{ auth_identity_id: string }>(
        `SELECT auth_identity_id FROM sys.sys_auth_identities
          WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`, [userId]);
      let identityId = ident.rows[0]?.auth_identity_id;
      if (!identityId) {
        stats.identita++; touched = true;
        if (!DRY) {
          const ins = await db.query<{ auth_identity_id: string }>(
            `INSERT INTO sys.sys_auth_identities
               (auth_identity_user_id, auth_identity_provider, auth_identity_provider_subject,
                auth_identity_email_verified, auth_identity_is_active)
             VALUES ($1, 'LOCAL', $2, true, true) RETURNING auth_identity_id`,
            [userId, c.email]);
          identityId = ins.rows[0]!.auth_identity_id;
        }
      }
      if (identityId) {
        const cred = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM sys.sys_auth_credentials
            WHERE auth_credential_identity_id = $1 AND auth_credential_is_current`, [identityId]);
        if (cred.rows[0]!.n === "0") {
          stats.credenziali++; touched = true;
          if (!DRY) {
            const hash = await argon2.hash(deriveCollaudoPassword(key, c.email), ARGON2_PARAMS);
            await db.query(
              `INSERT INTO sys.sys_auth_credentials
                 (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash,
                  auth_credential_is_current, auth_credential_must_rotate)
               VALUES ($1, 'ARGON2ID', $2, true, false)`, [identityId, hash]);
          }
        }
      } else if (DRY) { stats.credenziali++; }

      // #139 / mig 000284: l'esenzione pretende TRE atti distinti — SERVICE,
      // iscrizione nominativa, esenzione. Questo e' il secondo: l'atto
      // deliberato e' la direttiva di Enzo del 2026-08-25 (register #169),
      // e la ragione la cita per iscritto.
      const eligible = await db.query(
        `SELECT 1 FROM sys.sys_auth_mfa_exemption_eligible_users
          WHERE auth_mfa_eligible_user_id = $1`, [userId]);
      if (eligible.rowCount === 0) {
        stats.iscrizioni++; touched = true;
        if (!DRY) await db.query(
          `INSERT INTO sys.sys_auth_mfa_exemption_eligible_users
             (auth_mfa_eligible_user_id, auth_mfa_eligible_reason)
           VALUES ($1, $2) ON CONFLICT (auth_mfa_eligible_user_id) DO NOTHING`,
          [userId, EXEMPTION_REASON]);
      }

      const exemption = await db.query(
        `SELECT 1 FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1
           AND auth_mfa_exemption_enabled`, [userId]);
      if (exemption.rowCount === 0) {
        stats.esenzioni++; touched = true;
        // il trigger della 000118 RI-VERIFICA qui che l'utente sia SERVICE:
        // la guardia vive nel database, non in questa riga.
        if (!DRY) await db.query(
          `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason)
           VALUES ($1, $2)
           ON CONFLICT (auth_mfa_exemption_user_id)
           DO UPDATE SET auth_mfa_exemption_enabled = true, auth_mfa_exemption_reason = EXCLUDED.auth_mfa_exemption_reason`,
          [userId, EXEMPTION_REASON]);
      }

      // un fattore TOTP su un'utenza di collaudo sarebbe un segreto di troppo
      const fac = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`,
        [userId]);
      if (fac.rows[0]!.n !== "0") fail(`${c.email} ha ${fac.rows[0]!.n} fattori MFA: non previsto, fermati e guarda`);

      if (!touched) stats.invariati++;
    }

    // (c) post-condizioni: cio' che NON doveva cambiare
    if (!DRY) {
      const after = await db.query<{ std: string }>(
        `SELECT count(*) FILTER (WHERE user_type = 'STANDARD')::text AS std FROM sys.sys_users`);
      if (after.rows[0]!.std !== stdBefore) {
        await db.query("ROLLBACK");
        fail(`gli STANDARD sono cambiati (${stdBefore} -> ${after.rows[0]!.std}): rollback`);
      }
      const sent = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.v_user_census_deviation`);
      if (sent.rows[0]!.n !== "0") {
        await db.query("ROLLBACK");
        fail(`la sentinella v_user_census_deviation non e' piu' a zero (${sent.rows[0]!.n}): rollback`);
      }
    }
    await db.query(DRY ? "ROLLBACK" : "COMMIT");

    console.log(`
${DRY ? "DRY-RUN (nessuna scrittura)" : "ESEGUITO"}
  utenze create ................. ${stats.utenti}
  ruoli assegnati ............... ${stats.ruoli}
  identita' create .............. ${stats.identita}
  credenziali create ............ ${stats.credenziali}
  iscrizioni all'elenco (000284)  ${stats.iscrizioni}
  esenzioni MFA ................. ${stats.esenzioni}
  gia' a posto (invariati) ...... ${stats.invariati}
  rollback dichiarato ........... pnpm db:provision-collaudo --undo  (le 3 email, mai un jolly)
`);
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
